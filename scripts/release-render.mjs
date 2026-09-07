import { assertReleaseContext, createRenderClient, deployRender, preflightRender, readRenderConfig } from './release/render.mjs'

try {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !['--preflight', '--deploy'].includes(args[0])) throw new Error('Choose --preflight (read-only) or --deploy (approved release workflow only)')
  const config = readRenderConfig()
  if (args[0] === '--deploy') assertReleaseContext(process.env, config.revision)
  const request = createRenderClient(process.env.RENDER_API_KEY)
  const result = args[0] === '--preflight' ? await preflightRender(config, request) : await deployRender(config, request)
  console.log(JSON.stringify({ mode: args[0], result }, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
