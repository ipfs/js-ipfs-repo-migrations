/* eslint-env mocha */
'use strict'

const os = require('os')
const rimraf = require('rimraf')
const DatastoreFS = require('datastore-fs')
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

function cleanup (dir) {
  rimraf.sync(dir)
}

const CONFIGURATIONS = [{
  name: 'with sharding',
  cleanup,
  /**
   * @param {string} prefix
   * @returns {import('../src/types').Backends}
   */
  createBackends: (prefix) => {
    return {
      root: new DatastoreFS(prefix),
      blocks: new BlockstoreDatastoreAdapter(
        new ShardingDatastore(
          new DatastoreFS(`${prefix}/blocks`, {
            extension: '.data'
          }),
          new NextToLast(2))
      ),
      datastore: new DatastoreLevel(`${prefix}/datastore`),
      keys: new DatastoreLevel(`${prefix}/keys`),
      pins: new DatastoreLevel(`${prefix}/pins`)
    }
  }
}, {
  name: 'without sharding',
  cleanup,
  createBackends: (prefix) => {
    return {
      root: new DatastoreFS(prefix),
      blocks: new BlockstoreDatastoreAdapter(
        new DatastoreFS(`${prefix}/blocks`, {
          extension: '.data'
        })
      ),
      datastore: new DatastoreLevel(`${prefix}/datastore`),
      keys: new DatastoreLevel(`${prefix}/keys`),
      pins: new DatastoreLevel(`${prefix}/pins`)
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
      datastore: new ShardingDatastore(new DatastoreS3(`${prefix}/datastore`, {
        s3: s3Instance,
        createIfMissing: false
      }), new NextToLast(2)),
      keys: new ShardingDatastore(new DatastoreS3(`${prefix}/keys`, {
        s3: s3Instance,
        createIfMissing: false
      }), new NextToLast(2)),
      pins: new ShardingDatastore(new DatastoreS3(`${prefix}/pins`, {
        s3: s3Instance,
        createIfMissing: false
      }), new NextToLast(2))
    }
  }
}]

CONFIGURATIONS.forEach(({ name, createBackends, cleanup }) => {
  const setup = () => createRepo(createBackends, os.tmpdir())

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
