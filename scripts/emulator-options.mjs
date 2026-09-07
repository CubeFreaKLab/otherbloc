export function parseEmulatorArgs(args) {
  const [mode = 'start', flag, ...extra] = args
  if (!['start', 'export', 'test', 'test-running'].includes(mode)) throw new Error('Choose start, export, test or test-running')
  if (extra.length || (flag && (mode !== 'start' || !flag.startsWith('--import=') || !flag.slice(9)))) throw new Error('Only start accepts --import=<snapshot-directory>')
  return { mode, importPath: flag ? flag.slice(9) : null }
}
