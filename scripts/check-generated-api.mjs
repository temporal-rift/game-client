import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Fails when the committed generated client differs from what the pinned contracts produce: a
// contract bump without regeneration, or a hand edit to generated code. Run after generate:api.
const root = fileURLToPath(new URL('..', import.meta.url))
// Only the working tree counts: regenerated files that are already staged are not drift.
const drift = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'src/api/generated'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter((line) => line.length > 3 && line[1] !== ' ')

if (drift.length > 0) {
  console.error('src/api/generated does not match the contracts pinned in contracts.json:')
  console.error(drift.slice(0, 20).join('\n'))
  console.error('Run `npm run generate:api` and commit the result.')
  process.exit(1)
}
console.log('src/api/generated matches the pinned contracts.')
