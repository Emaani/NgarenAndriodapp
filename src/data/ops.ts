/**
 * Operations data — Incidents/SLA (admin) and Team Messaging (all roles).
 * Ported from the Command Center's IncidentsPage and MessagingPage. These are
 * presentation datasets on web too; the mobile app mirrors them and can be
 * pointed at live tables later without screen changes.
 */

export type IncidentStatus = 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
export type IncidentPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Incident {
  id: string;
  title: string;
  description: string;
  category: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  assignedTo: string;
  slaDeadline: string;
  location: string;
}

export interface ThreadMessage {
  sender: string;
  text: string;
  time: string;
  mine: boolean;
}

export interface Conversation {
  id: string;
  from: string;
  avatar: string;
  role: string;
  preview: string;
  time: string;
  unread: number;
  online: boolean;
  thread: ThreadMessage[];
}

const INCIDENTS: Incident[] = [
  { id: 'INC-001', title: 'Geofence Breach — North Paddock A', description: 'KE-0003 detected 200m outside boundary. Auto-alert triggered.', category: 'Geofence', status: 'open', priority: 'critical', assignedTo: 'Field Operations', slaDeadline: '2026-07-18 11:40', location: 'Nakuru Farm' },
  { id: 'INC-002', title: 'CeresTag NC-4421 — Battery Critical', description: 'Tag battery at 8%. Device may go offline within 2 hours.', category: 'Device', status: 'in_progress', priority: 'high', assignedTo: 'Device Support', slaDeadline: '2026-07-18 13:30', location: 'Nakuru Farm' },
  { id: 'INC-003', title: 'Regional Connectivity Outage — Meru Hills', description: 'LoRa gateway offline. 34 devices in Meru Hills not transmitting.', category: 'Outage', status: 'escalated', priority: 'critical', assignedTo: 'Infrastructure Team', slaDeadline: '2026-07-18 10:15', location: 'Meru Hills' },
  { id: 'INC-004', title: 'Health Score Anomaly — Rift Valley Herd', description: 'Average herd health dropped to 72%. Possible disease vector.', category: 'Health', status: 'in_progress', priority: 'high', assignedTo: 'Veterinary Team', slaDeadline: '2026-07-18 14:55', location: 'Rift Valley' },
  { id: 'INC-005', title: 'Multiple Tags Offline — Arusha Ranch', description: '12 tags stopped transmitting simultaneously. Investigating.', category: 'Outage', status: 'resolved', priority: 'medium', assignedTo: 'Infrastructure Team', slaDeadline: '2026-07-17 20:00', location: 'Arusha Ranch' },
];

const CONVERSATIONS: Conversation[] = [
  {
    id: 'm1', from: 'Allen Karungi', avatar: 'AK', role: 'Admin', online: true,
    preview: 'Health report for Nakuru is ready to review', time: '2m', unread: 3,
    thread: [
      { sender: 'Allen Karungi', text: 'Hey, I just uploaded the Nakuru Farm health analysis.', time: '09:12', mine: false },
      { sender: 'Allen Karungi', text: 'Health score dropped 4 points — Zebu herd at risk zone.', time: '09:13', mine: false },
      { sender: 'You', text: "Thanks Allen. I'll review it now. Did you flag it in the system?", time: '09:15', mine: true },
      { sender: 'Allen Karungi', text: 'Health report for Nakuru is ready to review.', time: '09:18', mine: false },
    ],
  },
  {
    id: 'm2', from: 'Dr. Sarah Mwangi', avatar: 'SM', role: 'Veterinarian', online: true,
    preview: 'Scheduled the vaccination round for Thursday', time: '1h', unread: 0,
    thread: [
      { sender: 'You', text: 'Dr. Mwangi, are we still on for the North Paddock vaccinations?', time: '08:02', mine: true },
      { sender: 'Dr. Sarah Mwangi', text: 'Yes — scheduled the vaccination round for Thursday morning.', time: '08:20', mine: false },
    ],
  },
  {
    id: 'm3', from: 'Field Operations', avatar: 'FO', role: 'Team', online: false,
    preview: 'Geofence breach on North Paddock A resolved', time: '3h', unread: 0,
    thread: [
      { sender: 'Field Operations', text: 'Retrieved the animal that breached North Paddock A.', time: '06:40', mine: false },
      { sender: 'Field Operations', text: 'Geofence breach on North Paddock A resolved.', time: '06:55', mine: false },
    ],
  },
];

export async function getIncidents(): Promise<Incident[]> {
  return INCIDENTS;
}

export async function getConversations(): Promise<Conversation[]> {
  return CONVERSATIONS;
}
