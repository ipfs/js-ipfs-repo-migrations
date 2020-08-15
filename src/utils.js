'use strict'

const Key = require('interface-datastore').Key
const core = require('datastore-core')
const ShardingStore = core.ShardingDatastore

exports.CONFIG_KEY = new Key('/config')
exports.VERSION_KEY = new Key('/version')

function getDatastoreAndOptions (name, options) {
  if (!options || !options.storageBackends) {
    throw new Error('Please pass storage backend definitions')
  }

  if (!options.storageBackends[name]) {
    throw new Error(`Storage backend '${name}' not defined in config`)
  }

  const StorageBackend = options.storageBackends[name]

  let storageBackendOptions = {}

  if (options.storageBackendOptions !== undefined && options.storageBackendOptions[name] !== undefined) {
    storageBackendOptions = options.storageBackendOptions[name]
  }

  return {
    StorageBackend: StorageBackend,
    storageOptions: storageBackendOptions
  }
}

// This function in js-ipfs-repo defaults to not using sharding
// but the default value of the options.sharding is true hence this
// function defaults to use sharding.
function maybeWithSharding (store, options) {
  if (options.sharding === false) {
    return store
  }

  const shard = new core.shard.NextToLast(2)
  return ShardingStore.createOrOpen(store, shard)
}

async function createStore (location, name, options) {
  const { StorageBackend, storageOptions } = getDatastoreAndOptions(name, options)
  let store = new StorageBackend(`${location}/${name}`, storageOptions)
  store = await maybeWithSharding(store, storageOptions)

  await store.close()

  return store
}

function containsIrreversibleMigration (from, to, migrations) {
  return migrations
    .filter(migration => migration.version > from && migration.version <= to)
    .some(migration => migration.revert === undefined)
}

exports.createStore = createStore
exports.containsIrreversibleMigration = containsIrreversibleMigration
