import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ApiError, call, client } from '../api/http'
import type { Business, Me } from '../api/types'
import { Ctx, type AuthValue } from './context'
import { clearSession, getToken, rememberUser, saveBusiness, savedBusiness, setToken, subscribe } from './session'


export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribe, getToken)
  const [me, setMe] = useState<Me | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Solo en desarrollo: `?devToken=…` entra con un token de la API (para probar sin cliente de Google).
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const url = new URL(window.location.href)
    const dev = url.searchParams.get('devToken')
    if (dev) {
      setToken(dev)
      url.searchParams.delete('devToken')
      window.history.replaceState(null, '', url)
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setMe(null)
      setBusiness(null)
      setBusinessId(null)
      setLoaded(true)
      return
    }
    let cancelled = false
    setLoaded(false)
    // Un token nuevo es otra sesión (otra cuenta, o "Ver como"): nada de la anterior (perfil, negocio elegido, datos del negocio) queda a la vista mientras carga.
    setMe(null)
    setBusiness(null)
    setBusinessId(null)
    void (async () => {
      try {
        const profile = await call(client.GET('/api/me'))
        if (cancelled) return
        if (profile.id) rememberUser(profile.id)
        setMe(profile)
        const list = profile.businesses ?? []
        const saved = savedBusiness()
        setBusinessId((list.find((m) => m.businessId === saved) ?? list[0])?.businessId ?? null)
        setError(null)
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) clearSession()
        else setError(e instanceof ApiError ? e.code : 'generic')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  // Una respuesta que llega tarde de un negocio que ya no es el elegido no se guarda (el último negocio pedido es el único que cuenta).
  const latestBusiness = useRef<string | null>(null)
  const loadBusiness = useCallback(async (id: string) => {
    latestBusiness.current = id
    const loaded = await call(client.GET('/api/b/{businessId}', { params: { path: { businessId: id } } }))
    if (latestBusiness.current === id) setBusiness(loaded)
  }, [])

  useEffect(() => {
    if (!businessId) {
      setBusiness(null)
      return
    }
    let cancelled = false
    loadBusiness(businessId).catch((e) => {
      if (!cancelled) setError(e instanceof ApiError ? e.code : 'generic')
    })
    return () => {
      cancelled = true
    }
  }, [businessId, loadBusiness])

  const memberships = useMemo(() => me?.businesses ?? [], [me])
  const membership = memberships.find((m) => m.businessId === businessId) ?? null
  const role = membership?.role

  const value = useMemo<AuthValue>(
    () => ({
      status: !loaded ? 'loading' : token && me ? 'ready' : 'signedOut',
      me,
      memberships,
      membership,
      business: business && business.id === businessId ? business : null,
      canUsePanel: role === 'OWNER' || role === 'ADMIN',
      isOwner: role === 'OWNER',
      error,
      selectBusiness: (id) => {
        saveBusiness(id)
        setBusiness(null)
        setBusinessId(id)
      },
      reloadBusiness: async () => {
        if (businessId) await loadBusiness(businessId)
      },
      signInWithGoogle: async (idToken) => {
        setError(null)
        try {
          const res = await call(client.POST('/api/auth/google', { body: { idToken, kind: 'WEB' } }))
          if (res.token) setToken(res.token)
        } catch (e) {
          setError(e instanceof ApiError ? e.code : 'generic')
        }
      },
      signInWithPlatform: async (username, password) => {
        setError(null)
        try {
          const res = await call(client.POST('/api/auth/platform', { body: { username, password } }))
          if (!res.token) throw new ApiError(0, 'generic', '')
          setToken(res.token)
          return true
        } catch (e) {
          setError(e instanceof ApiError ? e.code : 'generic')
          return false
        }
      },
      signInWithToken: async (t) => {
        setError(null)
        setToken(t.trim())
      },
      signOut: async () => {
        try {
          await call(client.POST('/api/auth/logout'))
        } catch {
          /* aunque la API no conteste, la sesión local se cierra */
        }
        clearSession()
      },
    }),
    [loaded, token, me, memberships, membership, business, businessId, role, error, loadBusiness],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
