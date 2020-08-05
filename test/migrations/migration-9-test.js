/* eslint-env mocha */
/* eslint-disable max-nested-callbacks */
'use strict'

const { expect } = require('aegir/utils/chai')
const cbor = require('cbor')
const migration = require('../../migrations/migration-9')
const { createStore, cidToKey, PIN_DS_KEY } = require('../../migrations/migration-9/utils')
const CID = require('cids')
const CarDatastore = require('datastore-car')
const loadFixture = require('aegir/fixtures')

const pinsets = {
  'default pinset': {
    car: loadFixture('test/fixtures/pinset-default.car'),
    root: new CID('QmZ9ANfh6BMFoeinQU1WQ2BQrRea4UusEikQ1kupx3HtsY'),
    pins: 1
  },
  'multiple bucket pinset': {
    car: loadFixture('test/fixtures/pinset-multiple-buckets.car'),
    root: new CID('QmQbqytjcSLrq5xQPAeFdEEPtTVkmrkWDjdFZwyJ2we7KU'),

    // we need at least 8192 pins in order to create a new bucket
    pins: 9000
  }
}

async function bootstrapBlocks (blockstore, datastore, { car: carBuf, root: expectedRoot }) {
  const car = await CarDatastore.readBuffer(carBuf)
  const [actualRoot] = await car.getRoots()

  expect(actualRoot.toString()).to.equal(expectedRoot.toString())

  for await (const { key, value } of car.query()) {
    await blockstore.put(cidToKey(new CID(key.toString())), value)
  }

  await blockstore.close()
  await datastore.put(PIN_DS_KEY, actualRoot.multihash)
  await datastore.close()
}

module.exports = (setup, cleanup, options) => {
  describe('migration 9', function () {
    this.timeout(240 * 1000)

    let dir
    let datastore
    let blockstore
    let pinstore

    beforeEach(async () => {
      dir = await setup()

      blockstore = await createStore(dir, 'blocks', options)
      datastore = await createStore(dir, 'datastore', options)
      pinstore = await createStore(dir, 'pins', options)
    })

    afterEach(async () => {
      await pinstore.close()
      await datastore.close()
      await blockstore.close()

      cleanup(dir)
    })

    Object.keys(pinsets).forEach(title => {
      const pinset = pinsets[title]
      const pinned = {}

      describe(title, () => {
        describe('forwards', () => {
          beforeEach(async () => {
            await blockstore.open()
            await bootstrapBlocks(blockstore, datastore, pinset)

            await datastore.open()
            await expect(datastore.has(PIN_DS_KEY)).to.eventually.be.true()

            const buf = await datastore.get(PIN_DS_KEY)
            const cid = new CID(buf)
            expect(cid.toString()).to.equal(pinset.root.toString())

            await blockstore.close()
            await datastore.close()
            await pinstore.close()
          })

          it('should migrate pins forward', async () => {
            await migration.migrate(dir, options)

            await pinstore.open()

            for await (const { key, value } of pinstore.query({})) {
              pinned[key] = value

              const pin = cbor.decode(value)
              expect(pin.depth).to.equal(Infinity)
            }

            expect(Object.keys(pinned)).to.have.lengthOf(pinset.pins)

            await datastore.open()
            await expect(datastore.has(PIN_DS_KEY)).to.eventually.be.false()
          })
        })

        describe('backwards', () => {
          beforeEach(async () => {
            await pinstore.open()

            for (const key of Object.keys(pinned)) {
              await pinstore.put(key, pinned[key])
            }

            await pinstore.close()
          })

          it('should migrate pins backward', async () => {
            await migration.revert(dir, options)

            await datastore.open()
            await expect(datastore.has(PIN_DS_KEY)).to.eventually.be.true()

            const buf = await datastore.get(PIN_DS_KEY)
            const cid = new CID(buf)
            expect(cid).to.deep.equal(pinset.root)
          })
        })
      })
    })
  })
}
