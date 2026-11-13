import type { Incident, IncidentLog, Responder } from './mockData';

type Row = Record<string, unknown>;

export interface LiveUser {
  id: string;
  name: string;
  role: string;
  username: string;
  building: string;
  status: string;
}

export interface LiveNotification {
  id: string;
  notification_id: string;
  incidentId: string;
  type: string;
  title: string;
  message: string;
  sentAt: string;
  status: string;
  priority_level: string;
  priority: string;
  isCritical: boolean;
  isRead: boolean;
  incident?: any;
}

export interface SupabaseOverview {
  incidents: Row[];
  incident_types: Row[];
  locations: Row[];
  responders: Row[];
  notifications: Row[];
  responder_notifications: Row[];
  logs: Row[];
  admins?: Row[];
  users?: Row[];
}

function text(value: unknown, fallback = '—'): string {
  return value == null || value === '' ? fallback : String(value);
}

function key(value: unknown): string {
  return value == null ? '' : String(value);
}

function dateValue(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function relativeTime(value: unknown): string {
  const date = dateValue(value);
  if (!date) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : date.toLocaleDateString();
}

function severity(value: unknown): Incident['severity'] {
  const priority = text(value, '').toLowerCase();
  if (priority.includes('critical') || priority.includes('urgent') || priority.includes('high')) return 'critical';
  if (priority.includes('medium') || priority.includes('moderate')) return 'medium';
  if (priority.includes('low') || priority.includes('minor')) return 'low';
  return 'high';
}

/**
 * Centralized mapping: Translates Supabase database status -> UI status model
 */
export function mapDbStatusToUi(dbStatus: unknown): string {
  const status = text(dbStatus, '').toLowerCase();
  if (['resolved', 'completed', 'closed'].includes(status)) {
    return 'resolved';
  }
  if (['accepted', 'assigned', 'responding', 'in_progress', 'in progress', 'dispatched'].includes(status)) {
    return 'assigned';
  }
  if (status === 'active') {
    return 'active';
  }
  return 'pending';
}

/**
 * Centralized mapping: Translates UI status model -> Supabase database status value
 */
export function mapUiStatusToDb(uiStatus: unknown): string {
  const status = text(uiStatus, '').toLowerCase();
  if (status === 'assigned') {
    return 'ACCEPTED'; // Matches Supabase database schema convention
  }
  if (status === 'resolved') {
    return 'resolved';
  }
  if (status === 'active') {
    return 'active';
  }
  return 'pending';
}

function incidentStatus(value: unknown): Incident['status'] {
  return mapDbStatusToUi(value) as Incident['status'];
}

function responderStatus(value: unknown): Responder['status'] {
  const status = text(value, '').toLowerCase();
  if (status.includes('respond')) return 'responding';
  if (status.includes('assign') || status.includes('dispatch')) return 'assigned';
  if (status.includes('offline') || status.includes('unavailable')) return 'offline';
  return 'available';
}

export function mapIncidents(data: SupabaseOverview): Incident[] {
  const types = new Map(data.incident_types.map((row) => [key(row.incident_types_id), row]));
  const locations = new Map(data.locations.map((row) => [key(row.location_id), row]));
  const users = new Map((data.users ?? []).map((row) => [key(row.user_id), row]));
  const notificationById = new Map(data.notifications.map((row) => [key(row.notification_id || row.id), row]));
  const responderById = new Map(data.responders.map((row) => [key(row.responders_id), row]));
  const assignments = new Map<string, string[]>();

  for (const assignment of data.responder_notifications) {
    const notification = notificationById.get(key(assignment.notification_id));
    const incidentId = key(notification?.incident_id);
    const responder = responderById.get(key(assignment.responders_id));
    if (!incidentId || !responder) continue;
    const names = assignments.get(incidentId) ?? [];
    names.push(text(responder.name));
    assignments.set(incidentId, names);
  }

  return data.incidents.map((row) => {
    const type = types.get(key(row.incident_types_id));
    const location = locations.get(key(row.location_id));
    const user = users.get(key(row.user_id));
    const locationDescription = text(row.location_description, '');
    const lat = Number(location?.latitude);
    const lng = Number(location?.longitude);
    const responders = assignments.get(key(row.incident_id));

    // Preserve full name or display name for other screens, and expose reporterUsername separately
    const reporterName = text(user?.name ?? user?.username, `User ${text(row.user_id)}`);
    const reporterUsername = text(user?.username ?? user?.user_name, 'anonymous');

    return {
      id: text(row.incident_id),
      type: text(type?.incident_name, 'Incident'),
      reporterName,
      reporterUsername,
      building: locationDescription || text(location?.building),
      location: locationDescription ? '' : text(location?.room),
      timeReported: relativeTime(row.reported_at),
      reportedAt: text(row.reported_at, ''),
      severity: severity(type?.priority_level),
      status: incidentStatus(row.status),
      assignedResponder: responders?.join(', '),
      description: text(row.description, 'No description supplied.'),
      gpsCoords: {
        lat: Number.isFinite(lat) ? lat : 0,
        lng: Number.isFinite(lng) ? lng : 0,
      },
    };
  });
}

export function mapResponders(data: SupabaseOverview): Responder[] {
  const notifications = new Map(data.notifications.map((row) => [key(row.notification_id || row.id), row]));
  const incidentNames = new Map(data.incidents.map((row) => [key(row.incident_id), `Incident ${key(row.incident_id)}`]));

  const assignmentByResponder = new Map<string, string>();
  for (const assignment of data.responder_notifications) {
    const notification = notifications.get(key(assignment.notification_id));
    const incident = incidentNames.get(key(notification?.incident_id));
    if (incident) assignmentByResponder.set(key(assignment.responders_id), incident);
  }

  return data.responders.map((row) => ({
    id: text(row.responders_id),
    name: text(row.name, 'Responder'),
    role: text(row.department ?? row.user_type, 'Medical responder'),
    status: responderStatus(row.availability_status),
    assignedIncident: assignmentByResponder.get(key(row.responders_id)),
  }));
}

export function mapUsers(data: SupabaseOverview): LiveUser[] {
  return (data.users ?? []).map((row) => ({
    id: text(row.user_id),
    name: text(row.name, text(row.username, 'User')),
    role: text(row.user_type, 'USER'),
    username: text(row.username),
    building: text(row.course),
    status: text(row.status ?? row.account_status, 'unknown'),
  }));
}

export function mapLogs(data: SupabaseOverview): IncidentLog[] {
  const incidents = new Map(data.incidents.map((row) => [key(row.incident_id), row]));
  const incidentModels = mapIncidents(data);

  return data.logs.map((row) => {
    const incidentId = key(row.incident_id);
    const incident = incidentModels.find((item) => item.id === incidentId);
    const occurred = dateValue(row.action_time);
    return {
      id: text(row.log_id),
      incidentType: incident?.type ?? `Incident ${incidentId}`,
      reporter: (incident as any)?.reporterUsername ?? incident?.reporterName ?? '—',
      building: incident?.building ?? '—',
      date: occurred?.toLocaleDateString() ?? '—',
      time: occurred?.toLocaleTimeString() ?? '—',
      status: incidentStatus(incidents.get(incidentId)?.status),
      respondedBy: text(row.responders_id),
      responseTime: '—',
    };
  });
}

export function mapNotifications(data: SupabaseOverview): LiveNotification[] {
  const incidentTypeMap = new Map(data.incident_types.map((row) => [key(row.incident_types_id), row]));
  const incidentMap = new Map(data.incidents.map((row) => {
    const type = incidentTypeMap.get(key(row.incident_types_id));
    return [key(row.incident_id), { ...row, incident_types: type }];
  }));

  const seenIds = new Set<string>();
  const results: LiveNotification[] = [];

  for (const row of data.notifications || []) {
    const id = text(row.notification_id || row.id);
    if (!id || id === '—' || seenIds.has(id)) continue;
    seenIds.add(id);

    const incidentId = key(row.incident_id);
    const incident = incidentId && incidentId !== '—' ? incidentMap.get(incidentId) : null;
    
    const rawType = text(row.notification_type || row.type, 'System Alert');
    const rawMessage = text(row.message || row.content, 'System notification broadcast');
    const sentAt = text(row.sent_at || row.created_at, new Date().toISOString());
    const deliveryStatus = text(row.delivery_status || row.status, 'PENDING');

    const priorityLevel = (
      (incident?.incident_types as any)?.priority_level ||
      row.priority_level ||
      row.priority ||
      'URGENT'
    ).toUpperCase();

    const isUrgent = priorityLevel === 'URGENT' || priorityLevel.includes('CRITICAL') || priorityLevel.includes('HIGH');
    const isRead = deliveryStatus.toLowerCase() === 'read' || deliveryStatus.toLowerCase() === 'delivered';

    const formattedTitle = rawType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    results.push({
      id,
      notification_id: id,
      incidentId: incidentId === '—' ? '' : incidentId,
      type: rawType,
      title: formattedTitle,
      message: rawMessage,
      sentAt,
      status: deliveryStatus,
      priority_level: priorityLevel,
      priority: isUrgent ? 'critical' : 'minor',
      isCritical: isUrgent,
      isRead,
      incident,
    });
  }

  return results;
}