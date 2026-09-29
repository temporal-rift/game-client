import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'

// Downloads each backend contract jar pinned in contracts.json from Maven Central, verifies it
// against Central's published SHA-256, and extracts its
// OpenAPI specs into .contracts/<module>/openapi/. The specs are never copied into this repository
// (see the temporal-rift/apis README): the published artifact is the only source, and the version
// pinned in contracts.json is the only thing to review when a contract changes.
const root = fileURLToPath(new URL('..', import.meta.url))
const GROUP_PATH = 'io/github/temporal-rift'
const REPOSITORY = process.env.MAVEN_REPOSITORY_URL ?? 'https://repo1.maven.org/maven2'
const contracts = JSON.parse(readFileSync(join(root, 'contracts.json'), 'utf8'))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Central answers 429 when a runner shares a busy IP; back off instead of failing the build.
async function download(url) {
  const delays = [2000, 4000, 8000, 16000]
  for (let attempt = 0; ; attempt += 1) {
    let failure
    try {
      const response = await fetch(url)
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer())
      }
      failure = `HTTP ${response.status}`
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`Could not download ${url}: ${failure}`)
      }
    } catch (error) {
      if (String(error.message).startsWith('Could not download')) {
        throw error
      }
      failure = error.message
    }
    if (attempt >= delays.length) {
      throw new Error(`Could not download ${url}: ${failure}`)
    }
    console.log(`  ${failure} for ${url}; retrying in ${delays[attempt] / 1000}s`)
    await sleep(delays[attempt])
  }
}

function extractSpecs(jar, destination) {
  const entries = unzipSync(jar, { filter: (file) => file.name.startsWith('openapi/') && !file.name.endsWith('/') })
  const names = Object.keys(entries)
  if (names.length === 0) {
    throw new Error('The jar carries no openapi/ specs.')
  }
  for (const name of names) {
    const target = normalize(join(destination, name))
    if (!target.startsWith(destination + sep)) {
      throw new Error(`Refusing to extract ${name} outside ${destination}.`)
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, entries[name])
  }
  return names
}

async function fetchContract(module, version) {
  const destination = join(root, '.contracts', module)
  const stamp = join(destination, '.version')
  if (existsSync(stamp) && readFileSync(stamp, 'utf8') === version) {
    console.log(`${module}@${version}: up to date`)
    return
  }
  const jarUrl = `${REPOSITORY}/${GROUP_PATH}/${module}/${version}/${module}-${version}.jar`
  const jar = await download(jarUrl)
  const expectedSha256 = (await download(`${jarUrl}.sha256`)).toString('utf8').trim().split(/\s+/)[0]
  const actualSha256 = createHash('sha256').update(jar).digest('hex')
  if (actualSha256 !== expectedSha256) {
    throw new Error(`${module}@${version}: checksum mismatch (expected ${expectedSha256}, got ${actualSha256}).`)
  }
  rmSync(destination, { recursive: true, force: true })
  mkdirSync(destination, { recursive: true })
  const names = extractSpecs(jar, destination)
  writeFileSync(stamp, version)
  console.log(`${module}@${version}: ${names.join(', ')}`)
}

for (const [module, version] of Object.entries(contracts)) {
  if (!/^[a-z]+(-[a-z]+)*-api$/.test(module) || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`contracts.json: "${module}": "${version}" is not a pinned <module>-api release.`)
  }
  await fetchContract(module, version)
}
