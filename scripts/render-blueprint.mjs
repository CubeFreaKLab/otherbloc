import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const regions = new Set(['oregon', 'ohio', 'virginia', 'frankfurt', 'singapore'])
const plans = new Set(['free', '0.5c-512mb', '1c-2g', '2c-4g', '2c-8g', '2c-16g', '4c-8g', '4c-16g', '4c-32g', '8c-16g', '8c-32g', '8c-64g', '12c-24g', '12c-48g', '12c-96g'])

export function parseBlueprintOptions(args) {
  const options = {}
  for (const argument of args) {
    const match = /^(?:--)(region|plan)=([a-z0-9.-]+)$/.exec(argument)
    if (!match || Object.hasOwn(options, match[1])) throw new Error('Supply exactly --region=<approved-region> and --plan=<approved-plan>')
    options[match[1]] = match[2]
  }
  if (!regions.has(options.region) || !plans.has(options.plan)) throw new Error('An explicit supported region and compute plan are required; there are no defaults')
  return options
}

export async function prepareBlueprint(options) {
  parseBlueprintOptions(['--region=' + options.region, '--plan=' + options.plan])
  const blueprint = JSON.parse(await readFile(new URL('../deploy/render.blueprint.example.json', import.meta.url), 'utf8'))
  for (const service of blueprint.services) { service.region = options.region; service.plan = options.plan }
  return blueprint
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const blueprint = await prepareBlueprint(parseBlueprintOptions(process.argv.slice(2)))
    await writeFile(new URL('../render.yaml', import.meta.url), JSON.stringify(blueprint, null, 2) + '\n', { flag: 'wx' })
    console.log('Prepared render.yaml in JSON-compatible YAML syntax; no account or resource was changed. Review costs, CI, secrets and Blueprint settings before importing it.')
  } catch (error) {
    console.error(error.code === 'EEXIST' ? 'render.yaml already exists; it was not overwritten. Review its changes explicitly.' : error.message)
    process.exitCode = 1
  }
}
