export async function routeResource(path, load, signal) {
  try { return { path, status: 'success', data: await load(path, { signal }), error: null } }
  catch (error) {
    if (signal.aborted) throw error
    return { path, status: 'error', data: null, error }
  }
}
