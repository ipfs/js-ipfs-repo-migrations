/* eslint-env mocha */
'use strict'

const { Buffer } = require('buffer')
const loadFixture = require('aegir/fixtures')
const { CONFIG_KEY, VERSION_KEY, getDatastoreAndOptions } = require('../src/utils')

const repoOptions = {
  lock: 'memory',
  storageBackends: {
    root: require('datastore-level'),
    blocks: require('datastore-level'),
    keys: require('datastore-level'),
    datastore: require('datastore-level'),
    pins: require('datastore-level')
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

async function createRepo () {
  const {
    StorageBackend,
    storageOptions
  } = getDatastoreAndOptions(repoOptions, 'root')

  const date = Date.now().toString()
  const dir = 'test-repo-for-' + date
  const store = new StorageBackend(dir, {
    ...storageOptions,
    createIfMissing: true
  })
  await store.open()
  await store.close()
  return dir
}

async function createAndLoadRepo () {
  const {
    StorageBackend,
    storageOptions
  } = getDatastoreAndOptions(repoOptions, 'root')

  const date = Date.now().toString()
  const dir = 'test-repo-for-' + date
  const store = new StorageBackend(dir, {
    ...storageOptions,
    createIfMissing: true
  })
  await store.open()

  await store.put(VERSION_KEY, Buffer.from(loadFixture('test/fixtures/test-repo/version')))
  await store.put(CONFIG_KEY, Buffer.from(loadFixture('test/fixtures/test-repo/config')))

  await store.close()

  return dir
}

async function repoCleanup (dir) {
}

describe('Browser specific tests', () => {
  describe('lock.js tests', () => {
    describe('mem-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock-memory'), createRepo, repoCleanup, repoOptions)
    })
  })

  describe('version tests', () => {
    require('./version-test')(createRepo, repoCleanup, repoOptions)
  })

  describe('migrations tests', () => {
    require('./migrations/migration-8-test')(createRepo, repoCleanup, repoOptions)
  })

  describe('init tests', () => {
    require('./init-test')(createRepo, repoCleanup, repoOptions)
  })

  describe('integration tests', () => {
    require('./integration-test')(createAndLoadRepo, repoCleanup, repoOptions)
  })
})
