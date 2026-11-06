const MAX_SIDE = 1600
const QUALITY = 0.82

/**
 * Уменьшает фото и пересохраняет в JPEG через canvas.
 * Побочный (и важный) эффект: при перерисовке пропадают EXIF-метаданные —
 * точные координаты съёмки, модель телефона, дата. Их нельзя выкладывать публично.
 */
export async function compressImage(file: File): Promise<Blob> {
  // imageOrientation учитывает поворот из EXIF, иначе фото с телефона может лечь боком
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Браузер не смог обработать фото')

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось сохранить фото'))),
      'image/jpeg',
      QUALITY,
    )
  })
}
