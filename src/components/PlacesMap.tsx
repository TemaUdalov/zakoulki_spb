import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, LineString, Point, Position } from 'geojson'
import { circlePolygon, SPB_CENTER } from '../lib/geo'
import type { LatLng, NearbyQuery, Place } from '../lib/types'

// Бесплатные векторные тайлы OpenFreeMap — без ключей и регистрации
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const ACCENT = '#c4702a' // петербургская охра — места
const ROUTE = '#2e6f8e' // невская синева — прогулка
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

type Props = {
  places: Place[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Режим выбора точки для нового или редактируемого места */
  pickMode: boolean
  picked: LatLng | null
  onPick: (point: LatLng) => void
  /** Остановки прогулки по порядку */
  walkStops: LatLng[]
  routeLine: LineString | null
  nearbyArea: NearbyQuery | null
}

function placesToGeoJSON(places: Place[]): FeatureCollection<Point, { id: string }> {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id },
    })),
  }
}

function fitTo(map: maplibregl.Map, coords: Position[]) {
  if (coords.length === 0) return
  const first = coords[0] as [number, number]
  const bounds = new maplibregl.LngLatBounds(first, first)
  for (const c of coords) bounds.extend(c as [number, number])
  map.fitBounds(bounds, { padding: 60, maxZoom: 16 })
}

export function PlacesMap({
  places,
  selectedId,
  onSelect,
  pickMode,
  picked,
  onPick,
  walkStops,
  routeLine,
  nearbyArea,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const [ready, setReady] = useState(false)

  // Обработчики карты создаются один раз, поэтому свежие пропсы читаем через ref
  const latest = useRef({ onSelect, onPick, pickMode })
  useEffect(() => {
    latest.current = { onSelect, onPick, pickMode }
  })

  // 1. Создание карты, слоёв и обработчиков
  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [SPB_CENTER.lng, SPB_CENTER.lat],
      zoom: 12,
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
      'bottom-right',
    )

    map.on('load', () => {
      // Слои добавляются снизу вверх: область поиска и маршрут — под метками

      map.addSource('nearby', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'nearby-fill',
        type: 'fill',
        source: 'nearby',
        paint: { 'fill-color': ACCENT, 'fill-opacity': 0.08 },
      })
      map.addLayer({
        id: 'nearby-line',
        type: 'line',
        source: 'nearby',
        paint: { 'line-color': ACCENT, 'line-width': 2, 'line-dasharray': [2, 2] },
      })

      map.addSource('route', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ROUTE, 'line-width': 5, 'line-opacity': 0.85 },
      })

      // Кластеризация: рядом стоящие метки при отдалении склеиваются в кружок с числом
      map.addSource('places', {
        type: 'geojson',
        data: EMPTY,
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 15,
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'places',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ACCENT,
          'circle-opacity': 0.9,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      })

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'places',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#fff' },
      })

      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'places',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ACCENT,
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      })

      // Кольцо вокруг выбранного места
      map.addLayer({
        id: 'point-selected',
        type: 'circle',
        source: 'places',
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-color': 'transparent',
          'circle-radius': 14,
          'circle-stroke-width': 3,
          'circle-stroke-color': ACCENT,
        },
      })

      // Пронумерованные остановки прогулки
      map.addSource('walk-stops', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'walk-stops',
        type: 'circle',
        source: 'walk-stops',
        paint: {
          'circle-color': ROUTE,
          'circle-radius': 11,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      })
      map.addLayer({
        id: 'walk-stops-label',
        type: 'symbol',
        source: 'walk-stops',
        layout: {
          'text-field': ['to-string', ['get', 'n']],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#fff' },
      })

      setReady(true)
    })

    map.on('click', (e) => {
      const { pickMode, onPick, onSelect } = latest.current
      if (pickMode) {
        onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        return
      }
      if (!map.getLayer('points')) return

      const [feature] = map.queryRenderedFeatures(e.point, { layers: ['clusters', 'points'] })
      if (!feature) {
        onSelect(null)
        return
      }
      if (feature.layer.id === 'points') {
        onSelect(String(feature.properties.id))
        return
      }

      // Клик по кластеру — приближаемся, чтобы он распался на отдельные метки
      const center = (feature.geometry as Point).coordinates as [number, number]
      map
        .getSource<GeoJSONSource>('places')
        ?.getClusterExpansionZoom(feature.properties.cluster_id as number)
        .then((zoom) => map.easeTo({ center, zoom }))
    })

    for (const layer of ['points', 'clusters']) {
      map.on('mouseenter', layer, () => {
        if (!latest.current.pickMode) map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', layer, () => {
        if (!latest.current.pickMode) map.getCanvas().style.cursor = ''
      })
    }

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      setReady(false)
    }
  }, [])

  // 2. Метки мест
  useEffect(() => {
    if (!ready) return
    mapRef.current?.getSource<GeoJSONSource>('places')?.setData(placesToGeoJSON(places))
  }, [places, ready])

  // 3. Подсвечиваем выбранное место и подлетаем к нему.
  //    hasPlaces нужен для прямых ссылок: место может загрузиться уже после карты
  const hasPlaces = places.length > 0
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    map.setFilter('point-selected', ['==', ['get', 'id'], selectedId ?? ''])
    const place = places.find((p) => p.id === selectedId)
    if (place) {
      map.easeTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 16) })
    }
    // places намеренно не в зависимостях: подлетаем только при смене выбора
  }, [selectedId, ready, hasPlaces])

  // 4. Остановки прогулки
  useEffect(() => {
    if (!ready) return
    mapRef.current?.getSource<GeoJSONSource>('walk-stops')?.setData({
      type: 'FeatureCollection',
      features: walkStops.map((s, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: { n: i + 1 },
      })),
    })
  }, [walkStops, ready])

  // 5. Линия маршрута прогулки
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map
      .getSource<GeoJSONSource>('route')
      ?.setData(routeLine ? { type: 'Feature', geometry: routeLine, properties: {} } : EMPTY)
    if (routeLine) fitTo(map, routeLine.coordinates)
  }, [routeLine, ready])

  // 6. Круг поиска «рядом»
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (!nearbyArea) {
      map.getSource<GeoJSONSource>('nearby')?.setData(EMPTY)
      return
    }
    const circle = circlePolygon(nearbyArea.center, nearbyArea.radius)
    map.getSource<GeoJSONSource>('nearby')?.setData({ type: 'Feature', geometry: circle, properties: {} })
    fitTo(map, circle.coordinates[0])
  }, [nearbyArea, ready])

  // 7. Курсор-прицел в режиме выбора точки
  useEffect(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = pickMode ? 'crosshair' : ''
  }, [pickMode])

  // 8. Маркер точки, выбранной в форме
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!picked) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    const lngLat: [number, number] = [picked.lng, picked.lat]
    if (markerRef.current) {
      markerRef.current.setLngLat(lngLat)
    } else {
      markerRef.current = new maplibregl.Marker({ color: ACCENT }).setLngLat(lngLat).addTo(map)
    }
    // Если точка пришла из геолокации и сейчас за краем экрана — показываем её
    if (!map.getBounds().contains(lngLat)) {
      map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 16) })
    }
  }, [picked])

  return <div ref={containerRef} className="map" />
}
