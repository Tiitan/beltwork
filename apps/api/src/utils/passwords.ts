import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hashBuffer = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt$${salt}$${hashBuffer.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const hashParts = storedHash.split('$')
  if (hashParts.length !== 3 || hashParts[0] !== 'scrypt') {
    return false
  }

  const [, salt, expectedHashHex] = hashParts
  const actualHashBuffer = (await scrypt(password, salt, 64)) as Buffer
  const expectedHashBuffer = Buffer.from(expectedHashHex, 'hex')

  if (actualHashBuffer.length !== expectedHashBuffer.length) {
    return false
  }

  return timingSafeEqual(actualHashBuffer, expectedHashBuffer)
}
