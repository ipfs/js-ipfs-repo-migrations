'use strict'

const CID = require('cids')
const dagpb = require('ipld-dag-pb')
const cbor = require('cbor')
const multicodec = require('multicodec')
const pinset = require('./pin-set')
const { createStore, cidToKey, PIN_DS_KEY, PinTypes } = require('./utils')

async function pinsToDatastore (blockstore, datastore, pinstore) {
  const mh = await datastore.get(PIN_DS_KEY)
  const cid = new CID(mh)

  const pinRootBuf = await blockstore.get(cidToKey(cid))
  const pinRoot = dagpb.util.deserialize(pinRootBuf)

  for await (const cid of pinset.loadSet(blockstore, pinRoot, PinTypes.recursive)) {
    await pinstore.put(cidToKey(cid), cbor.encode({
      cid: cid.buffer,
      type: PinTypes.recursive
    }))
  }

  for await (const cid of pinset.loadSet(blockstore, pinRoot, PinTypes.direct)) {
    await pinstore.put(cidToKey(cid), cbor.encode({
      cid: cid.buffer,
      type: PinTypes.direct
    }))
  }

  await blockstore.delete(cidToKey(cid))
  await datastore.delete(PIN_DS_KEY)
}

async function pinsToDAG (blockstore, datastore, pinstore) {
  let recursivePins = []
  let directPins = []

  for await (const { value } of pinstore.query({})) {
    const pin = cbor.decode(value)

    if (pin.type === PinTypes.recursive) {
      recursivePins.push(new CID(pin.cid))
    }

    if (pin.type === PinTypes.direct) {
      directPins.push(new CID(pin.cid))
    }
  }

  const pinRoot = new dagpb.DAGNode(Buffer.alloc(0), [
    await pinset.storeSet(blockstore, PinTypes.recursive, recursivePins),
    await pinset.storeSet(blockstore, PinTypes.direct, directPins)
  ])
  const buf = pinRoot.serialize()
  const cid = await dagpb.util.cid(buf, {
    cidVersion: 0,
    hashAlg: multicodec.SHA2_256,
  })
  await blockstore.put(cidToKey(cid), buf)
  await datastore.put(PIN_DS_KEY, cid.multihash)
}

async function process (repoPath, options, fn) {
  const blockstore = await createStore(repoPath, 'blocks', options)
  const datastore = await createStore(repoPath, 'datastore', options)
  const pinstore = await createStore(repoPath, 'pins', options)

  await blockstore.open()
  await datastore.open()
  await pinstore.open()

  try {
    await fn(blockstore, datastore, pinstore)
  } finally {
    await pinstore.close()
    await datastore.close()
    await blockstore.close()
  }
}

module.exports = {
  version: 9,
  description: 'Migrates pins to datastore',
  migrate: (repoPath, options = {}) => {
    return process(repoPath, options, pinsToDatastore)
  },
  revert: (repoPath, options = {}) => {
    return process(repoPath, options, pinsToDAG)
  }
}
