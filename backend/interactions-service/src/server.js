import { createApp } from './app.js'
import { env, validateRuntime } from './config/env.js'
import { validateFirebaseEnvironment } from './config/firebase.js'

validateRuntime()
validateFirebaseEnvironment()
const { app } = await createApp()

app.listen(env.port, () => {
  console.log(`Interactions Service listening on port ${env.port}`)
})
