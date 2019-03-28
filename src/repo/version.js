const errors = require('../errors')

const Key = require('interface-datastore').Key

const versionKey = new Key('version')

exports.getVersion = getVersion

/**
 * Function that has responsibility to retrieve version of repo from its root datastore's instance.
 * This function needs to be cross-repo-version functional to be able to fetch any version number,
 * even in case of change of repo's versioning.
 *
 * @param {FsDatastore|LevelDatastore} store
 * @returns Promise<int>
 */
async function getVersion(store) {

  if (!await store.has(versionKey)) {
    throw new errors.UnknownRepoStructure('Repo does not have version file! Is the repo initialized?')
  }

  return parseInt(await store.get(versionKey))
}

/**
 * Function for setting a version in cross-repo-version manner.
 *
 * @param {FsDatastore|LevelDatastore} store
 * @param {int} version
 * @returns {Promise<Promise<void>|*|void|IDBRequest<IDBValidKey>|Promise<void>>}
 */
async function setVersion(store, version) {
  return store.put(versionKey, Buffer.from(String(version)))
}

exports.setVersion = setVersion
