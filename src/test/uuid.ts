/**
 * Deterministic, contract-valid (RFC 9562 v4-shaped) UUIDs for tests: the
 * API contracts type every identifier as a uuid, and readable labels keep
 * fixtures legible. The same label always yields the same UUID.
 */
export function uuid(label: string): string {
  // Two independent FNV-1a passes give 64 bits each; plenty to keep labels apart.
  const hex = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]
    .map((seed) => {
      let hash = seed
      for (const character of label) {
        hash = Math.imul(hash ^ character.codePointAt(0)!, 0x01000193) >>> 0
      }
      return hash.toString(16).padStart(8, '0')
    })
    .join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
