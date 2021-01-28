'use strict'

const CID = require('cids')
const dagpb = require('ipld-dag-pb')
const cbor = require('cbor')
const multicodec = require('multicodec')
const multibase = require('multibase')
const pinset = require('./pin-set')
const { createStore } = require('../../src/utils')
const { cidToKey, PIN_DS_KEY, PinTypes } = require('./utils')
const length = require('it-length')

async function pinsToDatastore (blockstore, datastore, pinstore, onProgress) {
  if (!await datastore.has(PIN_DS_KEY)) {
    return
  }

  const mh = await datastore.get(PIN_DS_KEY)
  const cid = new CID(mh)
  const pinRootBuf = await blockstore.get(cidToKey(cid))
  const pinRoot = dagpb.util.deserialize(pinRootBuf)
  let counter = 0
  let pinCount

  if (onProgress) {
    pinCount = (await length(pinset.loadSet(blockstore, pinRoot, PinTypes.recursive))) + (await length(pinset.loadSet(blockstore, pinRoot, PinTypes.direct)))
  }

  for await (const cid of pinset.loadSet(blockstore, pinRoot, PinTypes.recursive)) {
    counter++
    const pin = {
      depth: Infinity
    }

    if (cid.version !== 0) {
      pin.version = cid.version
    }

    if (cid.codec !== 'dag-pb') {
      pin.codec = multicodec.getNumber(cid.codec)
    }

    await pinstore.put(cidToKey(cid), cbor.encode(pin))

    if (onProgress) {
      onProgress((counter / pinCount) * 100, `Migrated recursive pin ${cid}`)
    }
  }

  for await (const cid of pinset.loadSet(blockstore, pinRoot, PinTypes.direct)) {
    counter++
    const pin = {
      depth: 0
    }

    if (cid.version !== 0) {
      pin.version = cid.version
    }

    if (cid.codec !== 'dag-pb') {
      pin.codec = multicodec.getNumber(cid.codec)
    }

    await pinstore.put(cidToKey(cid), cbor.encode(pin))

    onProgress((counter / pinCount) * 100, `Migrated direct pin ${cid}`)
  }

  await blockstore.delete(cidToKey(cid))
  await datastore.delete(PIN_DS_KEY)
}

async function pinsToDAG (blockstore, datastore, pinstore, onProgress) {
  let recursivePins = []
  let directPins = []
  let counter = 0
  let pinCount

  if (onProgress) {
    pinCount = await length(pinstore.query({ keysOnly: true }))
  }

  for await (const { key, value } of pinstore.query({})) {
    counter++
    const pin = cbor.decode(value)
    const cid = new CID(pin.version || 0, pin.codec && multicodec.getName(pin.codec) || 'dag-pb', multibase.decode('b' + key.toString().split('/').pop()))

    if (pin.depth === 0) {
      if (onProgress) {
        onProgress((counter / pinCount) * 100, `Reverted direct pin ${cid}`)
      }

      directPins.push(cid)
    } else {
      if (onProgress) {
        onProgress((counter / pinCount) * 100, `Reverted recursive pin ${cid}`)
      }

      recursivePins.push(cid)
    }
  }

  onProgress(100, 'Updating pin root')
  const pinRoot = new dagpb.DAGNode(new Uint8Array(), [
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

async function process (repoPath, repoOptions, onProgress, fn) {
  const blockstore = createStore(repoPath, 'blocks', repoOptions)
  const datastore = createStore(repoPath, 'datastore', repoOptions)
  const pinstore = createStore(repoPath, 'pins', repoOptions)

  await blockstore.open()
  await datastore.open()
  await pinstore.open()

  try {
    await fn(blockstore, datastore, pinstore, onProgress)
  } finally {
    await pinstore.close()
    await datastore.close()
    await blockstore.close()
  }
}

module.exports = {
  version: 9,
  description: 'Migrates pins to datastore',
  migrate: (repoPath, repoOptions, onProgress = () => {}) => {
    return process(repoPath, repoOptions, onProgress, pinsToDatastore)
  },
  revert: (repoPath, repoOptions, onProgress = () => {}) => {
    return process(repoPath, repoOptions, onProgress, pinsToDAG)
  }
}
