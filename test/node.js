/* eslint-env mocha */
'use strict'

const promisify = require('util').promisify
const asyncRimraf = promisify(require('rimraf'))
const { createRepo, createAndLoadRepo } = require('./fixtures/repo')
const os = require('os')

const repoOptions = {
  lock: 'fs',
  storageBackends: {
    root: require('datastore-fs'),
    blocks: require('datastore-fs'),
    keys: require('datastore-fs'),
    datastore: require('datastore-level'),
    pins: require('datastore-level')
  },
  storageBackendOptions: {
    root: {
      extension: ''
    },
    blocks: {
      sharding: true,
      extension: '.data'
    },
    keys: {
    },
    pins: {
    }
  }
}

function repoCleanup (dir) {
  return asyncRimraf(dir)
}

describe('Node specific tests', () => {
  describe('lock.js tests', () => {
    describe('fs-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock'), () => createRepo(repoOptions, os.tmpdir()), repoCleanup, repoOptions)
    })

    describe('mem-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock-memory'), () => createRepo(repoOptions, os.tmpdir()), repoCleanup, repoOptions)
    })
  })

  describe('version tests', () => {
    require('./version-test')(() => createRepo(repoOptions, os.tmpdir()), repoCleanup, repoOptions)
  })

  describe('migrations tests', () => {
    require('./migrations')(() => createRepo(repoOptions, os.tmpdir()), repoCleanup, repoOptions)
  })

  describe('init tests', () => {
    require('./init-test')(() => createRepo(repoOptions, os.tmpdir()), repoCleanup, repoOptions)
  })

  describe('integration tests', () => {
    require('./integration-test')(() => createAndLoadRepo(repoOptions, os.tmpdir()), repoCleanup, repoOptions)
  })
})
