import { readFileSync } from 'node:fs'

const forbidden = new Set(['pixi.js', 'phaser', 'three'])
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
const found = declared.filter((name) => forbidden.has(name))

if (found.length > 0) {
  console.error(`Forbidden renderer dependency declared: ${found.join(', ')}. The retained 2D DOM/SVG decision excludes PixiJS, Phaser and Three.js.`)
  process.exit(1)
}
