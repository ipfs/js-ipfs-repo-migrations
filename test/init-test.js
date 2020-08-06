/* eslint-env mocha */
'use strict'

const { Buffer } = require('buffer')
const { expect } = require('./util')
const { CONFIG_KEY, VERSION_KEY, getDatastoreAndOptions } = require('../src/utils')
const repoInit = require('../src/repo/init')

module.exports = (setup, cleanup, repoOptions) => {
  let dir

  beforeEach(async () => {
    dir = await setup()
  })
  afterEach(() =>
    cleanup(dir)
  )

  it('should return true with valid initialized repo', async () => {
    const {
      StorageBackend,
      storageOptions
    } = getDatastoreAndOptions(repoOptions, 'root')

    const store = new StorageBackend(dir, {
      ...storageOptions,
      createIfMissing: false
    })
    await store.open()
    await store.put(VERSION_KEY, Buffer.from('7'))
    await store.put(CONFIG_KEY, Buffer.from('config'))
    await store.close()

    expect(await repoInit.isRepoInitialized(dir, repoOptions)).to.be.true()
  })

  it('should return false with missing version key', async () => {
    const {
      StorageBackend,
      storageOptions
    } = getDatastoreAndOptions(repoOptions, 'root')

    const store = new StorageBackend(dir, {
      ...storageOptions,
      createIfMissing: false
    })
    await store.open()
    await store.put(CONFIG_KEY, '')
    await store.close()

    expect(await repoInit.isRepoInitialized(dir, repoOptions)).to.be.false()
  })

  it('should return false with missing config key', async () => {
    const {
      StorageBackend,
      storageOptions
    } = getDatastoreAndOptions(repoOptions, 'root')

    const store = new StorageBackend(dir, {
      ...storageOptions,
      createIfMissing: false
    })
    await store.open()
    await store.put(VERSION_KEY, '')
    await store.close()

    expect(await repoInit.isRepoInitialized(dir, repoOptions)).to.be.false()
  })

  it('should return false if the repo does not exists', async () => {
    return expect(await repoInit.isRepoInitialized('/some/random/dirrr', repoOptions)).to.be.false()
  })
}
