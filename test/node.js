/* eslint-env mocha */
'use strict'

const promisify = require('util').promisify
const asyncRimraf = promisify(require('rimraf'))
const { createRepo, createAndLoadRepo } = require('./fixtures/repo')

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
    }
  }
}

function repoCleanup (dir) {
  return asyncRimraf(dir)
}

describe('Node specific tests', () => {
  describe('lock.js tests', () => {
    describe('fs-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock'), () => createRepo(repoOptions), repoCleanup, repoOptions)
    })

    describe('mem-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock-memory'), () => createRepo(repoOptions), repoCleanup, repoOptions)
    })
  })

  describe('version tests', () => {
    require('./version-test')(() => createRepo(repoOptions), repoCleanup, repoOptions)
  })

  describe('migrations tests', () => {
    require('./migrations')(() => createRepo(repoOptions), repoCleanup, repoOptions)
  })

  describe('init tests', () => {
    require('./init-test')(() => createRepo(repoOptions), repoCleanup, repoOptions)
  })

  describe('integration tests', () => {
    require('./integration-test')(() => createAndLoadRepo(repoOptions), repoCleanup, repoOptions)
  })
})
