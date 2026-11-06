import { useState } from 'react'
import { deletePlace, photoUrl } from '../lib/places'
import { errorMessage } from '../lib/errors'
import { placeLink } from '../lib/router'
import { tagLabel, type Place, type ReactionKind } from '../lib/types'
import { Comments } from './Comments'

type Props = {
  place: Place
  userId: string | null
  liked: boolean
  visited: boolean
  inWalk: boolean
  walkFull: boolean
  onReact: (kind: ReactionKind) => void
  onToggleWalk: () => void
  onEdit: () => void
  onDeleted: (id: string) => void
  onNeedAuth: () => void
  onCommentsChanged: () => void
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

export function PlaceCard({
  place,
  userId,
  liked,
  visited,
  inWalk,
  walkFull,
  onReact,
  onToggleWalk,
  onEdit,
  onDeleted,
  onNeedAuth,
  onCommentsChanged,
}: Props) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOwner = userId === place.user_id
  // Пешеходный маршрут до места в Яндекс Картах
  const routeUrl = `https://yandex.ru/maps/?rtext=~${place.lat},${place.lng}&rtt=pd`

  async function handleShare() {
    const url = placeLink(place.id)
    // На телефоне откроется системное меню «Поделиться», на компьютере — копируем ссылку
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: place.title, url })
      } catch {
        // Пользователь закрыл меню — ничего страшного
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Скопируй ссылку:', url)
    }
  }

  async function handleDelete() {
    if (!confirm('Удалить это место? Фото и комментарии тоже удалятся.')) return
    setDeleting(true)
    setError(null)
    try {
      await deletePlace(place)
      onDeleted(place.id)
    } catch (e) {
      setError(errorMessage(e))
      setDeleting(false)
    }
  }

  return (
    <article className="stack">
      <a className="btn btn--ghost back" href="#/">
        ← Все места
      </a>

      <div className="gallery">
        <a href={photoUrl(place.photos[photoIndex])} target="_blank" rel="noreferrer">
          <img className="gallery__main" src={photoUrl(place.photos[photoIndex])} alt={place.title} />
        </a>
        {place.photos.length > 1 && (
          <div className="gallery__thumbs">
            {place.photos.map((path, i) => (
              <button
                key={path}
                className={i === photoIndex ? 'thumb thumb--active' : 'thumb'}
                onClick={() => setPhotoIndex(i)}
                aria-label={`Фото ${i + 1}`}
              >
                <img src={photoUrl(path)} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="place-title">{place.title}</h2>
        <p className="muted small">
          <a href={`#/user/${place.user_id}`}>{place.author_name}</a> · {formatDate(place.created_at)}
          {place.updated_at && ' · изменено'}
        </p>
      </div>

      {place.tags.length > 0 && (
        <div className="tag-row">
          {place.tags.map((tag) => (
            <span key={tag} className="tag">
              {tagLabel(tag)}
            </span>
          ))}
        </div>
      )}

      {place.description && <p className="description">{place.description}</p>}

      <div className="action-row">
        <button
          className={liked ? 'btn btn--ghost btn--on' : 'btn btn--ghost'}
          onClick={() => onReact('like')}
          aria-pressed={liked}
        >
          {liked ? '♥' : '♡'} {place.likes_count}
        </button>
        <button
          className={visited ? 'btn btn--ghost btn--on' : 'btn btn--ghost'}
          onClick={() => onReact('visited')}
          aria-pressed={visited}
          title="Отметь, если тоже здесь был"
        >
          👣 Я тут был · {place.visited_count}
        </button>
        <button className="btn btn--ghost" onClick={handleShare}>
          {copied ? 'Ссылка скопирована' : 'Поделиться'}
        </button>
      </div>

      <div className="row">
        <a className="btn btn--primary" href={routeUrl} target="_blank" rel="noreferrer">
          Маршрут
        </a>
        <button
          className={inWalk ? 'btn btn--ghost btn--on' : 'btn btn--ghost'}
          onClick={onToggleWalk}
          disabled={!inWalk && walkFull}
          title={!inWalk && walkFull ? 'В прогулке уже максимум мест' : undefined}
        >
          {inWalk ? '✓ В прогулке' : '+ В прогулку'}
        </button>
      </div>

      {isOwner && (
        <div className="row">
          <button className="btn btn--ghost" onClick={onEdit}>
            Редактировать
          </button>
          <button className="btn btn--danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Удаляем…' : 'Удалить'}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <Comments
        placeId={place.id}
        userId={userId}
        onNeedAuth={onNeedAuth}
        onChanged={onCommentsChanged}
      />
    </article>
  )
}
