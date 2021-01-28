'use strict'

const repoInit = require('./init')
const { MissingRepoOptionsError, NotInitializedRepoError } = require('../errors')
const { VERSION_KEY, createStore } = require('../utils')
const uint8ArrayFromString = require('uint8arrays/from-string')
const uint8ArrayToString = require('uint8arrays/to-string')

exports.getVersion = getVersion

/**
 * Function that has responsibility to retrieve version of repo from its root datastore's instance.
 * This function needs to be cross-repo-version functional to be able to fetch any version number,
 * even in case of change of repo's versioning.
 *
 * @param {string} path
 * @param {Object} repoOptions - Options used to create a repo, the same as pased to ipfs-repo
 * @returns {Promise<int>}
 */
async function getVersion (path, repoOptions) {
  if (!(await repoInit.isRepoInitialized(path, repoOptions))) {
    throw new NotInitializedRepoError(`Repo in path ${path} is not initialized!`)
  }

  if (!repoOptions) {
    throw new MissingRepoOptionsError('Please pass repo options when trying to open a repo')
  }

  const store = createStore(path, 'root', repoOptions)
  await store.open()

  let version = await store.get(VERSION_KEY)

  if (version instanceof Uint8Array) {
    version = uint8ArrayToString(version)
  }

  version = parseInt(version)

  await store.close()

  return version
}

/**
 * Function for setting a version in cross-repo-version manner.
 *
 * @param {string} path
 * @param {int} version
 * @param {Object} repoOptions - Options used to create a repo, the same as pased to ipfs-repo
 * @returns {Promise<void>}
 */
async function setVersion (path, version, repoOptions) {
  if (!repoOptions) {
    throw new MissingRepoOptionsError('Please pass repo options when trying to open a repo')
  }

  const store = createStore(path, 'root', repoOptions)
  await store.open()
  await store.put(VERSION_KEY, uint8ArrayFromString(String(version)))
  await store.close()
}

exports.setVersion = setVersion
