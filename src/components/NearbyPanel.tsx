import { useEffect, useState } from 'react'
import { fetchNearby } from '../lib/places'
import { errorMessage } from '../lib/errors'
import { formatDistance, SPB_CENTER } from '../lib/geo'
import type { NearbyQuery, NearbyResult, Place } from '../lib/types'
import { PlaceItem } from './PlaceList'

const RADII = [500, 1000, 2000]

type Props = {
  places: Place[]
  query: NearbyQuery | null
  onQuery: (query: NearbyQuery) => void
}

export function NearbyPanel({ places, query, onQuery }: Props) {
  const [results, setResults] = useState<NearbyResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Запрос к базе при каждом изменении точки или радиуса
  useEffect(() => {
    if (!query) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchNearby(query.center, query.radius)
      .then((r) => !cancelled && setResults(r))
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query])

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setError('Браузер не поддерживает геолокацию')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onQuery({
          center: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          radius: query?.radius ?? 1000,
          label: 'от тебя',
        })
      },
      () => {
        setLocating(false)
        setError('Не удалось определить местоположение. Разреши доступ к геолокации в браузере.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const items = (results ?? [])
    .map((r) => ({ place: places.find((p) => p.id === r.id), distance: r.distance_m }))
    .filter((x): x is { place: Place; distance: number } => Boolean(x.place))

  return (
    <div className="stack">
      <a className="btn btn--ghost back" href="#/">
        ← Все места
      </a>
      <h2>Рядом со мной</h2>

      <div className="row">
        <button className="btn btn--primary" onClick={locateMe} disabled={locating}>
          {locating ? 'Определяем…' : '📍 Где я сейчас'}
        </button>
        <button
          className="btn btn--ghost"
          onClick={() =>
            onQuery({ center: SPB_CENTER, radius: query?.radius ?? 1000, label: 'от Дворцовой площади' })
          }
        >
          От Дворцовой
        </button>
      </div>

      {query && (
        <div className="tag-row">
          {RADII.map((r) => (
            <button
              key={r}
              className={query.radius === r ? 'chip chip--active' : 'chip'}
              onClick={() => onQuery({ ...query, radius: r })}
            >
              {formatDistance(r)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {!query && !error && (
        <p className="muted">Найдём необычные места в радиусе пешей прогулки от тебя.</p>
      )}
      {query && loading && <p className="muted">Ищем…</p>}

      {query && !loading && results && (
        <>
          <p className="muted small">
            {items.length > 0
              ? `Найдено ${items.length} в радиусе ${formatDistance(query.radius)} ${query.label}`
              : `В радиусе ${formatDistance(query.radius)} ${query.label} пока ничего нет. Попробуй увеличить радиус.`}
          </p>
          <ul className="place-list">
            {items.map(({ place, distance }) => (
              <li key={place.id}>
                <PlaceItem place={place} aside={formatDistance(distance)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
