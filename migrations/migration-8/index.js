'use strict'

const { CID } = require('multiformats/cid')
const Key = require('interface-datastore').Key
const log = require('debug')('ipfs:repo:migrator:migration-8')

const length = require('it-length')
const { base32 } = require('multiformats/bases/base32')
const raw = require('multiformats/codecs/raw')
const mhd = require('multiformats/hashes/digest')

/**
 * @typedef {import('../../src/types').Migration} Migration
 * @typedef {import('interface-datastore').Datastore} Datastore
 */

/**
 * @param {*} blockstore
 * @returns {Datastore}
 */
 function unwrap (blockstore) {
  if (blockstore.child) {
    return unwrap(blockstore.child)
  }

  return blockstore
}

/**
 * @param {Key} key
 */
function keyToMultihash (key) {
  try {
    const buf = base32.decode(`b${key.toString().toLowerCase().slice(1)}`)

    // Extract multihash from CID
    let multihash = CID.decode(buf).multihash.bytes

    // Encode and slice off multibase codec
    // Should be uppercase for interop with go
    const multihashStr = base32.encode(multihash).slice(1).toUpperCase()

    return new Key(`/${multihashStr}`, false)
  } catch (err) {
    return key
  }
}

/**
 * @param {Key} key
 */
function keyToCid (key) {
  try {
    const buf = base32.decode(`b${key.toString().toLowerCase().slice(1)}`)
    const digest = mhd.decode(buf)

    // CID to Key
    const multihash = base32.encode(CID.createV1(raw.code, digest).bytes).slice(1)

    return new Key(`/${multihash.toUpperCase()}`, false)
  } catch {
    return key
  }
}

/**
 * @param {import('../../src/types').Backends} backends
 * @param {(percent: number, message: string) => void} onProgress
 * @param {(key: Key) => Key} keyFunction
 */
async function process (backends, onProgress, keyFunction) {
  const blockstore = backends.blocks
  await blockstore.open()

  const unwrapped = unwrap(blockstore)

  let blockCount

  blockCount = await length(unwrapped.queryKeys({
    filters: [(key) => {
      const newKey = keyFunction(key)

      return newKey.toString() !== key.toString()
    }]
  }))

  try {
    let counter = 0

    for await (const block of unwrapped.query({})) {
      const newKey = keyFunction(block.key)

      // If the Key is base32 CIDv0 then there's nothing to do
      if(newKey.toString() !== block.key.toString()) {
        counter += 1
        log(`Migrating Block from ${block.key} to ${newKey}`, await unwrapped.has(block.key))

        await unwrapped.delete(block.key)
        await unwrapped.put(newKey, block.value)

        onProgress((counter / blockCount) * 100, `Migrated Block from ${block.key} to ${newKey}`)
      }
    }
  } finally {
    await blockstore.close()
  }
}

/** @type {Migration} */
module.exports = {
  version: 8,
  description: 'Transforms key names into base32 encoding and converts Block store to use bare multihashes encoded as base32',
  migrate: (backends, onProgress = () => {}) => {
    return process(backends, onProgress, keyToMultihash)
  },
  revert: (backends, onProgress = () => {}) => {
    return process(backends, onProgress, keyToCid)
  }
}
