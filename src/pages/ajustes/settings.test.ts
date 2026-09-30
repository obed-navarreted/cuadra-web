import { describe, expect, it } from 'vitest'
import { MODULES, formOf, minorToInput, moduleOn, patchOf, previewTemplate, unknownVariables, validateForm, type BusinessView } from './settings'

const b: BusinessView = { id: 'b', name: 'Quesería', type: 'Lácteos', country: 'NI', currency: 'NIO', timezone: 'America/Managua', defaultLocale: 'es', dayCutoff: '02:00:00', posViews: ['TYPE'], creditRequiresCustomer: false, creditLimitEnforced: false, creditDefaultDueDays: 15, creditOverdueDays: 30, shiftRequired: false, shiftNoteThresholdMinor: 1000, modules: {}, currencyLocked: false }

describe('ajustes del negocio', () => {
  it('convierte la hora de corte y el umbral a lo que muestra el formulario', () => {
    const f = formOf(b)
    expect(f.dayCutoff).toBe('02:00')
    expect(f.shiftNote).toBe('10.00')
    expect(minorToInput(5, 'NIO')).toBe('0.05')
    expect(minorToInput(123456, 'NIO')).toBe('1234.56')
    expect(minorToInput(1500, 'CRC')).toBe('1500')
  })

  it('sin cambios no manda nada', () => {
    expect(patchOf(formOf(b), b)).toEqual({})
  })

  it('manda solo lo que cambió', () => {
    const f = { ...formOf(b), name: '  Quesería Norte ', creditLimitEnforced: true, timezone: 'America/New_York', creditOverdueDays: '45', posViews: ['LIST', 'TYPE'] }
    expect(patchOf(f, b)).toEqual({ name: 'Quesería Norte', creditLimitEnforced: true, timezone: 'America/New_York', creditOverdueDays: 45, posViews: ['LIST', 'TYPE'] })
  })

  it('un número vacío no se manda y el mismo orden de vistas no cuenta como cambio', () => {
    const f = { ...formOf(b), creditDefaultDueDays: '', shiftNote: '', posViews: ['TYPE'] }
    expect(patchOf(f, b)).toEqual({})
  })

  it('valida cada campo', () => {
    const ok = formOf(b)
    expect(validateForm(ok, 'NIO')).toBeNull()
    expect(validateForm({ ...ok, name: ' ' }, 'NIO')).toBe('NAME')
    expect(validateForm({ ...ok, dayCutoff: '25:00' }, 'NIO')).toBe('CUTOFF')
    expect(validateForm({ ...ok, posViews: [] }, 'NIO')).toBe('POS_VIEWS')
    expect(validateForm({ ...ok, creditDefaultDueDays: '-1' }, 'NIO')).toBe('DUE_DAYS')
    expect(validateForm({ ...ok, creditOverdueDays: '0' }, 'NIO')).toBe('OVERDUE_DAYS')
    expect(validateForm({ ...ok, shiftNote: '10.555' }, 'NIO')).toBe('SHIFT_NOTE')
    expect(MODULES).not.toContain('shifts')
  })

  it('un módulo sin valor guardado sigue la regla de fábrica', () => {
    expect(moduleOn({}, 'credit')).toBe(true)
    expect(moduleOn({}, 'inventory')).toBe(false)
    expect(moduleOn({}, 'shifts')).toBe(false)
    expect(moduleOn({ credit: false, shifts: true }, 'credit')).toBe(false)
    expect(moduleOn({ credit: false, shifts: true }, 'shifts')).toBe(true)
  })
})

describe('plantillas', () => {
  it('la vista previa reemplaza las variables conocidas y deja el resto', () => {
    expect(previewTemplate('Hola {cliente}, debes {monto} {otra}', { cliente: 'Marta', monto: 'C$ 10.00' })).toBe('Hola Marta, debes C$ 10.00 {otra}')
  })

  it('avisa de variables que no existen', () => {
    expect(unknownVariables('{cliente} {saldo} {inventada} {inventada} {dias}')).toEqual(['inventada'])
    expect(unknownVariables('sin variables')).toEqual([])
  })
})
