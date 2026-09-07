import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse as parseGraphql, buildSchema, validate, specifiedRules } from 'graphql'
import { validateRuntime } from '../src/config/env.js'
import { formatError, requireIdentity } from '../src/lib/errors.js'
import { commentSchema, pagination, relationId } from '../src/models/interaction.js'
import { boundedOperation } from '../src/middleware/security.js'
import { typeDefs } from '../src/schema/typeDefs.js'
import { createDomainClients } from '../src/services/domainClients.js'

test('interaction identifiers, comments and cursors bound input and scope state to the current user', () => {
  assert.notEqual(relationId('a_b', 'c'), relationId('a', 'b_c'))
  assert.equal(relationId('a', 'b'), relationId('a', 'b'))
  assert.equal(commentSchema.parse({ id: randomUUID(), publicationId: 'demo', text: ' texto ' }).text, 'texto')
  for (const text of ['', ' ', 'x'.repeat(2001)]) assert.equal(commentSchema.safeParse({ id: randomUUID(), publicationId: 'demo', text }).success, false)
  assert.throws(() => requireIdentity(null), /Inicia sesión/)
  assert.throws(() => requireIdentity({ id: 'one' }, 'two'), /propias/)
  assert.equal(requireIdentity({ id: 'one' }, 'one').id, 'one')
  assert.throws(() => pagination({ limit: 41 }, 'mine'), /datos/)
  const cursor = Buffer.from(JSON.stringify({ id: randomUUID(), time: new Date().toISOString(), scope: 'mine' })).toString('base64url')
  assert.ok(pagination({ cursor }, 'mine').after)
  assert.throws(() => pagination({ cursor }, 'other'), /cursor/)
})

test('GraphQL schema retains agreed queries and mutations without accepting arbitrary identity fields', () => {
  const schema = buildSchema(typeDefs)
  const document = parseGraphql('query { publication(id: "demo") { author { name } comments { items { text author { name } } } saved reactions { count active } } }')
  assert.deepEqual(validate(schema, document), [])
  assert.ok(validate(schema, parseGraphql('mutation { addComment(input: { id: "x", publicationId: "demo", text: "test", userId: "other" }) { id } }')).length)
  assert.ok(validate(schema, parseGraphql('query { publication(id: "demo") { author { email passwordHash } } }')).length)
  for (const name of ['addComment', 'savePublication', 'reactToPublication', 'followAuthor', 'deleteComment']) assert.ok(schema.getMutationType().getFields()[name])
  const large = parseGraphql('query { ' + Array.from({ length: 7 }, (_, index) => 'a' + index + ': serviceStatus { status }').join(' ') + ' }')
  assert.ok(validate(schema, large, [...specifiedRules, boundedOperation]).some((error) => error.message.includes('amplia')))
})

test('runtime requires strong keys/HTTPS in production and errors never expose internal exception details', () => {
  const config = { jwtSecret: 'test-jwt-'.repeat(6), serviceAuthSecret: 'test-service-'.repeat(6), nodeEnv: 'production', usersServiceUrl: 'https://users.example.test', contentServiceUrl: 'https://content.example.test' }
  validateRuntime(config)
  assert.throws(() => validateRuntime({ ...config, jwtSecret: 'short' }))
  assert.throws(() => validateRuntime({ ...config, contentServiceUrl: 'http://content.example.test' }))
  assert.equal(formatError({ message: 'private DB path credential value', extensions: { code: 'INTERNAL_SERVER_ERROR', stacktrace: ['private'] } }).extensions.code, 'SERVICE_UNAVAILABLE')
  assert.equal(JSON.stringify(formatError({ message: 'secret', extensions: {} })).includes('secret'), false)
})

test('domain clients batch public profiles and memoize published content only within each request', async () => {
  const calls = [], charged = []
  const clients = createDomainClients({ serviceAuthSecret: 'test', usersServiceUrl: 'http://users.example.test', contentServiceUrl: 'http://content.example.test', upstreamTimeoutMs: 1000 }, async (url, options) => {
    calls.push(url); assert.equal(options.headers.Authorization, undefined)
    return Response.json(url.pathname.includes('profiles') ? { items: [{ id: 'a', name: 'Author' }] } : { publication: { id: 'publication', status: 'published', blocks: [] } })
  })
  const current = clients.forRequest((amount = 1) => charged.push(amount))
  const [a, absent, repeated] = await Promise.all([current.profile('a'), current.profile('b'), current.profile('a')])
  assert.equal(a, repeated); assert.equal(absent, null); assert.equal(calls.length, 1)
  await Promise.all([current.publication('publication'), current.publication('publication')])
  assert.equal(calls.length, 2)
  await clients.forRequest(() => {}).publication('publication')
  assert.equal(calls.length, 3)
  assert.equal(charged.reduce((sum, value) => sum + value, 0), 3)
})

test('Firestore declares the three paginated interaction query shapes and excludes comment bodies from indexing', () => {
  const definition = JSON.parse(readFileSync(new URL('../../../firestore.indexes.json', import.meta.url), 'utf8'))
  for (const [name, fields] of [['comments', ['publicationId', 'isDeleted', 'createdAt', '__name__']], ['savedPublications', ['userId', 'active', 'updatedAt', '__name__']], ['follows', ['userId', 'active', 'updatedAt', '__name__']]]) {
    const index = definition.indexes.find((item) => item.collectionGroup === name)
    assert.deepEqual(index.fields.map((field) => field.fieldPath), fields)
    assert.equal(index.fields[2].order, name === 'comments' ? 'ASCENDING' : 'DESCENDING')
    assert.equal(index.fields[3].order, 'ASCENDING')
  }
  assert.ok(definition.fieldOverrides.some((item) => item.collectionGroup === 'comments' && item.fieldPath === 'text' && item.indexes.length === 0))
})
