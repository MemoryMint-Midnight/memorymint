/**
 * Browser-side AES-GCM encryption/decryption for private keepsakes.
 *
 * CEK derivation:
 *   IKM  = CIP-30 signData(address, "memorymint:decrypt:v1:" + contentHash).signature
 *   CEK  = HKDF-SHA256(IKM, salt=empty, info="memorymint:cek:v1", length=32 bytes)
 *
 * Wire format: [12 bytes IV][AES-GCM ciphertext + 16-byte tag]
 */

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2) as Uint8Array<ArrayBuffer>
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

export async function sha256File(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function deriveKeyFromSignature(signatureHex: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    'raw',
    hexToBytes(signatureHex),
    'HKDF',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('memorymint:cek:v1'),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptFile(
  file: File,
  key: CryptoKey,
): Promise<Blob> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = await file.arrayBuffer()
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const out = new Uint8Array(12 + ciphertext.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(ciphertext), 12)
  return new Blob([out], { type: 'application/octet-stream' })
}

export async function decryptFileBuffer(
  encryptedBuffer: ArrayBuffer,
  key: CryptoKey,
  mimeType: string,
): Promise<Blob> {
  const bytes = new Uint8Array(encryptedBuffer)
  const iv = bytes.slice(0, 12)
  const ciphertext = bytes.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new Blob([plaintext], { type: mimeType })
}
