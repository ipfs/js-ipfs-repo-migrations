'use strict'

const { CID } = require('multiformats/cid')
const Key = require('interface-datastore').Key
const log = require('debug')('ipfs:repo:migrator:migration-8')
const { createStore } = require('../../src/utils')
const length = require('it-length')
const { base32 } = require('multiformats/bases/base32')
const raw = require('multiformats/codecs/raw')
const mhd = require('multiformats/hashes/digest')

/**
 * @typedef {import('../../src/types').Migration} Migration
 */

/**
 * @param {Key} key
 */
function keyToMultihash (key) {
  const buf = base32.decode(`b${key.toString().toLowerCase().slice(1)}`)

  // Extract multihash from CID
  let multihash = CID.decode(buf).multihash.bytes

  // Encode and slice off multibase codec
  // Should be uppercase for interop with go
  const multihashStr = base32.encode(multihash).slice(1).toUpperCase()

  return new Key(`/${multihashStr}`, false)
}

/**
 * @param {Key} key
 */
function keyToCid (key) {
  const buf = base32.decode(`b${key.toString().toLowerCase().slice(1)}`)
  const digest = mhd.decode(buf)

  // CID to Key
  const multihash = base32.encode(CID.createV1(raw.code, digest).bytes).slice(1)

  return new Key(`/${multihash.toUpperCase()}`, false)
}

/**
 * @param {string} repoPath
 * @param {*} repoOptions
 * @param {(percent: number, message: string) => void} onProgress
 * @param {(key: Key) => Key} keyFunction
 */
async function process (repoPath, repoOptions, onProgress, keyFunction) {
  const blockstore = createStore(repoPath, 'blocks', repoOptions)
  await blockstore.open()

  let blockCount

  blockCount = await length(blockstore.queryKeys({
    filters: [(key) => {
      const newKey = keyFunction(key)

      return newKey.toString() !== key.toString()
    }]
  }))

  try {
    let counter = 0

    for await (const block of blockstore.query({})) {
      const newKey = keyFunction(block.key)

      // If the Key is base32 CIDv0 then there's nothing to do
      if(newKey.toString() !== block.key.toString()) {
        counter += 1
        log(`Migrating Block from ${block.key} to ${newKey}`)
        await blockstore.delete(block.key)
        await blockstore.put(newKey, block.value)

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
  migrate: (repoPath, repoOptions, onProgress = () => {}) => {
    return process(repoPath, repoOptions, onProgress, keyToMultihash)
  },
  revert: (repoPath, repoOptions, onProgress = () => {}) => {
    return process(repoPath, repoOptions, onProgress, keyToCid)
  }
}
