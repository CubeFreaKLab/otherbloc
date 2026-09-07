import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveBuildRevision, revisionPlugin } from '../tooling/revision.mjs'

const sha = 'a'.repeat(40)
const git = (dirty = false) => (args) => args[0] === 'rev-parse' ? sha : dirty ? ' M frontend/src/App.jsx' : ''

test('build revisions distinguish clean Git, changed files and unavailable source metadata', () => {
  assert.deepEqual(resolveBuildRevision({ environment: {}, git: git() }), { revision: sha, dirty: false, source: 'git' })
  assert.deepEqual(resolveBuildRevision({ environment: {}, git: git(true) }), { revision: sha, dirty: true, source: 'git' })
  assert.deepEqual(resolveBuildRevision({ environment: {}, git: () => { throw new Error('No Git') } }), { revision: null, dirty: null, source: 'unavailable' })
  assert.deepEqual(resolveBuildRevision({ environment: { APP_REVISION: sha }, git: () => { throw new Error('No Git') } }), { revision: sha, dirty: null, source: 'environment' })
})

test('declared build revisions must be complete and agree with each other and the actual checkout', () => {
  assert.deepEqual(resolveBuildRevision({ environment: { APP_REVISION: sha.toUpperCase(), GITHUB_SHA: sha }, git: git() }), { revision: sha, dirty: false, source: 'environment' })
  for (const value of ['main', 'abcdef0', 'a'.repeat(41), 'g'.repeat(40), ' ' + sha, 123]) {
    assert.throws(() => resolveBuildRevision({ environment: { APP_REVISION: value }, git: git() }), /complete/)
  }
  assert.throws(() => resolveBuildRevision({ environment: { APP_REVISION: sha, GITHUB_SHA: 'b'.repeat(40) }, git: git() }), /GITHUB_SHA/)
  assert.throws(() => resolveBuildRevision({ environment: { GITHUB_SHA: 'b'.repeat(40) }, git: git() }), /checked-out commit/)
})

test('the build-only plugin emits public revision metadata, never arbitrary environment values', () => {
  const plugin = revisionPlugin({ environment: { GITHUB_SHA: sha, PRIVATE_SETTING: 'not-for-the-browser' }, git: git() })
  const outputs = []
  assert.equal(plugin.apply, 'build')
  plugin.generateBundle.call({ emitFile: (output) => outputs.push(output) })
  assert.equal(outputs.length, 1)
  assert.equal(outputs[0].fileName, 'version.json')
  assert.equal(outputs[0].type, 'asset')
  assert.deepEqual(JSON.parse(outputs[0].source), { application: 'otherbloc', revision: sha, dirty: false, source: 'environment' })
  assert.equal(outputs[0].source.includes('not-for-the-browser'), false)
})
