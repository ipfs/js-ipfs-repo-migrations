'use strict'

const log = require('debug')('ipfs:repo:migrator:repo:init')
const { CONFIG_KEY, VERSION_KEY, createStore } = require('../utils')
const { MissingRepoOptionsError } = require('../errors')

/**
 * @param {string} path
 * @param {any} repoOptions
 */
async function isRepoInitialized (path, repoOptions) {
  if (!repoOptions) {
    throw new MissingRepoOptionsError('Please pass repo options when trying to open a repo')
  }

  let root
  try {
    root = createStore(path, 'root', repoOptions)
    await root.open()
    const versionCheck = await root.has(VERSION_KEY)
    const configCheck = await root.has(CONFIG_KEY)
    if (!versionCheck || !configCheck) {
      log(`Version entry present: ${versionCheck}`)
      log(`Config entry present: ${configCheck}`)
      return false
    }

    return true
  } catch (e) {
    log('While checking if repo is initialized error was thrown: ' + e.message)
    return false
  } finally {
    if (root !== undefined) {
      await root.close()
    }
  }
}

module.exports = {
  isRepoInitialized
}
