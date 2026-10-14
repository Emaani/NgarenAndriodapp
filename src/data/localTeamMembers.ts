/**
 * Admin-added team members / users, persisted on-device (Oct 2026 admin
 * feedback). The platform-api createTeamMember is a no-op in mock mode, so
 * added users never appeared — this local store makes Team Management genuinely
 * functional: an admin adds a user with a role and it shows in the list
 * immediately. Becomes a write-through when the users backend lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TeamMember } from './types';

const KEY = 'ngaren.local.team.v1';

export async function getLocalTeamMembers(): Promise<TeamMember[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as TeamMember[]) : [];
  } catch {
    return [];
  }
}

export interface AddTeamMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  roleKey: number;
  role: string;
}

export async function addLocalTeamMember(input: AddTeamMemberInput): Promise<TeamMember> {
  const record: TeamMember = {
    userId: Date.now(),
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    role: input.role,
    roleKey: input.roleKey,
  };
  try {
    const all = await getLocalTeamMembers();
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...all]));
  } catch {
    // best-effort
  }
  return record;
}

export async function removeLocalTeamMember(userId: number): Promise<void> {
  try {
    const all = await getLocalTeamMembers();
    await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((m) => m.userId !== userId)));
  } catch {
    // best-effort
  }
}
