import { timingSafeEqual } from 'node:crypto'
import { GraphQLError, Kind } from 'graphql'

export function requireService(config) {
  return (request, response, next) => {
    const supplied = Buffer.from(request.get('x-service-key') ?? ''), expected = Buffer.from(config.serviceAuthSecret)
    if (expected.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return response.status(403).json({ error: 'service_access_required', message: 'Accede a través del gateway.' })
    response.set('Cache-Control', 'private, no-store')
    next()
  }
}

// Expanded selections are also bounded by Apollo before this custom traversal.
export function boundedOperation(context) {
  return {
    OperationDefinition(node) {
      let roots = 0, deepest = 0
      function count(selectionSet, depth, stack = new Set()) {
        deepest = Math.max(deepest, depth)
        if (!selectionSet || depth > 10) return
        for (const selection of selectionSet.selections) {
          if (selection.kind === Kind.FIELD) {
            if (depth === 1) roots += 1
            count(selection.selectionSet, depth + 1, stack)
          } else if (selection.kind === Kind.INLINE_FRAGMENT) count(selection.selectionSet, depth, stack)
          else if (selection.kind === Kind.FRAGMENT_SPREAD && !stack.has(selection.name.value)) {
            const next = new Set(stack); next.add(selection.name.value)
            count(context.getFragment(selection.name.value)?.selectionSet, depth, next)
          }
        }
      }
      count(node.selectionSet, 1)
      if (roots > 6 || deepest > 10) context.reportError(new GraphQLError('La operación es demasiado amplia o profunda.', { nodes: node, extensions: { code: 'OPERATION_LIMIT' } }))
    },
  }
}
