export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'pending' | 'assigned' | 'responding' | 'resolved';
export type ResponderStatus = 'available' | 'assigned' | 'responding' | 'offline';

export interface Incident {
  id: string;
  type: string;
  reporterName: string;
  building: string;
  location: string;
  timeReported: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reportedAt?: string;
  assignedResponder?: string;
  description: string;
  imageUrl?: string;
  gpsCoords: { lat: number; lng: number };
}

export interface Responder {
  id: string;
  name: string;
  role: string;
  status: ResponderStatus;
  assignedIncident?: string;
  eta?: string;
  avatar?: string;
}

export interface IncidentLog {
  id: string;
  incidentType: string;
  reporter: string;
  building: string;
  date: string;
  time: string;
  status: IncidentStatus;
  respondedBy: string;
  responseTime: string;
}

export const mockIncidents: Incident[] = [
  {
    id: 'INC-001',
    type: 'Cardiac Emergency',
    reporterName: 'Maria Santos',
    building: 'Engineering Building',
    location: 'Room 301',
    timeReported: '2 min ago',
    severity: 'critical',
    status: 'assigned',
    assignedResponder: 'Dr. Juan dela Cruz',
    description: 'Student experiencing chest pain and difficulty breathing',
    gpsCoords: { lat: 8.4857, lng: 124.6565 }
  },
  {
    id: 'INC-002',
    type: 'Fall/Injury',
    reporterName: 'John Reyes',
    building: 'Science Building',
    location: 'Hallway 2F',
    timeReported: '5 min ago',
    severity: 'high',
    status: 'responding',
    assignedResponder: 'Nurse Anna Lopez',
    description: 'Student slipped on stairs, possible sprain',
    gpsCoords: { lat: 8.4862, lng: 124.6570 }
  },
  {
    id: 'INC-003',
    type: 'Seizure',
    reporterName: 'Prof. Garcia',
    building: 'Main Building',
    location: 'Classroom 105',
    timeReported: '8 min ago',
    severity: 'critical',
    status: 'pending',
    description: 'Student having seizure during class',
    gpsCoords: { lat: 8.4855, lng: 124.6560 }
  },
  {
    id: 'INC-004',
    type: 'Allergic Reaction',
    reporterName: 'Sarah Tan',
    building: 'Cafeteria',
    location: 'Food Court Area',
    timeReported: '12 min ago',
    severity: 'high',
    status: 'assigned',
    assignedResponder: 'Dr. Maria Flores',
    description: 'Student experiencing severe allergic reaction to food',
    gpsCoords: { lat: 8.4860, lng: 124.6558 }
  },
  {
    id: 'INC-005',
    type: 'Minor Injury',
    reporterName: 'Mark Gonzales',
    building: 'Gymnasium',
    location: 'Basketball Court',
    timeReported: '20 min ago',
    severity: 'low',
    status: 'resolved',
    assignedResponder: 'Nurse Peter Ramos',
    description: 'Minor cut during basketball practice',
    gpsCoords: { lat: 8.4865, lng: 124.6563 }
  }
];

export const mockResponders: Responder[] = [
  {
    id: 'RESP-001',
    name: 'Dr. Juan dela Cruz',
    role: 'Emergency Physician',
    status: 'assigned',
    assignedIncident: 'INC-001',
    eta: '2 min'
  },
  {
    id: 'RESP-002',
    name: 'Nurse Anna Lopez',
    role: 'Emergency Nurse',
    status: 'responding',
    assignedIncident: 'INC-002',
    eta: '1 min'
  },
  {
    id: 'RESP-003',
    name: 'Dr. Maria Flores',
    role: 'Emergency Physician',
    status: 'assigned',
    assignedIncident: 'INC-004',
    eta: '3 min'
  },
  {
    id: 'RESP-004',
    name: 'Nurse Peter Ramos',
    role: 'Emergency Nurse',
    status: 'available'
  },
  {
    id: 'RESP-005',
    name: 'Dr. Sarah Mendoza',
    role: 'Emergency Physician',
    status: 'available'
  },
  {
    id: 'RESP-006',
    name: 'Nurse Carlos Reyes',
    role: 'Emergency Nurse',
    status: 'offline'
  }
];

export const mockIncidentLogs: IncidentLog[] = [
  {
    id: 'LOG-001',
    incidentType: 'Cardiac Emergency',
    reporter: 'Maria Santos',
    building: 'Engineering Building',
    date: '2026-05-25',
    time: '14:30',
    status: 'assigned',
    respondedBy: 'Dr. Juan dela Cruz',
    responseTime: '2 min'
  },
  {
    id: 'LOG-002',
    incidentType: 'Fall/Injury',
    reporter: 'John Reyes',
    building: 'Science Building',
    date: '2026-05-25',
    time: '14:27',
    status: 'responding',
    respondedBy: 'Nurse Anna Lopez',
    responseTime: '3 min'
  },
  {
    id: 'LOG-003',
    incidentType: 'Minor Injury',
    reporter: 'Mark Gonzales',
    building: 'Gymnasium',
    date: '2026-05-25',
    time: '14:12',
    status: 'resolved',
    respondedBy: 'Nurse Peter Ramos',
    responseTime: '4 min'
  },
  {
    id: 'LOG-004',
    incidentType: 'Headache',
    reporter: 'Lisa Chen',
    building: 'Library',
    date: '2026-05-25',
    time: '13:45',
    status: 'resolved',
    respondedBy: 'Dr. Sarah Mendoza',
    responseTime: '5 min'
  },
  {
    id: 'LOG-005',
    incidentType: 'Allergic Reaction',
    reporter: 'Kevin Torres',
    building: 'Cafeteria',
    date: '2026-05-25',
    time: '12:30',
    status: 'resolved',
    respondedBy: 'Dr. Maria Flores',
    responseTime: '3 min'
  },
  {
    id: 'LOG-006',
    incidentType: 'Asthma Attack',
    reporter: 'Emma Rodriguez',
    building: 'Main Building',
    date: '2026-05-25',
    time: '11:20',
    status: 'resolved',
    respondedBy: 'Nurse Anna Lopez',
    responseTime: '4 min'
  },
  {
    id: 'LOG-007',
    incidentType: 'Fainting',
    reporter: 'Ryan Cruz',
    building: 'Engineering Building',
    date: '2026-05-25',
    time: '10:15',
    status: 'resolved',
    respondedBy: 'Dr. Juan dela Cruz',
    responseTime: '6 min'
  },
  {
    id: 'LOG-008',
    incidentType: 'Sprain',
    reporter: 'Nicole Bautista',
    building: 'Gymnasium',
    date: '2026-05-25',
    time: '09:30',
    status: 'resolved',
    respondedBy: 'Nurse Peter Ramos',
    responseTime: '5 min'
  }
];

export const analyticsData = {
  dailyIncidents: [
    { day: 'Mon', count: 12 },
    { day: 'Tue', count: 15 },
    { day: 'Wed', count: 8 },
    { day: 'Thu', count: 18 },
    { day: 'Fri', count: 14 },
    { day: 'Sat', count: 6 },
    { day: 'Sun', count: 4 }
  ],
  incidentTypes: [
    { type: 'Fall/Injury', count: 25 },
    { type: 'Headache', count: 18 },
    { type: 'Minor Injury', count: 15 },
    { type: 'Allergic Reaction', count: 12 },
    { type: 'Cardiac Emergency', count: 8 }
  ],
  responseTimeData: [
    { hour: '8AM', time: 4.2 },
    { hour: '10AM', time: 3.8 },
    { hour: '12PM', time: 5.1 },
    { hour: '2PM', time: 4.5 },
    { hour: '4PM', time: 3.9 },
    { hour: '6PM', time: 4.3 }
  ]
};
