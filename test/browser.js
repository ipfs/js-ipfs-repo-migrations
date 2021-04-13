/* eslint-env mocha */
'use strict'

const DatastoreLevel = require('datastore-level')
const { createRepo } = require('./fixtures/repo')

async function deleteDb (dir) {
  return new Promise((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase(dir)
    req.onerror = () => {
      console.error(`Could not delete ${dir}`) // eslint-disable-line no-console
      resolve()
    }
    req.onsuccess = () => {
      resolve()
    }
  })
}

async function cleanup (dir) {
  await deleteDb(dir)
  await deleteDb('level-js-' + dir)

  for (const type of ['blocks', 'keys', 'datastore', 'pins']) {
    await deleteDb(dir + '/' + type)
    await deleteDb('level-js-' + dir + '/' + type)
  }
}

const CONFIGURATIONS = [{
  name: 'local',
  cleanup,
  repoOptions: {
    lock: 'memory',
    storageBackends: {
      root: DatastoreLevel,
      blocks: DatastoreLevel,
      keys: DatastoreLevel,
      datastore: DatastoreLevel,
      pins: DatastoreLevel
    },
    storageBackendOptions: {
      root: {
        extension: '',
        prefix: '',
        version: 2
      },
      blocks: {
        sharding: false,
        prefix: '',
        version: 2
      },
      keys: {
        sharding: false,
        prefix: '',
        version: 2
      },
      datastore: {
        sharding: false,
        prefix: '',
        version: 2
      }
    }
  }
}]

CONFIGURATIONS.forEach(({ name, repoOptions, cleanup }) => {
  const setup = () => createRepo(repoOptions)

  describe('lock.js tests', () => {
    describe('mem-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock-memory'), setup, cleanup, repoOptions)
    })
  })

  describe('version tests', () => {
    require('./version-test')(setup, cleanup, repoOptions)
  })

  describe('migrations tests', () => {
    require('./migrations')(setup, cleanup, repoOptions)
  })

  describe('init tests', () => {
    require('./init-test')(setup, cleanup, repoOptions)
  })

  describe('integration tests', () => {
    require('./integration-test')(setup, cleanup, repoOptions)
  })
})
