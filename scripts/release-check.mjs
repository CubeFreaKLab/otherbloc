import { execFileSync } from 'node:child_process'
import { appendFile, readFile } from 'node:fs/promises'
import { assertReleaseContext, readRenderConfig, waitForRevision } from './release/render.mjs'
import { assertCleanManifest, checkProductionProtection, readHostingConfig, verifyHosting } from './release/hosting.mjs'
import { assertDisposableCheckout } from './ci-config.mjs'

try {
  const mode = process.argv[2]
  if (process.argv.length !== 3 || !['--context', '--protection', '--config', '--build', '--live'].includes(mode)) throw new Error('Choose a documented release check mode')
  assertReleaseContext(process.env, process.env.GITHUB_SHA)
  if (mode === '--context') {
    console.log('Manual main-branch release context matches the approved SHA')
  } else if (mode === '--protection') {
    console.log(JSON.stringify(await checkProductionProtection(process.env.GITHUB_TOKEN)))
  } else {
    const render = readRenderConfig()
    const hosting = readHostingConfig(process.env, render.services.at(-1).origin)
    if (mode === '--config' || mode === '--build') {
      const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim()
      if (head !== render.revision || changes) throw new Error('Release requires the exact clean checkout')
      await assertDisposableCheckout(process.cwd())
      if (mode === '--build') assertCleanManifest(JSON.parse(await readFile('frontend/dist/version.json', 'utf8')), render.revision)
      console.log('Release ' + mode + ' verified at ' + render.revision)
    } else {
      await verifyHosting(hosting, render.revision)
      for (const service of render.services) await waitForRevision(service, render.revision)
      const summary = '## Deployed version checks passed\n\nCommit: `' + render.revision + '`\n\n'
        + [hosting.origin, ...render.services.map(({ origin }) => origin)].map((origin) => '- [' + origin + '](' + origin + ')').join('\n')
        + '\n\nAll five version surfaces matched. This is not three-role cloud acceptance or proof of Firebase business persistence. Preserve this run URL and complete those journeys separately.\n'
      console.log(summary)
      if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
    }
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
