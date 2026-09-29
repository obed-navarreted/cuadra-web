/**
 * Protección básica contra clickjacking cuando no se pueden enviar cabeceras HTTP (GitHub Pages no permite `frame-ancestors`):
 * si la página está dentro de un marco ajeno, se oculta la app y se muestra un aviso. No sustituye a la cabecera (ver README).
 * Comparar `window.top` con `window.self` es válido aunque el marco sea de otro origen.
 */
export function isFramed(win: Window = window): boolean {
  try {
    return win.top !== win.self
  } catch {
    return true
  }
}

/** Devuelve `true` si estaba enmarcada (y ya sustituyó el contenido por el aviso): quien llama no debe montar la app. */
export function guardFraming(win: Window = window, doc: Document = document): boolean {
  if (!isFramed(win)) return false
  const root = doc.getElementById('root')
  if (root) root.hidden = true
  const notice = doc.createElement('main')
  notice.setAttribute('role', 'alert')
  notice.style.cssText = 'font-family:sans-serif;max-width:440px;margin:64px auto;padding:0 20px'
  const link = doc.createElement('a')
  link.href = win.location.href
  link.target = '_top'
  link.rel = 'noopener'
  link.textContent = win.location.href
  const p = doc.createElement('p')
  p.textContent = 'Por seguridad, Cuadra no se puede usar dentro de otra página. Ábrelo directamente / For security, Cuadra cannot be used inside another page. Open it directly: '
  p.appendChild(link)
  notice.appendChild(p)
  doc.body.appendChild(notice)
  return true
}
