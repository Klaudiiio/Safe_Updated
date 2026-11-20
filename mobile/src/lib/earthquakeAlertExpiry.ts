export interface EarthquakeAlertRecord {
  id?: string | number | null;
  external_event_id?: string | null;
  classification?: string | null;
  alert_active?: boolean | null;
  alert_expires_at?: string | null;
  acknowledged?: boolean | null;
  dismissed?: boolean | null;
}

export function getEarthquakeEventKey(
  event: EarthquakeAlertRecord | null | undefined
): string {
  if (!event) return "";
  return String(event.external_event_id ?? event.id ?? "").trim();
}

export function getAlertExpiresAtMs(
  event: EarthquakeAlertRecord | null | undefined
): number | null {
  if (!event || !event.alert_expires_at) return null;
  const parsedMs = Date.parse(String(event.alert_expires_at));
  return Number.isFinite(parsedMs) ? parsedMs : null;
}

export function isAlertActive(
  event: EarthquakeAlertRecord | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!event) return false;

  const classification = String(event.classification ?? "")
    .trim()
    .toLowerCase();
  if (classification !== "earthquake_alert") return false;

  if (Boolean(event.acknowledged) || Boolean(event.dismissed)) return false;
  if (event.alert_active === false) return false;

  const expiresAtMs = getAlertExpiresAtMs(event);
  if (expiresAtMs === null) return false;

  return nowMs < expiresAtMs;
}