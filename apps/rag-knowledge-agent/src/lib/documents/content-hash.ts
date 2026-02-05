import { createHash } from 'crypto'

/**
 * Compute SHA-256 hash of document content for change detection.
 * Use the same input type when comparing (e.g. both from Blob or both from string).
 */
export async function computeContentHash(input: Blob | ArrayBuffer | string): Promise<string> {
  let bytes: Buffer
  if (typeof input === 'string') {
    bytes = Buffer.from(input, 'utf8')
  } else if (input instanceof ArrayBuffer) {
    bytes = Buffer.from(input)
  } else {
    const ab = await input.arrayBuffer()
    bytes = Buffer.from(ab)
  }
  return createHash('sha256').update(bytes).digest('hex')
}
