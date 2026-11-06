import { supabase } from './supabase'
import { compressImage } from './image'
import type { LatLng, NearbyResult, Place, PlaceInput } from './types'

const BUCKET = 'place-photos'
// Читаем из представления со счётчиками, пишем — в саму таблицу
const FEED = 'places_feed'

export async function fetchPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from(FEED)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Place[]
}

export async function fetchPlace(id: string): Promise<Place | null> {
  const { data, error } = await supabase.from(FEED).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Place | null
}

export function photoUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

async function removePhotos(paths: string[]) {
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)
}

/** Сжимает и загружает фото; если одно упало — удаляет уже загруженные */
async function uploadPhotos(files: File[], userId: string): Promise<string[]> {
  const uploaded: string[] = []
  try {
    for (const file of files) {
      const blob = await compressImage(file)
      // Каждый пользователь пишет только в свою папку — это проверяет политика хранилища
      const path = `${userId}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      uploaded.push(path)
    }
    return uploaded
  } catch (e) {
    await removePhotos(uploaded)
    throw e
  }
}

/** Создаёт место и возвращает его id */
export async function createPlace(input: PlaceInput, files: File[], userId: string): Promise<string> {
  const photos = await uploadPhotos(files, userId)

  const { data, error } = await supabase
    .from('places')
    .insert({ ...input, user_id: userId, photos })
    .select('id')
    .single()

  if (error) {
    await removePhotos(photos)
    throw error
  }
  return (data as { id: string }).id
}

/**
 * Обновляет место. keepPhotos — какие из старых фото оставить,
 * newFiles — новые фото. Убранные фото удаляются из хранилища после сохранения.
 */
export async function updatePlace(
  place: Place,
  input: PlaceInput,
  keepPhotos: string[],
  newFiles: File[],
): Promise<void> {
  const uploaded = await uploadPhotos(newFiles, place.user_id)

  const { error } = await supabase
    .from('places')
    .update({ ...input, photos: [...keepPhotos, ...uploaded] })
    .eq('id', place.id)

  if (error) {
    await removePhotos(uploaded)
    throw error
  }

  await removePhotos(place.photos.filter((p) => !keepPhotos.includes(p)))
}

export async function deletePlace(place: Place): Promise<void> {
  const { error } = await supabase.from('places').delete().eq('id', place.id)
  if (error) throw error
  await removePhotos(place.photos)
}

/** Места в радиусе — считает PostGIS на стороне базы (функция places_nearby) */
export async function fetchNearby(center: LatLng, radius: number): Promise<NearbyResult[]> {
  const { data, error } = await supabase.rpc('places_nearby', {
    p_lat: center.lat,
    p_lng: center.lng,
    p_radius: radius,
  })
  if (error) throw error
  return data as NearbyResult[]
}
