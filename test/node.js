/* eslint-env mocha */
'use strict'

const os = require('os')
const rimraf = require('rimraf')
const DatastoreFS = require('datastore-fs')
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

function cleanup (dir) {
  rimraf.sync(dir)
}

const CONFIGURATIONS = [{
  name: 'with sharding',
  cleanup,
  repoOptions: {
    storageBackends: {
      root: DatastoreFS,
      blocks: DatastoreFS,
      datastore: DatastoreLevel,
      keys: DatastoreLevel,
      pins: DatastoreLevel
    },
    storageBackendOptions: {
      root: {
        extension: ''
      },
      blocks: {
        sharding: true,
        extension: '.data'
      },
      datastore: {},
      keys: {},
      pins: {}
    }
  }
}, {
  name: 'without sharding',
  cleanup,
  repoOptions: {
    storageBackends: {
      root: DatastoreFS,
      blocks: DatastoreFS,
      datastore: DatastoreLevel,
      keys: DatastoreLevel,
      pins: DatastoreLevel
    },
    storageBackendOptions: {
      root: {
        extension: ''
      },
      blocks: {
        sharding: false,
        extension: '.data'
      },
      datastore: {},
      keys: {},
      pins: {}
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
  const setup = () => createRepo(repoOptions, os.tmpdir())

  describe(name, () => {
    if (repoOptions.lock === 'memory') {
      describe('mem-lock tests', () => {
        require('./lock-test')(require('../src/repo/lock-memory'), setup, cleanup, repoOptions)
      })
    } else {
      describe('fs-lock tests', () => {
        require('./lock-test')(require('../src/repo/lock'), setup, cleanup, repoOptions)
      })
    }

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
})
