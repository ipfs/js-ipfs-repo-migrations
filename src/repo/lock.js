'use strict'

const debug = require('debug')
// @ts-ignore
const { lock: properLock } = require('proper-lockfile')

const log = debug('ipfs:repo:migrator:repo_fs_lock')
const lockFile = 'repo.lock'

/**
 * Lock the repo in the given dir and given version.
 *
 * @param {number} version
 * @param {string} dir
 */
async function lock (version, dir) {
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
