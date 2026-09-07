import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'

const target = process.argv[2] ?? 'http://127.0.0.1:4173/'
const output = path.resolve(process.argv[3] ?? '.project/evidence/performance')
await mkdir(path.join(output, 'chrome-profile'), { recursive: true })
const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless', '--no-sandbox'],
  userDataDir: path.join(output, 'chrome-profile'),
})
try {
  const result = await lighthouse(target, {
    port: chrome.port,
    output: ['html', 'json'],
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    logLevel: 'error',
  })
  await writeFile(path.join(output, 'report.html'), result.report[0])
  await writeFile(path.join(output, 'report.json'), result.report[1])
  console.log(JSON.stringify(Object.fromEntries(Object.entries(result.lhr.categories).map(([key, value]) => [key, value.score * 100])), null, 2))
} finally {
  await chrome.kill()
}
