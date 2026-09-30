import { call, client } from '../../api/http'
import type { components } from '../../api/schema'

type S = components['schemas']

export type Member = S['MemberView']
export type Device = S['DeviceView']

export type Role = 'ADMIN' | 'CASHIER'

export function listMembers(businessId: string): Promise<Member[]> {
  return call(client.GET('/api/b/{businessId}/members', { params: { path: { businessId } } })) as Promise<Member[]>
}

export type NewMember = S['CreateMemberRequest']

export function createMember(businessId: string, body: NewMember): Promise<Member> {
  return call(client.POST('/api/b/{businessId}/members', { params: { path: { businessId } }, body })) as Promise<Member>
}

export type MemberPatch = { displayName?: string; role?: Role; status?: 'ACTIVE' | 'DISABLED'; color?: string }

export function updateMember(businessId: string, memberId: string, body: MemberPatch): Promise<Member> {
  return call(client.PUT('/api/b/{businessId}/members/{memberId}', { params: { path: { businessId, memberId } }, body })) as Promise<Member>
}

export function resetPin(businessId: string, memberId: string, pin: string, mustChangePin: boolean): Promise<void> {
  return call(client.PUT('/api/b/{businessId}/members/{memberId}/pin', { params: { path: { businessId, memberId } }, body: { pin, mustChangePin } })) as Promise<void>
}

export function listDevices(businessId: string): Promise<Device[]> {
  return call(client.GET('/api/b/{businessId}/devices', { params: { path: { businessId } } })) as Promise<Device[]>
}

export function revokeDevice(businessId: string, deviceId: string): Promise<void> {
  return call(client.DELETE('/api/b/{businessId}/devices/{deviceId}', { params: { path: { businessId, deviceId } } })) as Promise<void>
}

export function renewAccessCode(businessId: string): Promise<{ accessCode: string }> {
  return call(client.POST('/api/b/{businessId}/access-code', { params: { path: { businessId } } })) as Promise<{ accessCode: string }>
}

export function setAccessCode(businessId: string, accessCode: string): Promise<{ accessCode: string }> {
  return call(client.PUT('/api/b/{businessId}/access-code', { params: { path: { businessId } }, body: { accessCode } })) as Promise<{ accessCode: string }>
}
