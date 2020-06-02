/* eslint-env mocha */
'use strict'

const { Buffer } = require('buffer')
const loadFixture = require('aegir/fixtures')
const Datastore = require('datastore-idb')

const Key = require('interface-datastore').Key
const CONFIG_KEY = new Key('config')
const VERSION_KEY = new Key('version')

async function createRepo () {
  const date = Date.now().toString()
  const dir = 'test-repo-for-' + date
  const store = new Datastore(dir, { extension: '', createIfMissing: true })
  await store.open()
  await store.close()
  return dir
}

async function createAndLoadRepo () {
  const date = Date.now().toString()
  const dir = 'test-repo-for-' + date
  const store = new Datastore(dir, { extension: '', createIfMissing: true })
  await store.open()

  await store.put(VERSION_KEY, Buffer.from(loadFixture('test/fixtures/test-repo/version')))
  await store.put(CONFIG_KEY, Buffer.from(loadFixture('test/fixtures/test-repo/config')))

  return dir
}

async function repoCleanup (dir) {
}

describe('Browser specific tests', () => {
  describe('lock.js tests', () => {
    describe('mem-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock-memory'), createRepo, repoCleanup)
    })
  })

  describe('version tests', () => {
    require('./version-test')(createRepo, repoCleanup)
  })

  describe('migrations tests', () => {
    require('./migrations/migration-8-test')(createRepo, repoCleanup)
  })

  describe('init tests', () => {
    require('./init-test')(createRepo, repoCleanup)
  })

  describe('integration tests', () => {
    require('./integration-test')(createAndLoadRepo, repoCleanup)
  })
})
