import type { components } from './schema'

/** Nombres cortos para los tipos del contrato. Todo sale de `schema.d.ts` (generado): no se escribe a mano. */
type S = components['schemas']

export type Me = S['MeView']
export type Membership = S['Membership']
export type Business = S['BusinessView']
export type Overview = S['Overview']
export type Product = S['ProductView']
