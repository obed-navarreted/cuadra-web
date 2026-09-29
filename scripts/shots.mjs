// Capturas del panel con el Chrome del sistema, para revisar cada pantalla a 360 px y a escritorio.
// Uso: node scripts/shots.mjs <urlBase> <token> <carpetaSalida> [ruta ...]
//   ej.: node scripts/shots.mjs http://localhost:5173 e2e-owner-token /tmp/shots /resumen /ventas
// Imprime también los errores de la consola y las llamadas a la API que fallaron: una pantalla que "se ve bien" pero llamó mal se nota aquí.
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const [, , base, token, out, ...routes] = process.argv
if (!base || !token || !out) {
  console.error('Uso: node scripts/shots.mjs <urlBase> <token> <carpetaSalida> [ruta ...]')
  process.exit(2)
}
mkdirSync(out, { recursive: true })
const paths = routes.length ? routes : ['/resumen']
const sizes = [
  { name: 'm', width: 360, height: 800, deviceScaleFactor: 2 },
  { name: 'd', width: 1280, height: 900, deviceScaleFactor: 1 },
]
const lang = process.env.SHOT_LANG ?? 'es'

const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-gpu'] })
let problems = 0
try {
  for (const size of sizes) {
    const page = await browser.newPage()
    await page.setViewport(size)
    await page.evaluateOnNewDocument((t, l) => {
      localStorage.setItem('cuadra.session', JSON.stringify({ token: t }))
      localStorage.setItem('cuadra.locale', l)
    }, token, lang)
    const failures = []
    page.on('console', (m) => m.type() === 'error' && failures.push(`consola: ${m.text()}`))
    page.on('pageerror', (e) => failures.push(`excepción: ${e.message}`))
    page.on('response', (r) => r.url().includes('/api/') && r.status() >= 400 && failures.push(`API ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`))
    for (const p of paths) {
      failures.length = 0
      await page.goto(base + p, { waitUntil: 'networkidle0' })
      await new Promise((r) => setTimeout(r, 300))
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      const file = `${out}/${p.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'home'}-${size.name}.png`
      await page.screenshot({ path: file, fullPage: true })
      const notes = [...failures, ...(overflow ? ['la página se desborda a los lados'] : [])]
      problems += notes.length
      console.log(`${notes.length ? '✗' : '✓'} ${size.name} ${p} → ${file}${notes.length ? '\n    ' + notes.join('\n    ') : ''}`)
    }
    await page.close()
  }
} finally {
  await browser.close()
}
process.exit(problems ? 1 : 0)
