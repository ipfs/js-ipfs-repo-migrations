'use strict'

const debug = require('debug')
const log = debug('ipfs:repo:migrator:repo_mem_lock')
const lockFile = 'repo.lock'

/**
 * @type {Record<string, boolean>}
 */
const LOCKS = {}

/**
 * Lock the repo in the given dir and for given repo version.
 *
 * @param {number} version
 * @param {string} dir
 */
exports.lock = async function lock (version, dir) { // eslint-disable-line require-await
  const file = dir + '/' + lockFile
  log('locking %s', file)

  if (LOCKS[file] === true) {
    throw Error(`There is already present lock for: ${file}`)
  }

  LOCKS[file] = true
  return {
    close () {
      if (LOCKS[file]) {
        log('releasing lock %s', file)
        delete LOCKS[file]
      }
    }
  }
}
