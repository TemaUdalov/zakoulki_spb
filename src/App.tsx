import { useEffect, useMemo, useState } from 'react'
import { PlacesMap } from './components/PlacesMap'
import { PlaceList } from './components/PlaceList'
import { PlaceCard } from './components/PlaceCard'
import { PlaceForm } from './components/PlaceForm'
import { AuthPanel } from './components/AuthPanel'
import { ProfilePanel } from './components/ProfilePanel'
import { NearbyPanel } from './components/NearbyPanel'
import { WalkPanel } from './components/WalkPanel'
import { SetupNotice } from './components/SetupNotice'
import { useSession } from './hooks/useSession'
import { fetchPlace, fetchPlaces } from './lib/places'
import { fetchMyReactions, reactionKey, setReaction } from './lib/social'
import { isConfigured, supabase } from './lib/supabase'
import { navigate, useHashRoute } from './lib/router'
import { loadWalk, MAX_STOPS, saveWalk, type WalkRoute } from './lib/walk'
import { errorMessage } from './lib/errors'
import {
  TAGS,
  type LatLng,
  type NearbyQuery,
  type Place,
  type ReactionKind,
  type TagId,
} from './lib/types'

/**
 * Что открыто поверх текущей страницы. Страница (место, профиль, прогулка…) живёт в адресе,
 * а формы — временные, их нет смысла сохранять в ссылке.
 */
type Mode = { kind: 'add' } | { kind: 'edit'; id: string } | { kind: 'auth' } | null

const NO_STOPS: LatLng[] = []

export default function App() {
  const session = useSession()
  const userId = session?.user.id ?? null
  const route = useHashRoute()

  const [places, setPlaces] = useState<Place[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [picked, setPicked] = useState<LatLng | null>(null)
  const [activeTags, setActiveTags] = useState<TagId[]>([])
  const [myReactions, setMyReactions] = useState<Set<string>>(() => new Set())
  const [walk, setWalk] = useState<string[]>(loadWalk)
  const [walkRoute, setWalkRoute] = useState<WalkRoute | null>(null)
  const [nearbyQuery, setNearbyQuery] = useState<NearbyQuery | null>(null)

  // ─── Загрузка данных ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isConfigured) return
    fetchPlaces()
      .then(setPlaces)
      .catch((e: unknown) => setLoadError(errorMessage(e)))
      .finally(() => setLoaded(true))
  }, [])

  // Реакции текущего пользователя — чтобы подсветить нажатые ♥ и «я тут был»
  useEffect(() => {
    if (!userId) {
      setMyReactions(new Set())
      return
    }
    fetchMyReactions(userId)
      .then(setMyReactions)
      .catch(() => setMyReactions(new Set()))
  }, [userId])

  // Прогулку сохраняем в браузере; при её изменении старый маршрут уже неверен
  useEffect(() => {
    saveWalk(walk)
    setWalkRoute(null)
  }, [walk])

  // Переход на другую страницу закрывает открытую форму
  useEffect(() => {
    setMode(null)
    setPicked(null)
  }, [route])

  // ─── Производные данные ────────────────────────────────────────────────────

  // Фильтр по тегам: показываем места, у которых есть хотя бы один выбранный тег
  const visiblePlaces = useMemo(
    () =>
      activeTags.length === 0
        ? places
        : places.filter((p) => p.tags.some((t) => activeTags.includes(t))),
    [places, activeTags],
  )

  const walkPlaces = useMemo(
    () =>
      walk
        .map((id) => places.find((p) => p.id === id))
        .filter((p): p is Place => p !== undefined),
    [walk, places],
  )

  const walkStops = useMemo(() => walkPlaces.map((p) => ({ lat: p.lat, lng: p.lng })), [walkPlaces])

  // ─── Действия ──────────────────────────────────────────────────────────────

  /** Перечитывает одно место из базы, чтобы обновились счётчики */
  async function refreshPlace(id: string) {
    const fresh = await fetchPlace(id)
    setPlaces((prev) => {
      if (!fresh) return prev.filter((p) => p.id !== id)
      return prev.some((p) => p.id === id)
        ? prev.map((p) => (p.id === id ? fresh : p))
        : [fresh, ...prev]
    })
  }

  function toggleTag(id: TagId) {
    setActiveTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  function openAuth() {
    setMode({ kind: 'auth' })
  }

  function closeMode() {
    setMode(null)
    setPicked(null)
  }

  function startAdding() {
    setPicked(null)
    setMode(session ? { kind: 'add' } : { kind: 'auth' })
  }

  function startEditing(place: Place) {
    setPicked({ lat: place.lat, lng: place.lng })
    setMode({ kind: 'edit', id: place.id })
  }

  async function handleSaved(id: string) {
    try {
      await refreshPlace(id)
    } catch {
      // Место сохранено, просто не удалось сразу его перечитать — не критично
    }
    closeMode()
    navigate(`/place/${id}`)
  }

  function handleDeleted(id: string) {
    setPlaces((prev) => prev.filter((p) => p.id !== id))
    setWalk((prev) => prev.filter((w) => w !== id))
    navigate('/')
  }

  async function handleReact(place: Place, kind: ReactionKind) {
    if (!userId) return openAuth()

    const key = reactionKey(place.id, kind)
    const on = !myReactions.has(key)
    try {
      await setReaction(place.id, kind, on, userId)
      setMyReactions((prev) => {
        const next = new Set(prev)
        if (on) next.add(key)
        else next.delete(key)
        return next
      })
      await refreshPlace(place.id)
    } catch (e) {
      alert(errorMessage(e))
    }
  }

  function toggleWalk(id: string) {
    setWalk((prev) => {
      if (prev.includes(id)) return prev.filter((w) => w !== id)
      return prev.length >= MAX_STOPS ? prev : [...prev, id]
    })
  }

  // ─── Боковая панель ────────────────────────────────────────────────────────

  function renderPanel() {
    if (!isConfigured) return <SetupNotice />

    if (mode?.kind === 'auth') return <AuthPanel onClose={closeMode} />

    if (mode?.kind === 'add' || mode?.kind === 'edit') {
      // Если сессия пропала (например, вышли в другой вкладке) — просим войти снова
      if (!session) return <AuthPanel onClose={closeMode} />
      const editing = mode.kind === 'edit' ? places.find((p) => p.id === mode.id) : undefined
      return (
        <PlaceForm
          key={editing?.id ?? 'new'}
          userId={session.user.id}
          place={editing}
          picked={picked}
          onPick={setPicked}
          onCancel={closeMode}
          onSaved={handleSaved}
        />
      )
    }

    switch (route.name) {
      case 'home':
        return (
          <>
            {loadError && <p className="error">Не удалось загрузить места: {loadError}</p>}
            <PlaceList places={visiblePlaces} walkCount={walk.length} onAdd={startAdding} />
          </>
        )

      case 'place': {
        if (!loaded) return <p className="muted">Загружаем место…</p>
        const place = places.find((p) => p.id === route.id)
        if (!place) {
          return (
            <div className="stack">
              <a className="btn btn--ghost back" href="#/">
                ← Все места
              </a>
              <p className="muted">Место не найдено — возможно, автор его удалил.</p>
            </div>
          )
        }
        return (
          <PlaceCard
            key={place.id}
            place={place}
            userId={userId}
            liked={myReactions.has(reactionKey(place.id, 'like'))}
            visited={myReactions.has(reactionKey(place.id, 'visited'))}
            inWalk={walk.includes(place.id)}
            walkFull={walk.length >= MAX_STOPS}
            onReact={(kind) => handleReact(place, kind)}
            onToggleWalk={() => toggleWalk(place.id)}
            onEdit={() => startEditing(place)}
            onDeleted={handleDeleted}
            onNeedAuth={openAuth}
            onCommentsChanged={() => {
              refreshPlace(place.id).catch(() => {})
            }}
          />
        )
      }

      case 'user':
        return (
          <ProfilePanel key={route.id} profileId={route.id} currentUserId={userId} places={places} />
        )

      case 'nearby':
        return <NearbyPanel places={places} query={nearbyQuery} onQuery={setNearbyQuery} />

      case 'walk':
        return (
          <WalkPanel stops={walkPlaces} route={walkRoute} onRoute={setWalkRoute} onChange={setWalk} />
        )
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          Закоулки <span className="brand__city">Петербурга</span>
        </a>

        <nav className="tag-row tag-row--scroll" aria-label="Фильтр по тегам">
          {TAGS.map((tag) => (
            <button
              key={tag.id}
              className={activeTags.includes(tag.id) ? 'chip chip--active' : 'chip'}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.label}
            </button>
          ))}
        </nav>

        <div className="account">
          {session ? (
            <>
              <a className="btn btn--ghost" href={`#/user/${session.user.id}`}>
                Профиль
              </a>
              <button className="btn btn--ghost" onClick={() => supabase.auth.signOut()}>
                Выйти
              </button>
            </>
          ) : (
            isConfigured && (
              <button className="btn btn--ghost" onClick={openAuth}>
                Войти
              </button>
            )
          )}
        </div>
      </header>

      <div className="body">
        <PlacesMap
          places={visiblePlaces}
          selectedId={route.name === 'place' ? route.id : null}
          onSelect={(id) => {
            if (id) navigate(`/place/${id}`)
            else if (route.name === 'place') navigate('/')
          }}
          pickMode={mode?.kind === 'add' || mode?.kind === 'edit'}
          picked={picked}
          onPick={setPicked}
          walkStops={route.name === 'walk' ? walkStops : NO_STOPS}
          routeLine={route.name === 'walk' ? (walkRoute?.geometry ?? null) : null}
          nearbyArea={route.name === 'nearby' ? nearbyQuery : null}
        />
        <aside className="sidebar">{renderPanel()}</aside>
      </div>
    </div>
  )
}
