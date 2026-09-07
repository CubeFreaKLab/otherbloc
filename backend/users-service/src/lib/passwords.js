import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { fail } from './errors.js'

const derive = promisify(scrypt)
const parameters = { N: 65536, r: 8, p: 2, maxmem: 96 * 1024 * 1024 }
const dummy = 'scrypt$65536$8$2$' + Buffer.alloc(16).toString('base64url') + '$' + Buffer.alloc(32).toString('base64url')
let active = 0

async function key(password, salt) {
  // Bound memory use as well as HTTP attempts; never queue unbounded scrypt work.
  if (active >= 2) fail(429, 'authentication_busy', 'Hay varios accesos en curso. Inténtalo de nuevo en unos segundos.')
  active += 1
  try { return await derive(password, salt, 32, parameters) } finally { active -= 1 }
}

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await key(password, salt)
  return ['scrypt', parameters.N, parameters.r, parameters.p, salt.toString('base64url'), hash.toString('base64url')].join('$')
}

export async function verifyPassword(password, encoded = dummy) {
  const [scheme, n, r, p, salt, hash] = encoded.split('$')
  if (scheme !== 'scrypt' || +n !== parameters.N || +r !== parameters.r || +p !== parameters.p) return false
  const expected = Buffer.from(hash, 'base64url')
  const actual = await key(password, Buffer.from(salt, 'base64url'))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
