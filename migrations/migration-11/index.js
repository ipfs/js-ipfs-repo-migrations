'use strict'

const { Key } = require('interface-datastore')

const MFS_ROOT_KEY = new Key('/local/filesroot')

/**
 * @param {import('../../src/types').Backends} backends
 * @param {import('../../src/types').MigrationProgressCallback} onProgress
 */
async function storeMfsRootInDatastore (backends, onProgress = () => {}) {
  onProgress(100, 'Migrating MFS root to repo datastore')

  backends.root.open()
  backends.datastore.open()

  const root = await backends.root.get(MFS_ROOT_KEY)
  await backends.datastore.put(MFS_ROOT_KEY, root)
  await backends.root.delete(MFS_ROOT_KEY)

  backends.datastore.close()
  backends.root.close()

  onProgress(100, 'Stored MFS root in repo datastore')
}

/**
 * @param {import('../../src/types').Backends} backends
 * @param {import('../../src/types').MigrationProgressCallback} onProgress
 */
 async function storeMfsRootInRoot (backends, onProgress = () => {}) {
  onProgress(100, 'Migrating MFS root to repo root datastore')

  backends.root.open()
  backends.datastore.open()

  const root = await backends.datastore.get(MFS_ROOT_KEY)
  await backends.root.put(MFS_ROOT_KEY, root)
  await backends.datastore.delete(MFS_ROOT_KEY)

  backends.datastore.close()
  backends.root.close()

  onProgress(100, 'Stored MFS root in repo root datastore')
}

/** @type {import('../../src/types').Migration} */
module.exports = {
  version: 11,
  description: 'Store mfs root in the datastore',
  migrate: storeMfsRootInDatastore,
  revert: storeMfsRootInRoot
}
