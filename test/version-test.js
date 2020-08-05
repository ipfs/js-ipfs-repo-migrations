/* eslint-env mocha */
'use strict'

const { expect } = require('./util')

const Datastore = require('datastore-fs')
const Key = require('interface-datastore').Key
const version = require('../src/repo/version')
const uint8ArrayFromString = require('uint8arrays/from-string')
const errors = require('../src/errors')

// When new versioning mechanism is introduced in new version don't forget to update
// the range (from/to) of the previous version test's description

module.exports = (setup, cleanup) => {
  it('getVersion should fail without any version in repo', async () => {
    const dir = await setup()
    await expect(version.getVersion(dir)).to.be.eventually.rejectedWith(errors.NotInitializedRepoError).with.property('code', errors.NotInitializedRepoError.code)
    return cleanup(dir)
  })

  describe('version 7 and bellow', () => {
    let dir

    beforeEach(async () => {
      dir = await setup()
    })
    afterEach(() =>
      cleanup(dir)
    )

    it('should get version number', async () => {
      // Create version file
      const store = new Datastore(dir, { extension: '', createIfMissing: false })
      await store.open()
      await store.put(new Key('config'), uint8ArrayFromString('some dummy config'))
      await store.put(new Key('version'), uint8ArrayFromString('7'))
      await store.close()

      expect(await version.getVersion(dir)).to.be.equal(7)
    })

    it('should set version number', async () => {
      await expect(version.getVersion(dir)).to.be.eventually.rejectedWith(errors.NotInitializedRepoError).with.property('code', errors.NotInitializedRepoError.code)

      // Create version file
      const store = new Datastore(dir, { extension: '', createIfMissing: false })
      await store.open()
      await store.put(new Key('config'), uint8ArrayFromString('some dummy config'))
      await store.put(new Key('version'), uint8ArrayFromString('5'))
      await store.close()

      await version.setVersion(dir, 7)
      expect(await version.getVersion(dir)).to.be.equal(7)
    })
  })
}
