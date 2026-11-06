import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { createPlace, photoUrl, updatePlace } from '../lib/places'
import { errorMessage } from '../lib/errors'
import { TAGS, type LatLng, type Place, type TagId } from '../lib/types'

const MAX_PHOTOS = 3

type Props = {
  userId: string
  /** Если передано — форма редактирует это место, иначе создаёт новое */
  place?: Place
  picked: LatLng | null
  onPick: (point: LatLng) => void
  onCancel: () => void
  onSaved: (id: string) => void
}

export function PlaceForm({ userId, place, picked, onPick, onCancel, onSaved }: Props) {
  const isEdit = Boolean(place)
  const [title, setTitle] = useState(place?.title ?? '')
  const [description, setDescription] = useState(place?.description ?? '')
  const [tags, setTags] = useState<TagId[]>(place?.tags ?? [])
  // Уже загруженные фото (при редактировании) и новые файлы — отдельно
  const [keptPhotos, setKeptPhotos] = useState<string[]>(place?.photos ?? [])
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const photoCount = keptPhotos.length + files.length

  // Превью выбранных файлов; ссылки освобождаем, чтобы не текла память
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  function toggleTag(id: TagId) {
    setTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...chosen].slice(0, MAX_PHOTOS - keptPhotos.length))
    e.target.value = '' // чтобы можно было выбрать тот же файл повторно
  }

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setError('Браузер не поддерживает геолокацию')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onPick({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setLocating(false)
        setError('Не удалось определить местоположение — отметь точку на карте вручную')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!picked) return setError('Отметь место на карте')
    if (title.trim().length < 3) return setError('Название — хотя бы 3 символа')
    if (photoCount === 0) return setError('Нужно хотя бы одно фото')

    const input = {
      title: title.trim(),
      description: description.trim(),
      tags,
      lat: picked.lat,
      lng: picked.lng,
    }

    setSubmitting(true)
    setError(null)
    try {
      if (place) {
        await updatePlace(place, input, keptPhotos, files)
        onSaved(place.id)
      } else {
        onSaved(await createPlace(input, files, userId))
      }
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <h2>{isEdit ? 'Редактирование' : 'Новое место'}</h2>

      <div className={picked ? 'location location--set' : 'location'}>
        {picked ? (
          <span>📍 Точка выбрана — кликни на карте ещё раз, чтобы поправить</span>
        ) : (
          <span>Кликни на карте, где находится место</span>
        )}
        <button type="button" className="btn btn--ghost" onClick={locateMe} disabled={locating}>
          {locating ? 'Ищем…' : 'Я сейчас здесь'}
        </button>
      </div>

      <label className="field">
        <span>Название</span>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Двор с жёлтыми галереями"
        />
      </label>

      <label className="field">
        <span>Как найти и что там интересного</span>
        <textarea
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Вход через арку слева от аптеки, второй двор. Лучше всего на закате."
        />
      </label>

      <fieldset className="field">
        <span>Теги</span>
        <div className="tag-row">
          {TAGS.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={tags.includes(tag.id) ? 'chip chip--active' : 'chip'}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <span>
          Фото ({photoCount}/{MAX_PHOTOS})
        </span>
        <div className="photo-picker">
          {keptPhotos.map((path) => (
            <div key={path} className="photo-preview">
              <img src={photoUrl(path)} alt="" />
              <button
                type="button"
                onClick={() => setKeptPhotos((prev) => prev.filter((p) => p !== path))}
                aria-label="Убрать фото"
              >
                ×
              </button>
            </div>
          ))}
          {previews.map((src, i) => (
            <div key={src} className="photo-preview">
              <img src={src} alt="" />
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Убрать фото"
              >
                ×
              </button>
            </div>
          ))}
          {photoCount < MAX_PHOTOS && (
            <label className="photo-add">
              +
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFiles}
                hidden
              />
            </label>
          )}
        </div>
        <p className="muted small">
          Фото сжимаются, а метаданные (координаты съёмки, модель телефона) удаляются перед загрузкой.
          Пожалуйста, без лиц крупным планом и номеров квартир — во дворах живут люди.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
          Отмена
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Сохраняем…' : isEdit ? 'Сохранить' : 'Опубликовать'}
        </button>
      </div>
    </form>
  )
}
