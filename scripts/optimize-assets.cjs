const { readdir, readFile, writeFile } = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')
const { compress } = require('wawoff2')

async function main() {
  const publicRoot = path.join(__dirname, '..', 'frontend', 'public')
  const fontRoot = path.join(publicRoot, 'fonts')
  for (const file of await readdir(fontRoot)) {
    if (!/\.(ttf|otf)$/.test(file)) continue
    const output = file.replace(/\.(ttf|otf)$/, '.woff2')
    const compressed = await compress(await readFile(path.join(fontRoot, file)))
    await writeFile(path.join(fontRoot, output), compressed)
    console.log(output, compressed.length)
  }
  const source = process.argv[2]
  for (const name of ['ciudad', 'escritura', 'lectura']) {
    const original = source ? path.join(source, name + '.png') : path.join(publicRoot, 'images', name + '.webp')
    for (const width of [640, 960]) {
      const output = name + '-' + width + '.webp'
      const result = await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(publicRoot, 'images', output))
      console.log(output, result.size)
    }
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
