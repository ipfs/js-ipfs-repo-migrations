/* eslint-env mocha */
'use strict'

const DatastoreLevel = require('datastore-level')
const DatastoreS3 = require('datastore-s3')
const { ShardingDatastore, shard: { NextToLast } } = require('datastore-core')
const BlockstoreDatastoreAdapter = require('blockstore-datastore-adapter')
const mockS3 = require('./fixtures/mock-s3')
const S3 = require('aws-sdk').S3
const s3Instance = new S3({
  params: {
    Bucket: 'test'
  }
})
mockS3(s3Instance)
const { createRepo } = require('./fixtures/repo')

/**
 * @typedef {import('../src/types').Backends} Backends
 */

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
  /**
   * @param {string} prefix
   * @returns {import('../src/types').Backends}
   */
  createBackends: (prefix) => {
    return {
      root: new DatastoreLevel(prefix, {
        version: 2
      }),
      blocks: new BlockstoreDatastoreAdapter(
        new DatastoreLevel(`${prefix}/blocks`, {
          extension: '.data',
          version: 2
        })
      ),
      datastore: new DatastoreLevel(`${prefix}/datastore`, {
        version: 2
      }),
      keys: new DatastoreLevel(`${prefix}/keys`, {
        version: 2
      }),
      pins: new DatastoreLevel(`${prefix}/pins`, {
        version: 2
      })
    }
  }
}, {
  name: 'with s3',
  cleanup: () => {},
  createBackends: (prefix) => {
    return {
      root: new DatastoreS3(prefix, {
        s3: s3Instance,
        createIfMissing: false
      }),
      blocks: new BlockstoreDatastoreAdapter(
        new ShardingDatastore(
          new DatastoreS3(`${prefix}/blocks`, {
            s3: s3Instance,
            createIfMissing: false,
            extension: '.data'
          }),
          new NextToLast(2)
        )
      ),
      datastore: new ShardingDatastore(
        new DatastoreS3(`${prefix}/datastore`, {
          s3: s3Instance,
          createIfMissing: false
        }),
        new NextToLast(2)
      ),
      keys: new ShardingDatastore(
        new DatastoreS3(`${prefix}/keys`, {
          s3: s3Instance,
          createIfMissing: false
        }),
        new NextToLast(2)
      ),
      pins: new ShardingDatastore(
        new DatastoreS3(`${prefix}/pins`, {
          s3: s3Instance,
          createIfMissing: false
        }),
        new NextToLast(2)
      )
    }
  }
}]

CONFIGURATIONS.forEach(({ name, createBackends, cleanup }) => {
  const setup = (options) => createRepo(createBackends, options)

  describe(name, () => {
    describe('version tests', () => {
      require('./version-test')(setup, cleanup)
    })

    describe('migrations tests', () => {
      require('./migrations')(setup, cleanup)
    })

    describe('init tests', () => {
      require('./init-test')(setup, cleanup)
    })

    describe('integration tests', () => {
      require('./integration-test')(setup, cleanup)
    })
  })
})
