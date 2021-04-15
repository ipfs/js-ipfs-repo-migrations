/* eslint-env mocha */
'use strict'

const DatastoreLevel = require('datastore-level')
const DatastoreS3 = require('datastore-s3')
const mockS3 = require('./fixtures/mock-s3')
const S3 = require('aws-sdk').S3
const s3Instance = new S3({
  params: {
    Bucket: 'test'
  }
})
mockS3(s3Instance)
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
}, {
  name: 'with s3',
  cleanup: () => {},
  repoOptions: {
    lock: 'memory',
    storageBackends: {
      root: DatastoreS3,
      blocks: DatastoreS3,
      datastore: DatastoreS3,
      keys: DatastoreS3,
      pins: DatastoreS3
    },
    storageBackendOptions: {
      root: {
        sharding: true,
        extension: '',
        s3: s3Instance,
        createIfMissing: false
      },
      blocks: {
        sharding: true,
        extension: '.data',
        s3: s3Instance,
        createIfMissing: false
      },
      datastore: {
        sharding: true,
        s3: s3Instance,
        createIfMissing: false
      },
      keys: {
        sharding: true,
        s3: s3Instance,
        createIfMissing: false
      },
      pins: {
        sharding: true,
        s3: s3Instance,
        createIfMissing: false
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
