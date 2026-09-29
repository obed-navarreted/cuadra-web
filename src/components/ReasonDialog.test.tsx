import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/http'
import { setLocale } from '../i18n'
import '../test/renderPanel'
import { ReasonDialog } from './ReasonDialog'

describe('ReasonDialog', () => {
  beforeEach(async () => {
    await setLocale('es')
  })

  it('con motivo obligatorio no deja confirmar en blanco y lo entrega recortado', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<ReasonDialog open title="Reabrir" confirmLabel="Reabrir turno" required onConfirm={onConfirm} onClose={onClose} />)
    const confirm = screen.getByRole('button', { name: 'Reabrir turno' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: '  se contó mal  ' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('se contó mal'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('si la acción falla muestra el error dentro del diálogo y no lo cierra', async () => {
    const onClose = vi.fn()
    render(
      <ReasonDialog
        open
        title="Anular"
        confirmLabel="Anular"
        onConfirm={() => Promise.reject(new ApiError(409, 'EXPENSE_LINKED', 'x'))}
        describe={(e) => (e instanceof ApiError && e.code === 'EXPENSE_LINKED' ? 'Anula el pago desde Compras' : null)}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Anula el pago desde Compras')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('un error sin texto propio usa el mensaje genérico traducido, nunca el del servidor', async () => {
    render(<ReasonDialog open title="Anular" confirmLabel="Anular" onConfirm={() => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'Error interno del servidor'))} onClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Algo salió mal')
    expect(alert).not.toHaveTextContent('Error interno del servidor')
  })
})
