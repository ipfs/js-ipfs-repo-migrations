/* eslint-env mocha */
'use strict'

const { expect } = require('./util')

// When new lock mechanism is introduced in new version don't forget to update
// the range (from/to) of the previous version test's description

module.exports = (locker, setup, cleanup) => {
  describe('version 7 and bellow', () => {
    let dir

    beforeEach(async () => { dir = await setup() })
    afterEach(() => cleanup(dir))

    it('should return lock object', async () => {
      const lock = await locker.lock(7, dir)

      expect(lock).to.have.property('close')
      expect(lock.close).to.be.a('function')
    })

    it('should prevent acquiring multiple locks for the same dir', async () => {
      await locker.lock(7, dir)
      return expect(locker.lock(7, dir)).to.be.eventually.rejected()
    })

    it('should release lock', async () => {
      let lock
      lock = await locker.lock(7, dir)

      // It will fail because lock already exists
      await expect(locker.lock(7, dir)).to.be.eventually.rejected()
      await lock.close()

      // Lets try to lock it one more time to validate it was released
      lock = await locker.lock(7, dir)
      await lock.close()
    })
  })
}
