import sharp from 'sharp'

export async function imageVariants(bytes, path, originalWidth) {
  const variants = []
  for (const width of [640, 960]) {
    if (width >= originalWidth) continue
    const result = await sharp(bytes).resize({ width }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
    variants.push({ width, height: result.info.height, path: path.replace('.webp', '-' + width + '.webp'), size: result.data.length, bytes: result.data })
  }
  return variants
}

export const variantRecords = (variants) => Object.fromEntries(variants.map(({ bytes: _bytes, ...variant }) => [variant.width, variant]))
export const saveImage = (bucket, path, bytes) => bucket.file(path).save(bytes, { resumable: false, metadata: { contentType: 'image/webp', cacheControl: 'private, no-store' } })
