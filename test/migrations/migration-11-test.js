/* eslint-env mocha */
/* eslint-disable max-nested-callbacks */
'use strict'

const { expect } = require('aegir/utils/chai')
const { CID } = require('multiformats/cid')
const migration = require('../../migrations/migration-11')
const { Key } = require('interface-datastore')

const MFS_ROOT_KEY = new Key('/local/filesroot')
const MFS_ROOT = CID.parse('Qmc42sn2WBHYeAShU3nx8mYkhKVq4sRLapawTaGh4XH4iE')

module.exports = (setup, cleanup) => {
  describe('migration 11', function () {
    this.timeout(240 * 1000)
    let dir
    let backends

    beforeEach(async () => {
      ({ dir, backends } = await setup())
    })

    afterEach(async () => {
      await cleanup(dir)
    })

    describe('forwards', () => {
      beforeEach(async () => {
        await backends.root.open()
        await backends.root.put(MFS_ROOT_KEY, MFS_ROOT.bytes)
        await backends.root.close()
      })

      it('should migrate MFS root forward', async () => {
        await migration.migrate(backends, () => {})

        await backends.root.open()
        await backends.datastore.open()

        await expect(backends.root.has(MFS_ROOT_KEY)).to.eventually.be.false()
        await expect(backends.datastore.has(MFS_ROOT_KEY)).to.eventually.be.true()

        await backends.datastore.close()
        await backends.root.close()
      })
    })

    describe('backwards', () => {
      beforeEach(async () => {
        await backends.datastore.open()
        await backends.datastore.put(MFS_ROOT_KEY, MFS_ROOT.bytes)
        await backends.datastore.close()
      })

      it('should migrate MFS root backward', async () => {
        await migration.revert(backends, () => {})

        await backends.root.open()
        await backends.datastore.open()

        await expect(backends.root.has(MFS_ROOT_KEY)).to.eventually.be.true()
        await expect(backends.datastore.has(MFS_ROOT_KEY)).to.eventually.be.false()

        await backends.datastore.close()
        await backends.root.close()
      })
    })
  })
}