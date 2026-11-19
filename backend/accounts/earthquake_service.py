try:
    import truststore

    truststore.inject_into_ssl()
except ImportError:
    pass


from datetime import datetime, timedelta, timezone
import hashlib
import math
import os
import re
import time
from typing import Any
import uuid
from zoneinfo import ZoneInfo


from django.conf import settings
from django.utils import timezone as dj_timezone
import requests


PST_TZ = ZoneInfo("Asia/Manila")


# Default USTP CDO campus coordinates (override via Django settings if needed)
DEFAULT_USTP_CDO_LAT = 8.481207
DEFAULT_USTP_CDO_LON = 124.669641


DEFAULT_BLIND_ZONE_RADIUS_KM = 15.0
DEFAULT_REGIONAL_RADIUS_KM = 200.0
DEFAULT_ADVISORY_MIN_MAGNITUDE = 3.0
DEFAULT_ADVISORY_MIN_INTENSITY = "III"
DEFAULT_MIN_FEED_MAGNITUDE = 4.0
DEFAULT_HISTORY_MAX_AGE_DAYS = 30.0
DEFAULT_SUPABASE_PAGE_SIZE = 100
MAX_SUPABASE_HISTORY_ROWS = 2000


INTENSITY_ORDER: dict[str, int] = {
    "I": 1,
    "II": 2,
    "III": 3,
    "IV": 4,
    "V": 5,
    "VI": 6,
    "VII": 7,
    "VIII": 8,
    "IX": 9,
    "X": 10,
}


DEFAULT_THRESHOLD_BANDS: list[dict[str, Any]] = [
    {"min_km": 15.0, "max_km": 40.0, "min_mag": 4.5, "min_intensity": "IV"},
    {"min_km": 40.0, "max_km": 100.0, "min_mag": 5.5, "min_intensity": "V"},
    {"min_km": 100.0, "max_km": 200.0, "min_mag": 6.5, "min_intensity": "VI"},
]




def get_blind_zone_radius_km() -> float:
    return max(
        0.0,
        float(getattr(settings, "EARTHQUAKE_BLIND_ZONE_RADIUS_KM", DEFAULT_BLIND_ZONE_RADIUS_KM)),
    )




def get_regional_radius_km() -> float:
    return float(
        getattr(
            settings,
            "EARTHQUAKE_REGIONAL_RADIUS_KM",
            getattr(settings, "EARTHQUAKE_MONITORING_MAX_DISTANCE_KM", DEFAULT_REGIONAL_RADIUS_KM),
        )
    )




def get_min_feed_magnitude() -> float:
    return max(
        0.0,
        float(getattr(settings, "EARTHQUAKE_MIN_FEED_MAGNITUDE", DEFAULT_MIN_FEED_MAGNITUDE)),
    )




def get_history_max_age_days() -> float:
    return max(
        1.0,
        float(getattr(settings, "EARTHQUAKE_HISTORY_MAX_AGE_DAYS", DEFAULT_HISTORY_MAX_AGE_DAYS)),
    )




def get_threshold_bands() -> list[dict[str, Any]]:
    configured = getattr(settings, "EARTHQUAKE_THRESHOLD_BANDS", None)
    if isinstance(configured, (list, tuple)) and configured:
        return list(configured)
    return list(DEFAULT_THRESHOLD_BANDS)




def normalize_intensity(intensity: str | None) -> str | None:
    """Normalize Roman/numeric PHIVOLCS intensity strings to I..X or None."""
    if not intensity:
        return None
    cleaned = str(intensity).strip().upper()
    if not cleaned:
        return None


    roman_match = re.search(r"\b(X|IX|VIII|VII|VI|V|IV|III|II|I)\b", cleaned)
    if roman_match:
        return roman_match.group(1)


    arabic_to_roman = {
        "1": "I",
        "2": "II",
        "3": "III",
        "4": "IV",
        "5": "V",
        "6": "VI",
        "7": "VII",
        "8": "VIII",
        "9": "IX",
        "10": "X",
    }
    num_match = re.fullmatch(r"(10|[1-9])", cleaned)
    if num_match:
        return arabic_to_roman.get(num_match.group(1))


    return None




def intensity_rank(intensity: str | None) -> int:
    normalized = normalize_intensity(intensity)
    if not normalized:
        return 0
    return INTENSITY_ORDER.get(normalized, 0)




def get_threshold_band_for_distance(
    distance_from_cdo_km: float,
    bands: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    """Return the matching threshold band for a given distance in kilometers."""
    if distance_from_cdo_km < 0:
        return None


    active_bands = bands if bands is not None else get_threshold_bands()
    for band in active_bands:
        min_km = band.get("min_km")
        max_km = band.get("max_km")


        lower_ok = True if min_km is None else distance_from_cdo_km > float(min_km)
        upper_ok = True if max_km is None else distance_from_cdo_km <= float(max_km)
        if lower_ok and upper_ok:
            return band


    return None




def get_ustp_cdo_coords() -> tuple[float, float]:
    lat = float(getattr(settings, "USTP_CDO_LAT", os.environ.get("USTP_CDO_LAT", DEFAULT_USTP_CDO_LAT)))
    lon = float(getattr(settings, "USTP_CDO_LON", os.environ.get("USTP_CDO_LON", DEFAULT_USTP_CDO_LON)))
    return lat, lon




def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(earth_radius_km * c, 2)




def _first_present(raw_item: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in raw_item and raw_item[key] is not None and raw_item[key] != "":
            return raw_item[key]
    return None




def parse_event_timestamp(raw_time: Any) -> datetime | None:
    """Parse an ISO string, PHIVOLCS/PST date string, or epoch timestamp into UTC; return None if missing/invalid."""
    if raw_time is None or raw_time == "":
        return None


    if isinstance(raw_time, (int, float)) and not isinstance(raw_time, bool):
        if math.isnan(raw_time) or math.isinf(raw_time) or raw_time <= 0:
            return None
        try:
            ts = float(raw_time) / 1000.0 if raw_time > 1e11 else float(raw_time)
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None


    if isinstance(raw_time, str):
        cleaned = raw_time.strip()
        if not cleaned:
            return None


        # Normalize common timezone suffixes from PHIVOLCS / local feeds
        for suffix in (" PST", " PHT", " +08:00 PST", " +08 PST"):
            if cleaned.upper().endswith(suffix):
                cleaned = cleaned[: -len(suffix)].strip()
                try:
                    dt = datetime.fromisoformat(cleaned)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=PST_TZ)
                    return dt.astimezone(timezone.utc)
                except (ValueError, OverflowError, OSError):
                    break


        try:
            dt = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=PST_TZ)
            return dt.astimezone(timezone.utc)
        except (ValueError, OverflowError, OSError):
            pass


        # Support common "DD Month YYYY - HH:MM AM/PM" or "YYYY/MM/DD HH:MM:SS" formats
        for fmt in (
            "%d %B %Y - %I:%M %p",
            "%d %b %Y - %I:%M %p",
            "%Y/%m/%d %H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y %I:%M %p",
        ):
            try:
                dt = datetime.strptime(cleaned, fmt)
                return dt.replace(tzinfo=PST_TZ).astimezone(timezone.utc)
            except (ValueError, OverflowError, OSError):
                continue


        return None


    return None




def _build_external_event_id(raw_item: dict[str, Any], occurred_at: datetime, lat: float, lon: float) -> str | None:
    explicit_id = _first_present(raw_item, ("id", "external_event_id", "event_id", "bulletin_id", "eq_id"))
    if explicit_id:
        return f"phivolcs:{str(explicit_id).strip()}"


    mag_val = _first_present(raw_item, ("magnitude", "mag"))
    fingerprint = f"phivolcs|{occurred_at.isoformat()}|{lat:.4f}|{lon:.4f}|{mag_val}"
    digest = hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:16]
    return f"phivolcs:{digest}"




def _extract_number(value: Any) -> float | None:
    if value is None or value == "" or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        num = float(value)
        return None if (math.isnan(num) or math.isinf(num)) else num
    if isinstance(value, str):
        match = re.search(r"[-+]?\d+(?:\.\d+)?", value.strip())
        if not match:
            return None
        num = float(match.group(0))
        return None if (math.isnan(num) or math.isinf(num)) else num
    return None




def _is_advisory_candidate(magnitude: float, reported_intensity: str | None) -> bool:
    advisory_min_mag = float(
        getattr(settings, "EARTHQUAKE_ADVISORY_MIN_MAGNITUDE", DEFAULT_ADVISORY_MIN_MAGNITUDE)
    )
    advisory_min_intensity = getattr(
        settings, "EARTHQUAKE_ADVISORY_MIN_INTENSITY", DEFAULT_ADVISORY_MIN_INTENSITY
    )
    return magnitude >= advisory_min_mag or intensity_rank(reported_intensity) >= intensity_rank(
        advisory_min_intensity
    )




def classify_event(
    magnitude: float,
    distance_from_cdo_km: float,
    reported_intensity: str | None = None,
) -> str:
    """
    Assign monitoring | advisory | earthquake_alert on the backend using strict
    regional radius enforcement, a 15 km blind zone, and distance-band
    magnitude + intensity thresholds.
    """
    regional_radius_km = get_regional_radius_km()
    if distance_from_cdo_km > regional_radius_km:
        return "monitoring"


    # 0-15 km is the regional blind zone; immediate alarms rely on an on-site accelerometer.
    blind_zone_km = get_blind_zone_radius_km()
    if distance_from_cdo_km <= blind_zone_km:
        return "advisory" if _is_advisory_candidate(magnitude, reported_intensity) else "monitoring"


    band = get_threshold_band_for_distance(distance_from_cdo_km)
    if band is not None:
        min_mag = float(band.get("min_mag", 99.0))
        min_int_rank = intensity_rank(band.get("min_intensity"))
        event_int_rank = intensity_rank(reported_intensity)


        if magnitude >= min_mag and min_int_rank > 0 and event_int_rank >= min_int_rank:
            return "earthquake_alert"


    if _is_advisory_candidate(magnitude, reported_intensity):
        return "advisory"


    return "monitoring"




def filter_events_for_feed(
    events: list[dict[str, Any]],
    min_magnitude: float | None = None,
) -> list[dict[str, Any]]:
    """
    Filter evaluated events for feed listing without altering event classification.
    """
    cutoff = max(0.0, float(min_magnitude)) if min_magnitude is not None else get_min_feed_magnitude()
    if cutoff <= 0.0:
        return list(events)
    return [
        event for event in events
        if float(event.get("magnitude") or 0.0) >= cutoff
    ]




def is_simulation_event(event: dict[str, Any]) -> bool:
    """Return True when an earthquake event represents a software simulation test."""
    if not isinstance(event, dict):
        return False
    if bool(event.get("is_simulation")):
        return True
    source_val = str(event.get("source") or "").strip().lower()
    ext_id_val = str(event.get("external_event_id") or event.get("id") or "").strip().lower()
    return source_val == "simulation test" or ext_id_val.startswith("sim:")




def filter_events_for_hardware_alarm_sync(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Exclude Simulation Test records before syncing to physical/hardware alarm controllers.
    """
    return [event for event in (events or []) if not is_simulation_event(event)]




def create_and_sync_simulation_earthquake(
    *,
    magnitude: float = 6.2,
    place: str = "Simulated Seismic Zone, Cagayan de Oro",
    classification: str = "earthquake_alert",
    depth_km: float = 15.0,
    distance_from_cdo_km: float = 20.0,
    reported_intensity: str | None = "VI",
    latitude: float | None = None,
    longitude: float | None = None,
    url: str = "https://earthquake.phivolcs.dost.gov.ph/",
    created_by: str | None = None,
) -> dict[str, Any]:
    """
    Create a normalized simulation earthquake record (source='Simulation Test')
    and persist it to Supabase via sync_earthquakes_to_supabase.
    """
    now_utc = dj_timezone.now().astimezone(timezone.utc)
    occurred_iso = now_utc.isoformat()
    ext_id = f"sim:{now_utc.strftime('%Y%m%d%H%M%S')}:{uuid.uuid4().hex[:8]}"

    cdo_lat, cdo_lon = get_ustp_cdo_coords()
    lat = round(float(latitude), 4) if latitude is not None else round(cdo_lat, 4)
    lon = round(float(longitude), 4) if longitude is not None else round(cdo_lon, 4)
    dist = round(float(distance_from_cdo_km), 2)
    depth = round(float(depth_km), 2) if depth_km is not None else None
    mag = round(float(magnitude), 1)
    clean_place = str(place).strip() or "Simulated Seismic Zone, Cagayan de Oro"
    formatted_place = clean_place if clean_place.startswith("[SIMULATION]") else f"[SIMULATION] {clean_place}"

    normalized_event: dict[str, Any] = {
        "id": ext_id,
        "external_event_id": ext_id,
        "magnitude": mag,
        "place": formatted_place,
        "latitude": lat,
        "longitude": lon,
        "depth_km": depth,
        "distance_from_cdo_km": dist,
        "reported_intensity": normalize_intensity(reported_intensity) or reported_intensity,
        "classification": classification,
        "source": "Simulation Test",
        "is_simulation": True,
        "simulated_by": created_by,
        "url": url,
        "event_occurred_at": occurred_iso,
        "time": int(now_utc.timestamp() * 1000),
        "evaluated_at": occurred_iso,
    }

    sync_earthquakes_to_supabase([normalized_event])
    return normalized_event




def validate_and_normalize_event(raw_item: dict[str, Any], now_utc: datetime | None = None) -> dict[str, Any] | None:
    """Validate required fields and timestamp; reject malformed, stale, or out-of-region events."""
    if not isinstance(raw_item, dict):
        return None


    raw_ts = _first_present(
        raw_item,
        ("occurred_at", "event_occurred_at", "time", "date_time", "datetime", "date"),
    )
    occurred_at = parse_event_timestamp(raw_ts)
    if occurred_at is None:
        # Never substitute current time when event timestamp is missing or unparseable
        return None


    current_utc = now_utc or dj_timezone.now().astimezone(timezone.utc)
    max_age_hours = float(getattr(settings, "EARTHQUAKE_MAX_AGE_HOURS", 24.0))
    if occurred_at < (current_utc - timedelta(hours=max_age_hours)):
        return None
    if occurred_at > (current_utc + timedelta(minutes=15)):
        return None


    lat = _extract_number(_first_present(raw_item, ("latitude", "lat")))
    lon = _extract_number(_first_present(raw_item, ("longitude", "lon", "lng")))
    mag = _extract_number(_first_present(raw_item, ("magnitude", "mag")))


    if lat is None or lon is None or mag is None:
        return None
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None
    if not (0.0 <= mag <= 12.0):
        return None


    ext_id = _build_external_event_id(raw_item, occurred_at, lat, lon)
    if not ext_id:
        return None


    cdo_lat, cdo_lon = get_ustp_cdo_coords()
    distance_km = calculate_distance_km(cdo_lat, cdo_lon, lat, lon)


    strict_radius = bool(getattr(settings, "EARTHQUAKE_STRICT_REGIONAL_RADIUS", True))
    regional_radius_km = get_regional_radius_km()
    if strict_radius and distance_km > regional_radius_km:
        return None


    raw_depth = _first_present(raw_item, ("depth_km", "depth"))
    depth_km: float | None = None
    d_val = _extract_number(raw_depth)
    if d_val is not None and d_val >= -10.0:
        depth_km = round(d_val, 2)


    raw_intensity = _first_present(
        raw_item,
        ("reported_intensity", "intensity", "phivolcs_intensity", "max_intensity"),
    )
    reported_intensity = normalize_intensity(
        raw_intensity if isinstance(raw_intensity, str) else (str(raw_intensity) if raw_intensity is not None else None)
    )


    evaluated_at = dj_timezone.now().astimezone(timezone.utc)
    classification = classify_event(
        magnitude=mag,
        distance_from_cdo_km=distance_km,
        reported_intensity=reported_intensity,
    )


    place_raw = _first_present(raw_item, ("place", "location", "epicenter"))
    place = str(place_raw).strip() if place_raw else ""
    if not place:
        place = f"PHIVOLCS Seismic Event ({lat:.2f}, {lon:.2f})"


    url_raw = _first_present(raw_item, ("url", "link", "bulletin_url"))
    url = str(url_raw).strip() if url_raw else "https://earthquake.phivolcs.dost.gov.ph/"


    return {
        "id": ext_id,
        "external_event_id": ext_id,
        "magnitude": round(mag, 1),
        "place": place,
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "depth_km": depth_km,
        "distance_from_cdo_km": distance_km,
        "reported_intensity": reported_intensity,
        "classification": classification,
        "source": "PHIVOLCS",
        "url": url,
        "event_occurred_at": occurred_at.isoformat(),
        "time": int(occurred_at.timestamp() * 1000),
        "evaluated_at": evaluated_at.isoformat(),
    }




def _extract_items_from_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]


    if isinstance(payload, dict):
        for key in ("events", "data", "items", "earthquakes", "bulletins", "results", "records"):
            nested = payload.get(key)
            if isinstance(nested, list):
                return [item for item in nested if isinstance(item, dict)]
            if isinstance(nested, dict):
                extracted = _extract_items_from_payload(nested)
                if extracted:
                    return extracted


    return []




def _parse_html_table_events(html_text: str) -> list[dict[str, Any]]:
    """Fallback parser if the configured PHIVOLCS URL returns an HTML table of bulletins."""
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html_text, flags=re.IGNORECASE | re.DOTALL)
    events: list[dict[str, Any]] = []


    for row in rows:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, flags=re.IGNORECASE | re.DOTALL)
        if len(cells) < 5:
            continue


        cleaned_cells = [
            re.sub(r"<[^>]+>", " ", cell).replace("&nbsp;", " ")
            for cell in cells
        ]
        cleaned_cells = [re.sub(r"\s+", " ", c).strip() for c in cleaned_cells]


        link_match = re.search(r'href=["\']([^"\']+)["\']', row, flags=re.IGNORECASE)
        url = link_match.group(1).strip() if link_match else None


        events.append({
            "date_time": cleaned_cells[0],
            "latitude": cleaned_cells[1],
            "longitude": cleaned_cells[2],
            "depth": cleaned_cells[3],
            "magnitude": cleaned_cells[4],
            "location": cleaned_cells[5] if len(cleaned_cells) > 5 else "",
            "reported_intensity": cleaned_cells[6] if len(cleaned_cells) > 6 else None,
            "url": url,
        })


    return events




def _fetch_phivolcs_response(feed_url: str) -> requests.Response:
    retries = max(0, int(getattr(settings, "PHIVOLCS_FETCH_RETRIES", 2)))
    connect_timeout = float(getattr(settings, "PHIVOLCS_CONNECT_TIMEOUT", 5.0))
    read_timeout = float(getattr(settings, "PHIVOLCS_READ_TIMEOUT", 15.0))
    verify_ssl = getattr(settings, "PHIVOLCS_VERIFY_SSL", True)
    headers = {
        "User-Agent": "SAFE-USTP-Clinic-Dispatch/1.0",
        "Accept": "application/json, text/html, */*",
    }


    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            resp = requests.get(
                feed_url,
                timeout=(connect_timeout, read_timeout),
                headers=headers,
                verify=verify_ssl,
            )
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as exc:
            last_exc = exc
            if attempt < retries:
                time.sleep(0.5 * (attempt + 1))


    assert last_exc is not None
    raise last_exc




def fetch_phivolcs_raw_events() -> list[dict[str, Any]]:
    """
    Fetch raw PHIVOLCS earthquake items from configured PHIVOLCS source.
    Supports JSON arrays, wrapped JSON objects, and HTML bulletin tables.
    """
    feed_url = (
        getattr(settings, "PHIVOLCS_EARTHQUAKE_FEED_URL", None)
        or os.environ.get("PHIVOLCS_EARTHQUAKE_FEED_URL", "")
    ).strip()
    if not feed_url:
        return []


    resp = _fetch_phivolcs_response(feed_url)


    try:
        payload = resp.json()
        return _extract_items_from_payload(payload)
    except ValueError:
        return _parse_html_table_events(resp.text)




def get_evaluated_earthquakes(raw_items: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    source_items = raw_items if raw_items is not None else fetch_phivolcs_raw_events()
    now_utc = dj_timezone.now().astimezone(timezone.utc)
    normalized: list[dict[str, Any]] = []
    for item in source_items:
        parsed = validate_and_normalize_event(item, now_utc=now_utc)
        if parsed is not None:
            normalized.append(parsed)
    normalized.sort(key=lambda e: e["event_occurred_at"], reverse=True)
    return normalized




def _normalize_persisted_row(row: dict[str, Any]) -> dict[str, Any] | None:
    """Normalize a row from Supabase public.earthquake_monitoring into the API event shape."""
    if not isinstance(row, dict):
        return None


    ext_id_raw = row.get("external_event_id") or row.get("id")
    if not ext_id_raw:
        return None
    ext_id = str(ext_id_raw).strip()


    occurred_at = parse_event_timestamp(row.get("event_occurred_at"))
    if occurred_at is None:
        return None


    mag_val = _extract_number(row.get("magnitude"))
    dist_val = _extract_number(row.get("distance_from_cdo_km"))
    depth_val = _extract_number(row.get("depth_km"))
    lat_val = _extract_number(row.get("latitude"))
    lon_val = _extract_number(row.get("longitude"))


    if dist_val is None and lat_val is not None and lon_val is not None:
        cdo_lat, cdo_lon = get_ustp_cdo_coords()
        dist_val = calculate_distance_km(cdo_lat, cdo_lon, lat_val, lon_val)


    strict_radius = bool(getattr(settings, "EARTHQUAKE_STRICT_REGIONAL_RADIUS", True))
    regional_radius_km = get_regional_radius_km()
    if strict_radius and dist_val is not None and dist_val > regional_radius_km:
        return None


    classification_raw = str(row.get("classification") or "monitoring").strip().lower()
    classification = (
        classification_raw
        if classification_raw in ("monitoring", "advisory", "earthquake_alert")
        else "monitoring"
    )


    place_raw = row.get("place")
    place = str(place_raw).strip() if place_raw else f"PHIVOLCS Seismic Event ({ext_id})"


    reported_intensity = normalize_intensity(
        row.get("reported_intensity") if isinstance(row.get("reported_intensity"), str)
        else (str(row.get("reported_intensity")) if row.get("reported_intensity") is not None else None)
    )


    evaluated_dt = parse_event_timestamp(row.get("evaluated_at"))
    evaluated_at = evaluated_dt.isoformat() if evaluated_dt else occurred_at.isoformat()


    event_dict: dict[str, Any] = {
        "id": ext_id,
        "external_event_id": ext_id,
        "magnitude": round(mag_val, 1) if mag_val is not None else None,
        "place": place,
        "depth_km": round(depth_val, 2) if depth_val is not None else None,
        "distance_from_cdo_km": round(dist_val, 2) if dist_val is not None else 0.0,
        "reported_intensity": reported_intensity,
        "classification": classification,
        "source": str(row.get("source") or "PHIVOLCS").strip(),
        "url": str(row.get("url") or "https://earthquake.phivolcs.dost.gov.ph/").strip(),
        "event_occurred_at": occurred_at.isoformat(),
        "time": int(occurred_at.timestamp() * 1000),
        "evaluated_at": evaluated_at,
    }
    if lat_val is not None:
        event_dict["latitude"] = round(lat_val, 4)
    if lon_val is not None:
        event_dict["longitude"] = round(lon_val, 4)


    return event_dict




def fetch_earthquakes_from_supabase(limit: int | None = None) -> list[dict[str, Any]]:
    """
    Read persisted earthquake monitoring rows from Supabase via PostgREST over the
    configured 30-day history window, ordered by event_occurred_at descending,
    paginating across batches and enforcing the regional radius.
    """
    supabase_url = (getattr(settings, "SUPABASE_URL", None) or os.environ.get("SUPABASE_URL", "")).rstrip("/")
    service_key = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None) or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        return []


    now_utc = dj_timezone.now().astimezone(timezone.utc)
    history_days = get_history_max_age_days()
    cutoff_dt = now_utc - timedelta(days=history_days)
    cutoff_iso = cutoff_dt.isoformat()


    page_size = max(1, int(getattr(settings, "EARTHQUAKE_HISTORY_PAGE_SIZE", DEFAULT_SUPABASE_PAGE_SIZE)))
    max_total_rows = max(
        page_size,
        int(getattr(settings, "EARTHQUAKE_HISTORY_MAX_ROWS", MAX_SUPABASE_HISTORY_ROWS)),
    )
    target_cap = min(int(limit), max_total_rows) if limit is not None else max_total_rows


    offset = 0
    collected_raw_rows: list[dict[str, Any]] = []


    while len(collected_raw_rows) < target_cap:
        batch_limit = min(page_size, target_cap - len(collected_raw_rows))
        response = requests.get(
            f"{supabase_url}/rest/v1/earthquake_monitoring",
            params={
                "select": (
                    "id,external_event_id,magnitude,place,depth_km,distance_from_cdo_km,"
                    "reported_intensity,classification,source,event_occurred_at,evaluated_at"
                ),
                "event_occurred_at": f"gte.{cutoff_iso}",
                "order": "event_occurred_at.desc",
                "limit": str(batch_limit),
                "offset": str(offset),
            },
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
            },
            timeout=10,
        )
        if not response.ok:
            raise RuntimeError(f"Supabase earthquake fetch failed ({response.status_code}): {response.text}")


        payload = response.json()
        if not isinstance(payload, list) or not payload:
            break


        dict_rows = [row for row in payload if isinstance(row, dict)]
        collected_raw_rows.extend(dict_rows)


        if len(payload) < batch_limit:
            break


        offset += len(payload)


    normalized: list[dict[str, Any]] = []
    for row in collected_raw_rows:
        occurred_at = parse_event_timestamp(row.get("event_occurred_at"))
        if occurred_at is None or occurred_at < cutoff_dt:
            continue
        parsed = _normalize_persisted_row(row)
        if parsed is not None:
            normalized.append(parsed)


    normalized.sort(key=lambda e: e["event_occurred_at"], reverse=True)
    return normalized




def sync_alert_hardware_state(events: list[dict[str, Any]]) -> None:
    """
    Update server-side alert output state when an active earthquake_alert is present,
    explicitly ignoring Simulation Test records so software simulations cannot trigger
    physical alarm hardware.
    """
    supabase_url = (getattr(settings, "SUPABASE_URL", None) or os.environ.get("SUPABASE_URL", "")).rstrip("/")
    service_key = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None) or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    table_name = getattr(settings, "EARTHQUAKE_HARDWARE_STATE_TABLE", "earthquake_alert_state")
    if not supabase_url or not service_key or not table_name:
        return


    hardware_events = filter_events_for_hardware_alarm_sync(events)
    latest_alert = next((e for e in hardware_events if e.get("classification") == "earthquake_alert"), None)
    now_iso = dj_timezone.now().astimezone(timezone.utc).isoformat()


    payload = {
        "device_id": getattr(settings, "EARTHQUAKE_HARDWARE_DEVICE_ID", "clinic-alarm-controller"),
        "alert_active": latest_alert is not None,
        "acknowledged": False if latest_alert is not None else True,
        "active_event_id": latest_alert.get("external_event_id") if latest_alert else None,
        "classification": latest_alert.get("classification") if latest_alert else "monitoring",
        "buzzer_enabled": latest_alert is not None,
        "led_enabled": latest_alert is not None,
        "updated_at": now_iso,
    }


    response = requests.post(
        f"{supabase_url}/rest/v1/{table_name}?on_conflict=device_id",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        json=payload,
        timeout=10,
    )
    if not response.ok:
        raise RuntimeError(f"Supabase hardware state sync failed ({response.status_code}): {response.text}")




def sync_earthquakes_to_supabase(events: list[dict[str, Any]]) -> None:
    """
    Upsert validated earthquake event fields into public.earthquake_monitoring keyed on
    external_event_id while omitting alert/acknowledgment state fields so staff
    acknowledgments and hardware controls are preserved.
    """
    supabase_url = (getattr(settings, "SUPABASE_URL", None) or os.environ.get("SUPABASE_URL", "")).rstrip("/")
    service_key = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None) or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key or not events:
        return


    rows_by_ext_id: dict[str, dict[str, Any]] = {}
    for event in events:
        ext_id = event.get("external_event_id") or event.get("id")
        occurred_at = event.get("event_occurred_at")
        if not ext_id or not occurred_at:
            continue


        key = str(ext_id).strip()
        rows_by_ext_id[key] = {
            "external_event_id": key,
            "magnitude": event.get("magnitude"),
            "place": event.get("place"),
            "depth_km": event.get("depth_km"),
            "distance_from_cdo_km": event.get("distance_from_cdo_km"),
            "reported_intensity": event.get("reported_intensity"),
            "classification": event.get("classification", "monitoring"),
            "source": event.get("source", "PHIVOLCS"),
            "event_occurred_at": occurred_at,
            "evaluated_at": event.get("evaluated_at") or dj_timezone.now().astimezone(timezone.utc).isoformat(),
        }


    rows = list(rows_by_ext_id.values())
    if not rows:
        return


    response = requests.post(
        f"{supabase_url}/rest/v1/earthquake_monitoring?on_conflict=external_event_id",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        json=rows,
        timeout=10,
    )
    if not response.ok:
        raise RuntimeError(f"Supabase earthquake sync failed ({response.status_code}): {response.text}")


    if getattr(settings, "ENABLE_EARTHQUAKE_HARDWARE_SYNC", False):
        hardware_events = filter_events_for_hardware_alarm_sync(events)
        if hardware_events:
            sync_alert_hardware_state(hardware_events)