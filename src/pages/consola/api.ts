import { call, client } from '../../api/http'
import type { components } from '../../api/schema'

type S = components['schemas']

export type Metrics = S['PlatformMetrics']
export type BusinessRow = S['PlatformBusinessRow']
export type BusinessDetail = S['PlatformBusinessDetail']
export type UserRow = S['PlatformUserRow']
export type DeviceRow = S['PlatformDeviceRow']
export type TicketRow = S['PlatformTicketRow']
export type AuditEntry = S['PlatformAuditEntry']
export type Announcement = S['AnnouncementView']
export type AnnouncementInput = S['AnnouncementInput']
export type Segment = S['AnnouncementSegment']
export type PlanChange = Omit<S['PlatformPlanRequest'], 'reason'>

export const getMetrics = () => call(client.GET('/api/platform/metrics'))

export const listBusinesses = (q: { q?: string; plan?: string; country?: string; status?: string; page: number; size: number }) =>
  call(client.GET('/api/platform/businesses', { params: { query: { ...q, q: q.q || undefined, plan: q.plan || undefined, country: q.country || undefined, status: q.status || undefined } } }))

export const getBusiness = (id: string) => call(client.GET('/api/platform/businesses/{id}', { params: { path: { id } } }))

export const changePlan = (id: string, body: PlanChange, reason: string) =>
  call(client.PUT('/api/platform/businesses/{id}/plan', { params: { path: { id } }, body: { ...body, reason } }))

export const extendTrial = (id: string, days: number, reason: string) =>
  call(client.POST('/api/platform/businesses/{id}/extend-trial', { params: { path: { id } }, body: { days, reason } }))

export const suspend = (id: string, reason: string) => call(client.POST('/api/platform/businesses/{id}/suspend', { params: { path: { id } }, body: { reason } }))
export const unsuspend = (id: string, reason: string) => call(client.POST('/api/platform/businesses/{id}/unsuspend', { params: { path: { id } }, body: { reason } }))
export const markDeletion = (id: string, reason: string) => call(client.POST('/api/platform/businesses/{id}/mark-deletion', { params: { path: { id } }, body: { reason } }))
export const viewAs = (id: string, reason: string) => call(client.POST('/api/platform/businesses/{id}/view-as', { params: { path: { id } }, body: { reason } }))

export const setFlag = (id: string, key: string, enabled: boolean, reason: string) =>
  call(client.PUT('/api/platform/businesses/{id}/flags', { params: { path: { id } }, body: { key, enabled, reason } }))

export const searchUsers = (q: string) => call(client.GET('/api/platform/users', { params: { query: { q } } }))

export const listDevices = (staleDays?: number, belowVersion?: string) =>
  call(client.GET('/api/platform/devices', { params: { query: { staleDays, belowVersion: belowVersion || undefined } } }))

export const listTickets = (status: string | undefined, page: number, size: number) =>
  call(client.GET('/api/platform/tickets', { params: { query: { status, page, size } } }))

export const setTicketStatus = (id: string, status: string) =>
  call(client.PUT('/api/platform/tickets/{id}/status', { params: { path: { id } }, body: { status } }))

export const getConfig = () => call(client.GET('/api/platform/config'))

export const setConfig = (key: string, value: string, reason: string) => call(client.PUT('/api/platform/config', { body: { key, value, reason } }))

export const listAudit = (page: number, size: number) => call(client.GET('/api/platform/audit', { params: { query: { page, size } } }))

export const listAnnouncements = () => call(client.GET('/api/platform/announcements'))
export const createAnnouncement = (body: AnnouncementInput) => call(client.POST('/api/platform/announcements', { body }))
export const announcementReach = (segment: Segment, audience: string) => call(client.POST('/api/platform/announcements/reach', { body: { segment, audience } }))

export const cancelAnnouncement = (id: string) => call(client.POST('/api/platform/announcements/{id}/cancel', { params: { path: { id } } }))
export const endBanner = (id: string) => call(client.POST('/api/platform/announcements/{id}/end-banner', { params: { path: { id } } }))
