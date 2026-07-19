import {
  Animal,
  AnimalMarker,
  AppNotification,
  BehaviourSeries,
  CalloutRequest,
  DashboardSummary,
  Device,
  Invoice,
  Location,
  Plan,
  TeamMember,
  User,
  UserRole,
  Vet,
} from './types';

export const userRoles: UserRole[] = [
  { key: 1, name: 'Administrator', code: 'admin' },
  { key: 2, name: 'Farmer', code: 'farmer' },
  { key: 3, name: 'Veterinarian', code: 'veterinary' },
  { key: 4, name: 'Viewer', code: 'viewer' },
];

export const teamMembers: TeamMember[] = [
  { userId: 1, firstName: 'Alice', lastName: 'Kagawa', email: 'alice@ngaren.com', role: 'Administrator', roleKey: 1 },
  { userId: 2, firstName: 'Patrick', lastName: 'Etyang', email: 'patrick@ngaren.com', role: 'Farmer', roleKey: 2 },
  { userId: 3, firstName: 'Dr. Sarah', lastName: 'Mwangi', email: 'sarah@ngaren.com', role: 'Veterinarian', roleKey: 3 },
  { userId: 4, firstName: 'Pam', lastName: 'Karanja', email: 'pam@ngaren.com', role: 'Viewer', roleKey: 4 },
];

export const summary: DashboardSummary = {
  animals: 48,
  devices: 32,
  locations: 12,
  users: 4,
  allocation: { allocated: 28, free: 4 },
  connectivity: { connected: 42, unconnected: 6 },
};

export const locations: Location[] = [
  { id: 1, name: 'North Paddock', address: 'Lot 4, Nakasero', sizeHa: 42, animalCount: 12, kind: 'paddock' },
  { id: 2, name: 'Water Point A', address: 'Lot 7, Nakasero', sizeHa: 2, animalCount: 5, kind: 'water' },
  { id: 3, name: 'South Paddock', address: 'Lot 9, Nakasero', sizeHa: 38, animalCount: 18, kind: 'paddock' },
  { id: 4, name: 'Holding Yard', address: 'Lot 1, Nakasero', sizeHa: 1, animalCount: 3, kind: 'yard' },
];

export const animals: Animal[] = [
  {
    id: 1,
    tag: 'A-042',
    name: 'Bull #A-042',
    breed: { key: 'hereford', name: 'Hereford' },
    locationId: 1,
    locationName: 'North Paddock',
    deviceId: 1,
    deviceSerial: 'CRS-00142',
    dateOfBirth: '2022-03-12',
    status: 'active',
    description: 'Lead bull of the north herd.',
  },
  {
    id: 2,
    tag: 'A-017',
    name: 'Cow #A-017',
    breed: { key: 'ankole', name: 'Ankole' },
    locationId: 2,
    locationName: 'Water Point A',
    deviceId: null as unknown as number,
    deviceSerial: null,
    dateOfBirth: '2021-07-05',
    status: 'active',
  },
  {
    id: 3,
    tag: 'A-061',
    name: 'Heifer #A-061',
    breed: { key: 'boran', name: 'Boran' },
    locationId: 3,
    locationName: 'South Paddock',
    deviceId: 3,
    deviceSerial: 'CRS-00187',
    dateOfBirth: '2023-01-22',
    status: 'active',
  },
  {
    id: 4,
    tag: 'A-008',
    name: 'Cow #A-008',
    breed: { key: 'friesian', name: 'Friesian' },
    locationId: 1,
    locationName: 'North Paddock',
    deviceId: 4,
    deviceSerial: 'CRS-00203',
    dateOfBirth: '2020-11-30',
    status: 'inactive',
  },
];

export const devices: Device[] = [
  {
    id: 1,
    serial: 'CRS-00142',
    model: 'Pro',
    family: 'Gen 2',
    brand: 'Ceres Tag',
    firmware: 'v3.2.1',
    chargeType: 'Solar',
    activatedAt: '2024-01-01',
    temperatureC: 26,
    linkedAnimalId: 1,
    linkedAnimalTag: 'Bull #A-042',
  },
  {
    id: 3,
    serial: 'CRS-00187',
    model: 'Lite',
    family: 'Gen 2',
    brand: 'Ceres Tag',
    firmware: 'v3.1.0',
    chargeType: 'Solar',
    activatedAt: '2024-03-03',
    temperatureC: 2,
    linkedAnimalId: 3,
    linkedAnimalTag: 'Heifer #A-061',
  },
  {
    id: 5,
    serial: 'CRS-00210',
    model: 'Pro',
    family: 'Gen 2',
    brand: 'Ceres Tag',
    firmware: 'v3.2.1',
    chargeType: 'Solar',
    activatedAt: '2024-04-18',
    temperatureC: 41,
    linkedAnimalId: null,
    linkedAnimalTag: null,
  },
];

export const users: User[] = [
  { id: 1, fullName: 'Alice Kagawa', email: 'alice@ngaren.com', role: 'Admin' },
  { id: 2, fullName: 'Mark Bauer', email: 'mark@ngaren.com', role: 'Viewer' },
  { id: 3, fullName: 'James Otieno', email: 'james@ngaren.com', role: 'Operator' },
  { id: 4, fullName: 'Pam Karanja', email: 'pam@ngaren.com', role: 'Viewer' },
];

export const notifications: AppNotification[] = [
  { id: 1, category: 'device', title: 'Device Activity', message: 'CRS-00142 low battery', timestamp: '2 hours ago', unread: true },
  { id: 2, category: 'boundary', title: 'Animal Outside Boundary', message: 'Bull #A-042 left North Paddock', timestamp: '5 hours ago', unread: true },
  { id: 3, category: 'device', title: 'Device Activity', message: 'CRS-00187 signal lost', timestamp: 'Yesterday, 3:42 PM', unread: false },
];

export const markers: AnimalMarker[] = [
  { animalId: 1, tag: 'Bull #A-042', lat: 0.3476, lng: 32.5825, accuracy: 'Good', lastSeenMins: 5, status: 'active', provider: 'Ceres Tag' },
  { animalId: 3, tag: 'Heifer #A-061', lat: 0.3461, lng: 32.5841, accuracy: 'Fair', lastSeenMins: 12, status: 'active', provider: 'Ceres Tag' },
  { animalId: 4, tag: 'Cow #A-008', lat: 0.3489, lng: 32.5809, accuracy: 'Poor', lastSeenMins: 47, status: 'inactive', provider: 'Digitanimal' },
];

/** Geofence boundaries (lat/lng rings) drawn on the live track map. */
export interface Geofence {
  id: number;
  name: string;
  ring: { lat: number; lng: number }[];
}

export const geofences: Geofence[] = [
  {
    id: 1,
    name: 'North Paddock',
    ring: [
      { lat: 0.3495, lng: 32.5805 },
      { lat: 0.3495, lng: 32.5835 },
      { lat: 0.3468, lng: 32.5838 },
      { lat: 0.3466, lng: 32.5808 },
    ],
  },
  {
    id: 3,
    name: 'South Paddock',
    ring: [
      { lat: 0.3466, lng: 32.5828 },
      { lat: 0.3466, lng: 32.5852 },
      { lat: 0.3452, lng: 32.5852 },
      { lat: 0.3452, lng: 32.5828 },
    ],
  },
];

const series = (label: string, unit: string, base: number, spread: number): BehaviourSeries => {
  const actual = Array.from({ length: 14 }, (_, i) =>
    Math.round(base + Math.sin(i / 2) * spread + (i % 3) * (spread / 4)),
  );
  const pfi = actual.map((v) => Math.round(v * 0.92));
  return { label, unit, actual, pfi };
};

export const behaviourSeries: BehaviourSeries[] = [
  series('Grazing Minutes', 'min', 380, 60),
  series('Resting Minutes', 'min', 540, 80),
  series('Walking Minutes', 'min', 120, 40),
  series('Drinking Minutes', 'min', 35, 12),
  series('Methane Production', 'g/day', 210, 30),
  series('Dry Matter Intake', 'kg/day', 12, 3),
];

export const breeds = ['Hereford', 'Ankole', 'Boran', 'Friesian', 'Sahiwal'];

export const calloutRequests: CalloutRequest[] = [
  { id: 1, farmerName: 'Patrick Etyang', animal: 'Bull #A-042', locationName: 'North Paddock', distanceKm: 2.4, urgency: 'Emergency', notes: 'Visible limp on the front left leg, not grazing.', requestedAt: '10 min ago', status: 'pending' },
  { id: 2, farmerName: 'Grace Wanjiru', animal: 'Cow #A-017', locationName: 'Water Point A', distanceKm: 5.1, urgency: 'Soon', notes: 'Reduced milk yield over the last 3 days.', requestedAt: '40 min ago', status: 'pending' },
  { id: 3, farmerName: 'Daniel Mwangi', animal: 'Heifer #A-061', locationName: 'South Paddock', distanceKm: 8.3, urgency: 'Routine', notes: 'Routine pregnancy check.', requestedAt: '2 hours ago', status: 'accepted' },
  { id: 4, farmerName: 'Esther Achieng', animal: 'Cow #A-008', locationName: 'Holding Yard', distanceKm: 11.6, urgency: 'Routine', notes: 'Annual vaccination due.', requestedAt: 'Yesterday', status: 'completed' },
];

export const plans: Plan[] = [
  { id: 'basic', name: 'Basic', priceLabel: 'UGX 0', cadence: '/month', devicesIncluded: 1, features: ['1 device', 'Boundary alerts', 'Email notifications'] },
  { id: 'pro', name: 'Pro', priceLabel: 'UGX 45,000', cadence: '/month', devicesIncluded: 25, features: ['Up to 25 devices', 'Device + boundary alerts', 'Email & SMS', 'Vet call-outs'] },
  { id: 'enterprise', name: 'Enterprise', priceLabel: 'Custom', cadence: '', devicesIncluded: 100, features: ['Unlimited devices', 'Priority support', 'API access', 'Dedicated manager'] },
];

export const currentPlanId = 'pro';

export const invoices: Invoice[] = [
  { id: 1, date: '01 Jun 2026', amount: 'UGX 45,000', status: 'Paid' },
  { id: 2, date: '01 May 2026', amount: 'UGX 45,000', status: 'Paid' },
  { id: 3, date: '01 Apr 2026', amount: 'UGX 45,000', status: 'Paid' },
];

export const vets: Vet[] = [
  { id: 1, name: 'Dr. Sarah Mwangi', clinic: 'Nakuru Animal Clinic', specialty: 'Large animal / Cattle', distanceKm: 2.4, rating: 4.9, reviews: 128, available: true },
  { id: 2, name: 'Dr. John Kamau', clinic: 'Rift Valley Vet Services', specialty: 'General practice', distanceKm: 5.1, rating: 4.7, reviews: 86, available: true },
  { id: 3, name: 'Dr. Aisha Noor', clinic: 'Highlands Livestock Care', specialty: 'Reproduction', distanceKm: 8.3, rating: 4.8, reviews: 64, available: false },
  { id: 4, name: 'Dr. Peter Otieno', clinic: 'Savannah Mobile Vets', specialty: 'Emergency / Field calls', distanceKm: 11.6, rating: 4.6, reviews: 152, available: true },
];
