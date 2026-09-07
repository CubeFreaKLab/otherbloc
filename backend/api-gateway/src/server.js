import { createApp } from './app.js'
import { env, validateRuntime } from './config/env.js'

validateRuntime()
const server = createApp().listen(env.port, () => console.log('API Gateway listening on port ' + env.port))
process.on('SIGTERM', () => server.close())
