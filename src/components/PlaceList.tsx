import { useState } from 'react'
import { photoUrl } from '../lib/places'
import { tagLabel, type Place } from '../lib/types'

/** Строка списка мест — ссылка на карточку. Используется и в профиле, и в «рядом» */
export function PlaceItem({ place, aside }: { place: Place; aside?: string }) {
  const meta = [
    ...place.tags.map(tagLabel),
    place.likes_count > 0 ? `♥ ${place.likes_count}` : null,
  ].filter(Boolean)

  return (
    <a className="place-item" href={`#/place/${place.id}`}>
      <img src={photoUrl(place.photos[0])} alt="" loading="lazy" />
      <span className="place-item__text">
        <span className="place-item__title">{place.title}</span>
        {meta.length > 0 && <span className="place-item__meta">{meta.join(' · ')}</span>}
      </span>
      {aside && <span className="place-item__aside">{aside}</span>}
    </a>
  )
}

type Props = {
  places: Place[]
  walkCount: number
  onAdd: () => void
}

export function PlaceList({ places, walkCount, onAdd }: Props) {
  const [sort, setSort] = useState<'new' | 'week'>('new')

  const shown =
    sort === 'new'
      ? places
      : places.filter((p) => p.likes_week > 0).sort((a, b) => b.likes_week - a.likes_week)

  return (
    <div className="stack">
      <div className="intro">
        <h2>Петербург, который не в путеводителях</h2>
        <p className="muted">
          Дворы-колодцы, мозаики в парадных, виды с неожиданных точек. Нашёл что-то такое — отметь
          на карте.
        </p>
        <button className="btn btn--primary" onClick={onAdd}>
          + Добавить место
        </button>
        <div className="row">
          <a className="btn btn--ghost" href="#/nearby">
            📍 Рядом со мной
          </a>
          <a className="btn btn--ghost" href="#/walk">
            🚶 Прогулка{walkCount > 0 ? ` (${walkCount})` : ''}
          </a>
        </div>
      </div>

      <div className="segmented" role="tablist">
        <button
          role="tab"
          aria-selected={sort === 'new'}
          className={sort === 'new' ? 'segmented__item segmented__item--active' : 'segmented__item'}
          onClick={() => setSort('new')}
        >
          Новые
        </button>
        <button
          role="tab"
          aria-selected={sort === 'week'}
          className={sort === 'week' ? 'segmented__item segmented__item--active' : 'segmented__item'}
          onClick={() => setSort('week')}
        >
          Лучшее за неделю
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="muted">
          {sort === 'week'
            ? 'За эту неделю лайков ещё не было. Загляни в новые места!'
            : 'Здесь пока пусто. Стань первым, кто отметит место!'}
        </p>
      ) : (
        <ul className="place-list">
          {shown.map((place) => (
            <li key={place.id}>
              <PlaceItem place={place} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
