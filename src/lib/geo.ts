import type { Polygon } from 'geojson'
import type { LatLng } from './types'

export const SPB_CENTER: LatLng = { lat: 59.9386, lng: 30.3141 } // Дворцовая площадь

const EARTH_RADIUS = 6371000 // м

const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Расстояние по прямой между двумя точками (формула гаверсинусов), в метрах */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} м`
  return `${(meters / 1000).toFixed(1).replace('.', ',')} км`
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} мин`
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
}

/** Круг радиусом radius метров как многоугольник — чтобы нарисовать его на карте */
export function circlePolygon(center: LatLng, radius: number, steps = 64): Polygon {
  const coords: [number, number][] = []
  const angular = radius / EARTH_RADIUS
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    const dLat = angular * Math.cos(a)
    const dLng = (angular * Math.sin(a)) / Math.cos(toRad(center.lat))
    coords.push([center.lng + toDeg(dLng), center.lat + toDeg(dLat)])
  }
  return { type: 'Polygon', coordinates: [coords] }
}

/**
 * Жадный порядок обхода: от первой точки каждый раз идём к ближайшей непосещённой.
 * Не идеально (это задача коммивояжёра), но для 3–10 мест работает хорошо.
 */
export function orderByNearest<T extends LatLng>(points: T[]): T[] {
  if (points.length < 3) return [...points]
  const rest = points.slice(1)
  const result = [points[0]]
  while (rest.length > 0) {
    const last = result[result.length - 1]
    let best = 0
    for (let i = 1; i < rest.length; i++) {
      if (distanceMeters(last, rest[i]) < distanceMeters(last, rest[best])) best = i
    }
    result.push(rest.splice(best, 1)[0])
  }
  return result
}
