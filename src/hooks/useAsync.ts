import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncState<T> = { data: T | undefined; error: Error | null; loading: boolean; reload: () => void }

/**
 * Carga un dato y lo vuelve a cargar cuando cambian las dependencias. Una respuesta vieja (de antes de cambiar el filtro) nunca pisa a la nueva.
 * Mientras recarga conserva el dato anterior para que la pantalla no parpadee.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const latest = useRef(0)
  const loader = useRef(load)
  loader.current = load

  useEffect(() => {
    const mine = ++latest.current
    setLoading(true)
    loader.current().then(
      (value) => {
        if (latest.current !== mine) return
        setData(value)
        setError(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (latest.current !== mine) return
        setError(e instanceof Error ? e : new Error(String(e)))
        setLoading(false)
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { data, error, loading, reload }
}
