import { useState } from 'react'
import { errorMessage } from '../lib/errors'
import { formatDistance, formatDuration, orderByNearest } from '../lib/geo'
import { buildWalkRoute, MAX_STOPS, yandexWalkUrl, type WalkRoute } from '../lib/walk'
import { photoUrl } from '../lib/places'
import type { Place } from '../lib/types'

type Props = {
  stops: Place[]
  route: WalkRoute | null
  onRoute: (route: WalkRoute | null) => void
  onChange: (ids: string[]) => void
}

export function WalkPanel({ stops, route, onRoute, onChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ids = stops.map((s) => s.id)

  function move(index: number, delta: -1 | 1) {
    const next = [...ids]
    const target = index + delta
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  async function handleBuild() {
    setLoading(true)
    setError(null)
    try {
      onRoute(await buildWalkRoute(stops))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stack">
      <a className="btn btn--ghost back" href="#/">
        ← Все места
      </a>
      <h2>Прогулка</h2>

      {stops.length === 0 ? (
        <p className="muted">
          Собери свой маршрут: открой интересное место и нажми «+ В прогулку». Можно добавить до{' '}
          {MAX_STOPS} мест.
        </p>
      ) : (
        <>
          <ol className="walk-list">
            {stops.map((place, i) => (
              <li key={place.id} className="walk-stop">
                <span className="walk-stop__num">{i + 1}</span>
                <img src={photoUrl(place.photos[0])} alt="" />
                <a className="walk-stop__title" href={`#/place/${place.id}`}>
                  {place.title}
                </a>
                <span className="walk-stop__controls">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Выше">
                    ↑
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === stops.length - 1}
                    aria-label="Ниже"
                  >
                    ↓
                  </button>
                  <button onClick={() => onChange(ids.filter((id) => id !== place.id))} aria-label="Убрать">
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ol>

          {stops.length >= 3 && (
            <button
              className="btn btn--ghost"
              onClick={() => onChange(orderByNearest(stops).map((s) => s.id))}
              title="Начиная с первого места, каждый раз идём к ближайшему"
            >
              Упорядочить по пути
            </button>
          )}

          {stops.length < 2 ? (
            <p className="muted small">Добавь ещё хотя бы одно место, чтобы построить маршрут.</p>
          ) : (
            <>
              <button className="btn btn--primary" onClick={handleBuild} disabled={loading}>
                {loading ? 'Строим…' : route ? 'Перестроить маршрут' : 'Построить маршрут'}
              </button>

              {route && (
                <p className="walk-summary">
                  {formatDistance(route.distance)} пешком · примерно {formatDuration(route.duration)}
                </p>
              )}

              <a className="btn btn--ghost" href={yandexWalkUrl(stops)} target="_blank" rel="noreferrer">
                Открыть в Яндекс Картах
              </a>
            </>
          )}

          {error && <p className="error">{error}</p>}

          <button className="link-btn" onClick={() => onChange([])}>
            Очистить прогулку
          </button>
        </>
      )}
    </div>
  )
}
