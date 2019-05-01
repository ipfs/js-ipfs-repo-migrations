/* eslint-env mocha */
'use strict'

const Datastore = require('datastore-level')

async function repoSetup () {
  const date = Date.now().toString()
  const dir = 'test-repo-for-' + date
  const store = new Datastore(dir, { extension: '', createIfMissing: true })
  await store.open()
  await store.close()
  return dir
}

async function repoCleanup (dir) {
}

describe('Browser specific tests', () => {
  describe('lock.js tests', () => {
    describe('mem-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock-memory'), repoSetup, repoCleanup)
    })
  })

  describe('version tests', () => {
    require('./version-test')(repoSetup, repoCleanup)
  })

  describe('init tests', () => {
    require('./init-test')(repoSetup, repoCleanup)
  })
})
