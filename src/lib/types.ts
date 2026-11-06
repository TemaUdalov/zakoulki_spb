// Теги мест. Список должен совпадать с проверкой в supabase/schema.sql
export const TAGS = [
  { id: 'courtyard', label: 'Двор' },
  { id: 'street-art', label: 'Стрит-арт' },
  { id: 'view', label: 'Вид' },
  { id: 'architecture', label: 'Архитектура' },
  { id: 'detail', label: 'Деталь' },
  { id: 'nature', label: 'Природа' },
  { id: 'atmosphere', label: 'Атмосферное' },
] as const

export type TagId = (typeof TAGS)[number]['id']

export function tagLabel(id: TagId): string {
  return TAGS.find((t) => t.id === id)?.label ?? id
}

export type LatLng = { lat: number; lng: number }

/** Место вместе со счётчиками — строка из представления places_feed */
export type Place = {
  id: string
  user_id: string
  title: string
  description: string
  tags: TagId[]
  lat: number
  lng: number
  /** Пути к фото в хранилище Supabase */
  photos: string[]
  created_at: string
  updated_at: string | null
  author_name: string
  likes_count: number
  likes_week: number
  visited_count: number
  comments_count: number
}

/** Поля, которые пользователь заполняет в форме */
export type PlaceInput = Pick<Place, 'title' | 'description' | 'tags' | 'lat' | 'lng'>

export type ReactionKind = 'like' | 'visited'

export type Comment = {
  id: string
  place_id: string
  user_id: string
  body: string
  created_at: string
  author_name: string
}

export type Profile = {
  id: string
  display_name: string
  created_at: string
}

export type NearbyQuery = {
  center: LatLng
  radius: number
  /** Откуда ищем: «от тебя» или «от Дворцовой» */
  label: string
}

export type NearbyResult = { id: string; distance_m: number }
