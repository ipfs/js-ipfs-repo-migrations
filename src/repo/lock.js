'use strict'

const debug = require('debug')
// @ts-ignore
const { lock: properLock } = require('proper-lockfile')
const { lock: memoryLock } = require('./lock-memory')

const log = debug('ipfs:repo:migrator:repo_fs_lock')
const lockFile = 'repo.lock'

/**
 * Lock the repo in the given dir and given version.
 *
 * @param {number} version
 * @param {string} dir
 * @param {object} [repoOptions]
 * @param {string} [repoOptions.lock]
 */
async function lock (version, dir, repoOptions) {
  if (repoOptions && repoOptions.lock === 'memory') {
    return memoryLock(version, dir)
  }

  const file = `${dir}/${lockFile}`
  log('locking %s', file)
  const release = await properLock(dir, { lockfilePath: file })
  return {
    close: () => {
      log('releasing lock %s', file)
      return release()
    }
  }
}

module.exports = {
  lock
}
