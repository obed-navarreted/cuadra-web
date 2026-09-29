import { useEffect, useRef, type ReactNode } from 'react'

/** Diálogo modal con el elemento nativo `<dialog>`: enfoque atrapado, Escape lo cierra y el fondo no responde. */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={title}>
      {open && (
        <div className="modal-body">
          <h2>{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  )
}
