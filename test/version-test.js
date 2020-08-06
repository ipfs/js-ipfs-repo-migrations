/* eslint-env mocha */
'use strict'

const { expect } = require('./util')
const { VERSION_KEY, CONFIG_KEY, getDatastoreAndOptions } = require('../src/utils')
const version = require('../src/repo/version')
const uint8ArrayFromString = require('uint8arrays/from-string')
const errors = require('../src/errors')

// When new versioning mechanism is introduced in new version don't forget to update
// the range (from/to) of the previous version test's description

module.exports = (setup, cleanup, repoOptions) => {
  let dir

  beforeEach(async () => {
    dir = await setup()
  })

  afterEach(() => cleanup(dir))

  it('getVersion should fail without any version in repo', async () => {
    await expect(version.getVersion(dir, repoOptions)).to.be.eventually.rejectedWith(errors.NotInitializedRepoError)
      .with.property('code', errors.NotInitializedRepoError.code)
  })

  describe('version 7 and bellow', () => {
    it('should get version number', async () => {
      // Create version file
      const {
        StorageBackend,
        storageOptions
      } = getDatastoreAndOptions(repoOptions, 'root')

      const store = new StorageBackend(dir, {
        ...storageOptions,
        createIfMissing: false
      })

      await store.open()
      await store.put(CONFIG_KEY, uint8ArrayFromString('some dummy config'))
      await store.put(VERSION_KEY, uint8ArrayFromString('7'))
      await store.close()

      expect(await version.getVersion(dir, repoOptions)).to.be.equal(7)
    })

    it('should set version number', async () => {
      await expect(version.getVersion(dir, repoOptions)).to.be.eventually.rejectedWith(errors.NotInitializedRepoError).with.property('code', errors.NotInitializedRepoError.code)

      // Create version file
      const {
        StorageBackend,
        storageOptions
      } = getDatastoreAndOptions(repoOptions, 'root')

      const store = new StorageBackend(dir, {
        ...storageOptions,
        createIfMissing: false
      })

      await store.open()
      await store.put(CONFIG_KEY, uint8ArrayFromString('some dummy config'))
      await store.put(VERSION_KEY, uint8ArrayFromString('5'))
      await store.close()

      await version.setVersion(dir, 7, repoOptions)
      expect(await version.getVersion(dir, repoOptions)).to.be.equal(7)
    })
  })
}
