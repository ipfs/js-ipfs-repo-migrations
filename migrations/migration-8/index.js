'use strict'

const path = require('path')
const CID = require('cids')
const Key = require('interface-datastore').Key
const core = require('datastore-core')
const ShardingStore = core.ShardingDatastore
const mb = require('multibase')
const utils = require('../../src/utils')
const log = require('debug')('ipfs-repo-migrations:migration-8')

// This function in js-ipfs-repo defaults to not using sharding
// but the default value of the options.sharding is true hence this
// function defaults to use sharding.
async function maybeWithSharding (filestore, options) {
  if (options.sharding === false) {
    return filestore
  }

  const shard = new core.shard.NextToLast(2)

  return ShardingStore.createOrOpen(filestore, shard)
}

function keyToMultihash (key) {
  const buf = mb.decode(`b${key.toString().slice(1)}`)

  // Extract multihash from CID
  let multihash = new CID(buf).multihash

  // Encode and slice off multibase codec
  multihash = mb.encode('base32', multihash).slice(1)

  // Should be uppercase for interop with go
  multihash = multihash.toString().toUpperCase()

  return new Key(`/${multihash}`, false)
}

function keyToCid (key) {
  const buf = mb.decode(`b${key.toString().slice(1)}`)

  // CID to Key
  const multihash = mb.encode('base32', new CID(1, 'raw', buf).buffer).slice(1)

  return new Key(`/${multihash}`.toUpperCase(), false)
}

async function process (repoPath, options, keyFunction){
  const { StorageBackend, storageOptions } = utils.getDatastoreAndOptions(options, 'blocks')

  const baseStore = new StorageBackend(path.join(repoPath, 'blocks'), storageOptions)
  await baseStore.open()
  const store = await maybeWithSharding(baseStore, storageOptions)
  await store.open()

  try {
    let counter = 0

    for await (const block of store.query({})) {
      const newKey = keyFunction(block.key)

      // If the Key is base32 CIDv0 then there's nothing to do
      if(newKey.toString() !== block.key.toString()) {
        counter += 1

        log(`Migrating Block from ${block.key.toString()} to ${newKey.toString()}`)
        await store.delete(block.key)
        await store.put(newKey, block.value)
      }
    }

    log(`Changed ${ counter } blocks`)
  } finally {
    await store.close()
  }
}

module.exports = {
  version: 8,
  description: 'Transforms key names into base32 encoding and converts Block store to use bare multihashes encoded as base32',
  migrate: (repoPath, options = {}) => {
    return process(repoPath, options, keyToMultihash)
  },
  revert: (repoPath, options = {}) => {
    return process(repoPath, options, keyToCid)
  }
}
