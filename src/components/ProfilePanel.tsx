import { useEffect, useState, type FormEvent } from 'react'
import { fetchProfile, updateDisplayName } from '../lib/social'
import { errorMessage } from '../lib/errors'
import type { Place, Profile } from '../lib/types'
import { PlaceItem } from './PlaceList'

type Props = {
  profileId: string
  currentUserId: string | null
  /** Все загруженные места — места автора выбираем из них, без лишнего запроса */
  places: Place[]
}

export function ProfilePanel({ profileId, currentUserId, places }: Props) {
  // undefined — грузим, null — не найден
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMe = currentUserId === profileId
  const own = places.filter((p) => p.user_id === profileId)
  const likesReceived = own.reduce((sum, p) => sum + p.likes_count, 0)

  useEffect(() => {
    let cancelled = false
    fetchProfile(profileId)
      .then((p) => !cancelled && setProfile(p))
      .catch((e: unknown) => {
        if (cancelled) return
        setError(errorMessage(e))
        setProfile(null)
      })
    return () => {
      cancelled = true
    }
  }, [profileId])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) return setError('Имя — хотя бы 2 символа')

    setSaving(true)
    setError(null)
    try {
      await updateDisplayName(profileId, trimmed)
      setProfile((p) => (p ? { ...p, display_name: trimmed } : p))
      setEditing(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (profile === undefined) return <p className="muted">Загружаем профиль…</p>

  if (profile === null) {
    return (
      <div className="stack">
        <a className="btn btn--ghost back" href="#/">
          ← Все места
        </a>
        <p className="muted">Профиль не найден.</p>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="stack">
      <a className="btn btn--ghost back" href="#/">
        ← Все места
      </a>

      {editing ? (
        <form className="stack" onSubmit={handleSave}>
          <label className="field">
            <span>Имя, которое видят другие</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoFocus
            />
          </label>
          <div className="row">
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      ) : (
        <div className="profile-head">
          <div className="avatar" aria-hidden>
            {profile.display_name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 className="place-title">{profile.display_name}</h2>
            <p className="muted small">
              с{' '}
              {new Date(profile.created_at).toLocaleDateString('ru-RU', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          {isMe && (
            <button
              className="btn btn--ghost profile-head__edit"
              onClick={() => {
                setName(profile.display_name)
                setEditing(true)
              }}
            >
              Изменить имя
            </button>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <div className="stats-row">
        <div>
          <b>{own.length}</b>
          <span className="muted small">мест</span>
        </div>
        <div>
          <b>{likesReceived}</b>
          <span className="muted small">лайков</span>
        </div>
      </div>

      {own.length === 0 ? (
        <p className="muted">{isMe ? 'Ты ещё не добавил ни одного места.' : 'Пока ни одного места.'}</p>
      ) : (
        <ul className="place-list">
          {own.map((place) => (
            <li key={place.id}>
              <PlaceItem place={place} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
