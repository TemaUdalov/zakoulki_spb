import type { LineString } from 'geojson'
import type { LatLng } from './types'

export const MAX_STOPS = 10
const STORAGE_KEY = 'zakoulki.walk'

// Пешеходный OSRM от FOSSGIS — тот же, что использует openstreetmap.org.
// Бесплатный, без ключа, но с правилом честного использования: не долбить запросами.
const ROUTER_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'

export type WalkRoute = {
  geometry: LineString
  /** метры */
  distance: number
  /** секунды */
  duration: number
}

/** Прогулка хранится в браузере, чтобы не терялась при перезагрузке */
export function loadWalk(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const value: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function saveWalk(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Хранилище может быть недоступно (приватный режим) — не страшно
  }
}

export async function buildWalkRoute(stops: LatLng[]): Promise<WalkRoute> {
  if (stops.length < 2) throw new Error('Для маршрута нужно хотя бы два места')

  // OSRM ждёт координаты в порядке «долгота,широта»
  const coords = stops.map((s) => `${s.lng.toFixed(6)},${s.lat.toFixed(6)}`).join(';')
  const res = await fetch(`${ROUTER_URL}/${coords}?overview=full&geometries=geojson`)
  if (!res.ok) throw new Error(`Сервис маршрутов не ответил (код ${res.status})`)

  const data = (await res.json()) as {
    code: string
    routes?: { geometry: LineString; distance: number; duration: number }[]
  }
  const route = data.routes?.[0]
  if (data.code !== 'Ok' || !route) throw new Error('Не удалось построить маршрут между этими местами')

  return { geometry: route.geometry, distance: route.distance, duration: route.duration }
}

/** Тот же маршрут в Яндекс Картах — удобно идти по нему с телефона */
export function yandexWalkUrl(stops: LatLng[]): string {
  const points = stops.map((s) => `${s.lat},${s.lng}`).join('~')
  return `https://yandex.ru/maps/?rtext=${points}&rtt=pd`
}
