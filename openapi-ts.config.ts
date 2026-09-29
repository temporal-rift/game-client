import { readdirSync, readFileSync } from 'node:fs'
import { defineConfig } from '@hey-api/openapi-ts'

// One generated module per backend contract pinned in contracts.json, from the specs
// scripts/fetch-contracts.mjs extracted into .contracts/. Run `npm run generate:api` after a bump.
const contracts: Record<string, string> = JSON.parse(readFileSync('contracts.json', 'utf8'))

function specOf(module: string): string {
  const directory = `.contracts/${module}/openapi/v1`
  const specs = readdirSync(directory).filter((name) => /\.ya?ml$/.test(name))
  if (specs.length !== 1) {
    throw new Error(`${module}: expected one spec in ${directory}, found ${specs.length}. Run npm run contracts:fetch.`)
  }
  return `${directory}/${specs[0]}`
}

export default defineConfig(
  Object.keys(contracts).map((module) => ({
    input: specOf(module),
    output: { path: `src/api/generated/${module.replace(/-api$/, '')}` },
    plugins: [
      // The base URL comes from the runtime config, and requests go through the authenticated fetch.
      { name: '@hey-api/client-fetch', baseUrl: false },
      '@hey-api/typescript',
      // Java serializes offsets as `Z` or `+hh:mm`; both are valid date-times.
      { name: 'zod', dates: { offset: true } },
      // Every request and response is validated against the contract at the client boundary.
      { name: '@hey-api/sdk', validator: true },
    ],
  })),
)
