import 'dotenv/config'

export function readRevision(source = process.env) {
  const values = []
  for (const key of ['RENDER_GIT_COMMIT', 'APP_REVISION']) {
    const value = source[key]
    if (value === undefined || value === '') continue
    if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value)) throw new Error(key + ' must be a complete 40-character Git SHA')
    values.push(value.toLowerCase())
  }
  if (new Set(values).size > 1) throw new Error('APP_REVISION does not match RENDER_GIT_COMMIT')
  return values[0] ?? null
}

export const revision = readRevision()
