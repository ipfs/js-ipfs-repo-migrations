/* eslint-env mocha */
'use strict'

const DatastoreFS = require('datastore-fs')
const DatastoreLevel = require('datastore-level')

const CONFIGURATIONS = [{
  name: 'with sharding',
  options: {
    storageBackends: {
      root: DatastoreFS,
      blocks: DatastoreFS,
      datastore: DatastoreLevel,
      keys: DatastoreLevel,
      pins: DatastoreLevel
    },
    storageBackendOptions: {
      root: {
        sharding: true,
        extension: ''
      },
      blocks: {
        sharding: true,
        extension: '.data'
      },
      datastore: {
        sharding: true,
        extension: '.data'
      },
      keys: {
        sharding: true,
        extension: '.data'
      },
      pins: {
        sharding: true,
        extension: '.data'
      }
    }
  }
}, {
  name: 'without sharding',
  options: {
    storageBackends: {
      root: DatastoreFS,
      blocks: DatastoreFS,
      datastore: DatastoreLevel,
      keys: DatastoreLevel,
      pins: DatastoreLevel
    },
    storageBackendOptions: {
      root: {
        sharding: false,
        extension: ''
      },
      blocks: {
        sharding: false,
        extension: '.data'
      },
      datastore: {
        sharding: false,
        extension: '.data'
      },
      keys: {
        sharding: false,
        extension: '.data'
      },
      pins: {
        sharding: false,
        extension: '.data'
      }
    }
  }
}]

module.exports = (createRepo, repoCleanup) => {
  CONFIGURATIONS.forEach(({ name, options }) => {
    describe(name, () => {
      require('./migration-8-test')(createRepo, repoCleanup, options)
      require('./migration-9-test')(createRepo, repoCleanup, options)
    })
  })
}
