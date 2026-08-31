export function serviceTarget(name, baseUrl) {
  if (!name || !baseUrl) {
    throw new TypeError('Service targets require a name and base URL')
  }

  return Object.freeze({ name, baseUrl })
}
