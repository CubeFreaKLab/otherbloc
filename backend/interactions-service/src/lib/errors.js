import { GraphQLError } from 'graphql'

export function fail(code, message) {
  throw new GraphQLError(message, { extensions: { code } })
}

export function parse(schema, input) {
  const result = schema.safeParse(input)
  if (!result.success) throw new GraphQLError('Comprueba los datos enviados.', { extensions: { code: 'BAD_USER_INPUT', fields: result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) } })
  return result.data
}

export function requireIdentity(identity, userId) {
  if (!identity) fail('UNAUTHENTICATED', 'Inicia sesión para continuar.')
  if (userId !== undefined && userId !== null && userId !== identity.id) fail('FORBIDDEN', 'Solo puedes gestionar tus propias interacciones.')
  return identity
}

const publicCodes = new Set(['BAD_USER_INPUT', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'SERVICE_UNAVAILABLE', 'OPERATION_LIMIT', 'GRAPHQL_PARSE_FAILED', 'GRAPHQL_VALIDATION_FAILED', 'BAD_REQUEST', 'PERSISTED_QUERY_NOT_FOUND', 'PERSISTED_QUERY_NOT_SUPPORTED'])
export function formatError(error) {
  const code = error.extensions?.code
  if (!publicCodes.has(code)) return { message: 'No se pudo completar la operación. Inténtalo de nuevo.', extensions: { code: 'SERVICE_UNAVAILABLE' }, path: error.path }
  return { message: error.message, locations: error.locations, path: error.path, extensions: { code, ...(error.extensions?.fields ? { fields: error.extensions.fields } : {}) } }
}
