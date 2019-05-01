/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect

const Datastore = require('datastore-fs')
const Key = require('interface-datastore').Key
const version = require('../src/repo/version')

// When new versioning mechanism is introduced in new version don't forget to update
// the range (from/to) of the previous version test's description

module.exports = (setup, cleanup) => {
  it('getVersion should fail without any version in repo', async () => {
    const dir = await setup()
    await expect(version.getVersion(dir)).to.be.eventually.rejectedWith('Repo does not have version file! Is the repo initialized?')
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
      const versionKey = new Key('version')
      const store = new Datastore(dir, { extension: '', createIfMissing: false })
      await store.open()
      await store.put(versionKey, Buffer.from('7'))
      await store.close()

      expect(await version.getVersion(dir)).to.be.equal(7)
    })

    it('should set version number', async () => {
      await expect(version.getVersion(dir)).to.be.eventually.rejectedWith('Repo does not have version file! Is the repo initialized?')
      await version.setVersion(dir, 7)
      expect(await version.getVersion(dir)).to.be.equal(7)
    })
  })
}
