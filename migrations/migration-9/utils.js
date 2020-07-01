'use strict'

const path = require('path')
const core = require('datastore-core')
const ShardingStore = core.ShardingDatastore
const utils = require('../../src/utils')
const multibase = require('multibase')
const { Key } = require('interface-datastore')
const multihashes = require('multihashing-async').multihash

const PIN_DS_KEY = new Key('/local/pins')
const DEFAULT_FANOUT = 256
const MAX_ITEMS = 8192
const EMPTY_KEY = multihashes.fromB58String('QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n')

const PinTypes = {
  direct: 'direct',
  recursive: 'recursive'
}

function cidToKey (cid) {
  return new Key(`/${multibase.encoding('base32upper').encode(cid.multihash)}`)
}

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

const createStore = async (location, name, options) => {
  const { StorageBackend, storageOptions } = utils.getDatastoreAndOptions(options, name)

  let store = new StorageBackend(path.join(location, name), storageOptions)
  store = maybeWithSharding(store, storageOptions)

  return store
}

module.exports = {
  PIN_DS_KEY,
  DEFAULT_FANOUT,
  MAX_ITEMS,
  EMPTY_KEY,
  PinTypes,
  createStore,
  cidToKey
}
