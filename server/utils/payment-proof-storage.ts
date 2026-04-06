import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const getProofStorageCandidates = () => {
  const cwd = process.cwd()

  return [
    join(cwd, '.output', 'public', 'bills', 'proofs'),
    join(cwd, 'public', 'bills', 'proofs'),
  ]
}

export const resolveWritableProofsDir = () => {
  const existingDir = getProofStorageCandidates().find(dir => existsSync(dir))
  if (existingDir) {
    return existingDir
  }

  return getProofStorageCandidates()[0]
}