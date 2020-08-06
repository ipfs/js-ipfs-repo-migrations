'use strict'

const { Buffer } = require('buffer')
const loadFixture = require('aegir/fixtures')
const { CONFIG_KEY, VERSION_KEY, getDatastoreAndOptions } = require('../../src/utils')

async function createRepo (repoOptions) {
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

async function createAndLoadRepo (repoOptions) {
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

module.exports = {
  createRepo,
  createAndLoadRepo
}
