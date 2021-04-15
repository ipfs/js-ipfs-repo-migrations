'use strict'

const CID = require('cids')
const Key = require('interface-datastore').Key
const mb = require('multibase')
const log = require('debug')('ipfs:repo:migrator:migration-8')
const uint8ArrayToString = require('uint8arrays/to-string')
const { createStore } = require('../../src/utils')
const length = require('it-length')

/**
 * @typedef {import('../../src/types').Migration} Migration
 */

/**
 * @param {Key} key
 */
function keyToMultihash (key) {
  const buf = mb.decode(`b${key.toString().slice(1)}`)

  // Extract multihash from CID
  let multihash = new CID(buf).multihash

  // Encode and slice off multibase codec
  multihash = mb.encode('base32', multihash).slice(1)

  // Should be uppercase for interop with go
  const multihashStr = uint8ArrayToString(multihash).toUpperCase()

  return new Key(`/${multihashStr}`, false)
}

/**
 * @param {Key} key
 */
function keyToCid (key) {
  const buf = mb.decode(`b${key.toString().slice(1)}`)

  // CID to Key
  const multihash = mb.encode('base32', new CID(1, 'raw', buf).bytes).slice(1)

  return new Key(`/${uint8ArrayToString(multihash)}`.toUpperCase(), false)
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
