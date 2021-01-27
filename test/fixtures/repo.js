'use strict'

const loadFixture = require('aegir/fixtures')
const { CONFIG_KEY, VERSION_KEY, createStore } = require('../../src/utils')

async function createRepo (repoOptions, prefix) {
  const date = Date.now().toString()
  const dir = `${prefix ? `${prefix}/` : ''}test-repo-for-${date}`
  const store = createStore(dir, 'root', repoOptions)
  await store.open()
  await store.close()
  return dir
}

async function createAndLoadRepo (repoOptions, prefix) {
  const date = Date.now().toString()
  const dir = `${prefix ? `${prefix}/` : ''}test-repo-for-${date}`
  const store = createStore(dir, 'root', repoOptions)
  await store.open()

  await store.put(VERSION_KEY, loadFixture('test/fixtures/test-repo/version'))
  await store.put(CONFIG_KEY, loadFixture('test/fixtures/test-repo/config'))

  await store.close()

  return dir
}

module.exports = {
  createRepo,
  createAndLoadRepo
}
