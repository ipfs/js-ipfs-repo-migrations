/* eslint-env mocha */
'use strict'

const DatastoreLevel = require('datastore-level')
const { createRepo, createAndLoadRepo } = require('./fixtures/repo')

const repoOptions = {
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

async function repoCleanup (dir) {
  await deleteDb(dir)
  await deleteDb('level-js-' + dir)

  for (const type of ['blocks', 'keys', 'datastore', 'pins']) {
    await deleteDb(dir + '/' + type)
    await deleteDb('level-js-' + dir + '/' + type)
  }
}

describe('Browser specific tests', () => {
  describe('lock.js tests', () => {
    describe('mem-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock-memory'), () => createRepo(repoOptions), repoCleanup, repoOptions)
    })
  })

  describe('version tests', () => {
    require('./version-test')(() => createRepo(repoOptions), repoCleanup, repoOptions)
  })

  describe('migrations tests', () => {
    require('./migrations')(() => createRepo(repoOptions), repoCleanup)
  })

  describe('init tests', () => {
    require('./init-test')(() => createRepo(repoOptions), repoCleanup, repoOptions)
  })

  describe('integration tests', () => {
    require('./integration-test')(() => createAndLoadRepo(repoOptions), repoCleanup, repoOptions)
  })
})
