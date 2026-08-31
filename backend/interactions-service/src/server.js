import { createApp } from './app.js'
import { env } from './config/env.js'

const { app } = await createApp()

app.listen(env.port, () => {
  console.log(`Interactions Service listening on port ${env.port}`)
})
