/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const expect = chai.expect
const dagpb = require('ipld-dag-pb')
const { DAGNode, DAGLink } = dagpb
const multicodec = require('multicodec')
const multibase = require('multibase')
const all = require('it-all')
const cbor = require('cbor')
const uint8ArrayFromString = require('uint8arrays/from-string')

const migration = require('../../migrations/migration-9')
const { createStore, cidToKey, PIN_DS_KEY, DEFAULT_FANOUT } = require('../../migrations/migration-9/utils')
const CID = require('cids')

function keyToCid (key) {
  const buf = multibase.encoding('base32upper').decode(key.toString().split('/').pop())
  return new CID(buf)
}

const pinnedCid = new CID('QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6wgdr')
const pinRootCid = new CID('QmZ9ANfh6BMFoeinQU1WQ2BQrRea4UusEikQ1kupx3HtsY')

// creates the pinset with the 'welcome to IPFS' files you get when you `jsipfs init`
async function bootstrapBlocks (blockstore, datastore) {
  async function putNode (node, expectedCid) {
    const buf = node.serialize()
    const cid = await dagpb.util.cid(buf, {
      cidVersion: 0,
      hashAlg: multicodec.SHA2_256
    })
    expect(cid.toString()).to.equal(expectedCid)
    await blockstore.put(cidToKey(cid), buf)

    return node.toDAGLink({
      name: '',
      cidVersion: 0,
      hashAlg: multicodec.SHA2_256
    })
  }

  const emptyBlock = await putNode(
    new DAGNode(),
    'QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n'
  )
  const bucket = new Array(DEFAULT_FANOUT).fill(0).map(() => new DAGLink('', 1, emptyBlock.Hash))
  const directLinks = await putNode(
    new DAGNode(uint8ArrayFromString('CggBEIACHQAAAAA=', 'base64urlpad'), bucket),
    'QmbxHkprr5qdLSK8EZWdBzKFzNXGoKrxb7A4PHX3eH6JPp'
  )
  const recursiveLinks = await putNode(
    new DAGNode(uint8ArrayFromString('CggBEIACHQAAAAA=', 'base64urlpad'), [
      ...bucket,
      new DAGLink('', 1, pinnedCid)
    ]),
    'QmdEtks1KYQsrgJ8FXpP1vXygnVHSqnyFTKQ3wcWVd4D2y'
  )

  const pinRoot = await putNode(
    new DAGNode(new Uint8Array(), [
      new DAGLink('direct', directLinks.Tsize, directLinks.Hash),
      new DAGLink('recursive', recursiveLinks.Tsize, recursiveLinks.Hash)
    ]),
    pinRootCid.toString()
  )

  await blockstore.close()
  await datastore.put(PIN_DS_KEY, pinRoot.Hash.multihash)
  await datastore.close()
}

module.exports = (setup, cleanup, options) => {
  describe('migration 9', () => {
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

    describe('forwards', () => {
      beforeEach(async () => {
        await blockstore.open()
        await bootstrapBlocks(blockstore, datastore)

        await datastore.open()
        await expect(datastore.has(PIN_DS_KEY)).to.eventually.be.true()

        await blockstore.close()
        await datastore.close()
      })

      it('should migrate pins forward', async () => {
        await migration.migrate(dir, options)

        await pinstore.open()

        const pins = await all(pinstore.query({}))
        expect(pins).to.have.lengthOf(1)

        const key = pins[0].key
        expect(keyToCid(key).toString()).to.equal(pinnedCid.toString())

        const pin = cbor.decode(pins[0].value)
        expect(pin.depth).to.equal(Infinity)

        await datastore.open()
        await expect(datastore.has(PIN_DS_KEY)).to.eventually.be.false()
      })
    })

    describe('backwards', () => {
      beforeEach(async () => {
        await pinstore.open()
        await pinstore.put(cidToKey(pinnedCid), cbor.encode({
          metadata: {
            foo: 'bar'
          }
        }))
        await pinstore.close()
      })

      it('should migrate pins backward', async () => {
        await migration.revert(dir, options)

        await datastore.open()
        await expect(datastore.has(PIN_DS_KEY)).to.eventually.be.true()

        const buf = await datastore.get(PIN_DS_KEY)
        const cid = new CID(buf)
        expect(cid.toString()).to.equal(pinRootCid.toString())
      })
    })
  })
}
