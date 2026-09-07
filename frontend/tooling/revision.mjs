import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const shaPattern = /^[a-f0-9]{40}$/i
const readGit = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

export function resolveBuildRevision({ environment = process.env, git = readGit } = {}) {
  const declared = ['APP_REVISION', 'GITHUB_SHA'].map((key) => {
    const value = environment[key]
    if (value === undefined || value === '') return null
    if (typeof value !== 'string' || !shaPattern.test(value)) throw new Error(key + ' must be a complete 40-character Git SHA')
    return value.toLowerCase()
  }).filter(Boolean)
  if (new Set(declared).size > 1) throw new Error('APP_REVISION does not match GITHUB_SHA')
  let revision = null, dirty = null
  try {
    const head = git(['rev-parse', 'HEAD'])
    if (shaPattern.test(head)) {
      revision = head.toLowerCase()
      dirty = Boolean(git(['status', '--porcelain', '--untracked-files=normal']))
    }
  } catch { /* Source archives may not include Git metadata; unavailable is not a clean revision. */ }
  if (declared[0] && revision && declared[0] !== revision) throw new Error('Declared build revision does not match the checked-out commit')
  return { revision: declared[0] ?? revision, dirty, source: declared.length ? 'environment' : revision ? 'git' : 'unavailable' }
}

export function revisionPlugin(options) {
  return {
    name: 'otherbloc-build-revision',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ application: 'otherbloc', ...resolveBuildRevision(options) }) + '\n' })
    },
  }
}
