import { ApolloClient, ApolloLink, InMemoryCache, Observable } from '@apollo/client'
import { print } from 'graphql'
import { ApiError, apiUrl, gatewayRequest, getSession } from './gatewayClient'

const configuredUrl = import.meta.env.VITE_GRAPHQL_URL || apiUrl + '/interactions'
if (configuredUrl.replace(/\/$/, '') !== apiUrl + '/interactions') throw new Error('VITE_GRAPHQL_URL must match VITE_API_URL + /interactions (the gateway).')

const link = new ApolloLink((operation) => new Observable((observer) => {
  const controller = new AbortController(), external = operation.getContext().signal
  const identity = getSession().user?.id ?? null
  const abort = () => { controller.abort(); observer.error(new DOMException('Request aborted', 'AbortError')) }
  external?.addEventListener('abort', abort, { once: true })
  if (external?.aborted) { abort(); external.removeEventListener('abort', abort); return }
  gatewayRequest('/interactions', { method: 'POST', signal: controller.signal, anonymous: operation.getContext().anonymous === true,
    body: { query: print(operation.query), variables: operation.variables, operationName: operation.operationName },
  }).then((result) => {
    if (controller.signal.aborted) return
    if (identity !== (getSession().user?.id ?? null)) throw new ApiError('Cambió la sesión. Vuelve a cargar este contenido.', 401, 'session_changed')
    observer.next(result); observer.complete()
  }).catch((error) => { if (!controller.signal.aborted) observer.error(error) })
  return () => { external?.removeEventListener('abort', abort); controller.abort() }
}))

export const apolloClient = new ApolloClient({
  link,
  cache: new InMemoryCache(),
  queryDeduplication: false,
  defaultOptions: { query: { fetchPolicy: 'no-cache', errorPolicy: 'none' }, watchQuery: { fetchPolicy: 'no-cache', errorPolicy: 'none' }, mutate: { fetchPolicy: 'no-cache', errorPolicy: 'none' } },
})

export function interactionError(error) {
  if (error.networkError instanceof ApiError) return error.networkError
  if (error instanceof ApiError) return error
  const failure = error.graphQLErrors?.[0]
  if (failure) {
    const status = { BAD_USER_INPUT: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, SERVICE_UNAVAILABLE: 503, OPERATION_LIMIT: 400 }[failure.extensions?.code] ?? 500
    return new ApiError(failure.message, status, failure.extensions?.code, failure.extensions?.fields)
  }
  return new ApiError('No se pudieron cargar las interacciones. Inténtalo de nuevo.')
}

export async function queryInteractions(query, variables, options = {}) {
  try { return (await apolloClient.query({ query, variables, context: options })).data } catch (error) { throw interactionError(error) }
}

export async function mutateInteractions(mutation, variables) {
  try { return (await apolloClient.mutate({ mutation, variables })).data } catch (error) { throw interactionError(error) }
}
