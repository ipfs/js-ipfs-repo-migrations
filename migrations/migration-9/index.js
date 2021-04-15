'use strict'

const CID = require('cids')
const dagpb = require('ipld-dag-pb')
const cbor = require('cborg')
const multicodec = require('multicodec')
const multibase = require('multibase')
const pinset = require('./pin-set')
const { createStore } = require('../../src/utils')
const { cidToKey, PIN_DS_KEY, PinTypes } = require('./utils')
const length = require('it-length')

/**
 * @typedef {import('../../src/types').Migration} Migration
 * @typedef {import('../../src/types').MigrationProgressCallback} MigrationProgressCallback
 * @typedef {import('interface-datastore').Datastore} Datastore
 * @typedef {import('multicodec').CodecCode} CodecCode
 */

 /**
  * @param {Datastore} blockstore
  * @param {Datastore} datastore
  * @param {Datastore} pinstore
  * @param {MigrationProgressCallback} onProgress
  */
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

  pinCount = (await length(pinset.loadSet(blockstore, pinRoot, PinTypes.recursive))) + (await length(pinset.loadSet(blockstore, pinRoot, PinTypes.direct)))

  for await (const cid of pinset.loadSet(blockstore, pinRoot, PinTypes.recursive)) {
    counter++

    /** @type {{ depth: number, version?: CID.CIDVersion, codec?: CodecCode }} */
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

    onProgress((counter / pinCount) * 100, `Migrated recursive pin ${cid}`)
  }

  for await (const cid of pinset.loadSet(blockstore, pinRoot, PinTypes.direct)) {
    counter++

    /** @type {{ depth: number, version?: CID.CIDVersion, codec?: CodecCode }} */
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

/**
  * @param {Datastore} blockstore
  * @param {Datastore} datastore
  * @param {Datastore} pinstore
  * @param {MigrationProgressCallback} onProgress
  */
async function pinsToDAG (blockstore, datastore, pinstore, onProgress) {
  let recursivePins = []
  let directPins = []
  let counter = 0
  const pinCount = await length(pinstore.queryKeys({}))

  for await (const { key, value } of pinstore.query({})) {
    counter++
    const pin = cbor.decode(value)
    const cid = new CID(pin.version || 0, pin.codec && multicodec.getName(pin.codec) || 'dag-pb', multibase.decode('b' + key.toString().split('/').pop()))

    if (pin.depth === 0) {
      onProgress((counter / pinCount) * 100, `Reverted direct pin ${cid}`)

      directPins.push(cid)
    } else {
      onProgress((counter / pinCount) * 100, `Reverted recursive pin ${cid}`)

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
    cidVersion: 0
  })
  await blockstore.put(cidToKey(cid), buf)
  await datastore.put(PIN_DS_KEY, cid.multihash)
}

/**
 * @param {string} repoPath
 * @param {*} repoOptions
 * @param {MigrationProgressCallback} onProgress
 * @param {*} fn
 */
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

/** @type {Migration} */
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
