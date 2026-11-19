import logging

from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError

from accounts.earthquake_service import (
    fetch_earthquakes_from_supabase,
    get_evaluated_earthquakes,
    get_ustp_cdo_coords,
    sync_earthquakes_to_supabase,
)
from accounts.views import _merge_and_deduplicate_events

logger = logging.getLogger(__name__)

DEFAULT_CACHE_KEY = "phivolcs_ustp_cdo_earthquakes"
DEFAULT_CACHE_TIMEOUT_SECONDS = 300


class Command(BaseCommand):
    help = "Fetch, validate, classify, and sync PHIVOLCS earthquake monitoring events."

    def add_arguments(self, parser):
        parser.add_argument(
            "--cache-timeout",
            type=int,
            default=int(getattr(settings, "EARTHQUAKE_CACHE_TIMEOUT_SECONDS", DEFAULT_CACHE_TIMEOUT_SECONDS)),
            help="Cache TTL in seconds for the evaluated earthquake payload (default: 300).",
        )
        parser.add_argument(
            "--skip-supabase",
            action="store_true",
            help="Evaluate and cache events without writing to Supabase.",
        )

    def handle(self, *args, **options):
        cache_timeout = max(30, int(options["cache_timeout"]))
        skip_supabase = bool(options["skip_supabase"])

        try:
            evaluated_events = get_evaluated_earthquakes()
            if not skip_supabase:
                sync_earthquakes_to_supabase(evaluated_events)
        except Exception as exc:
            logger.exception("Failed to sync PHIVOLCS earthquake events.")
            raise CommandError(f"PHIVOLCS sync failed: {exc}") from exc

        persisted_events: list[dict] = []
        if not skip_supabase:
            try:
                persisted_events = fetch_earthquakes_from_supabase()
            except Exception as db_exc:
                logger.warning("Could not read persisted earthquakes after sync: %s", db_exc)

        merged_events = _merge_and_deduplicate_events(persisted_events, evaluated_events)

        cdo_lat, cdo_lon = get_ustp_cdo_coords()
        radius_km = float(getattr(settings, "EARTHQUAKE_REGIONAL_RADIUS_KM", 200.0))
        blind_zone_km = float(getattr(settings, "EARTHQUAKE_BLIND_ZONE_RADIUS_KM", 15.0))

        payload = {
            "center": {"latitude": cdo_lat, "longitude": cdo_lon},
            "radius_km": radius_km,
            "blind_zone_km": blind_zone_km,
            "source": "PHIVOLCS",
            "events": merged_events,
            "phivolcs_reference_url": "https://www.phivolcs.dost.gov.ph/",
        }
        cache.set(DEFAULT_CACHE_KEY, payload, timeout=cache_timeout)

        self.stdout.write(
            self.style.SUCCESS(
                f"Synced {len(evaluated_events)} validated PHIVOLCS event(s); "
                f"cached {len(merged_events)} total event(s) (cache TTL: {cache_timeout}s, "
                f"supabase={'skipped' if skip_supabase else 'synced'})."
            )
        )