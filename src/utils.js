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

function createStore (location, name, options) {
  const { StorageBackend, storageOptions } = getDatastoreAndOptions(name, options)

  if (name !== 'root') {
    location = `${location}/${name}`
  }

  let store = new StorageBackend(location, storageOptions)

  if (storageOptions.sharding) {
    store = new ShardingStore(store, new core.shard.NextToLast(2))
  }

  return store
}

function containsIrreversibleMigration (from, to, migrations) {
  return migrations
    .filter(migration => migration.version > from && migration.version <= to)
    .some(migration => migration.revert === undefined)
}

exports.createStore = createStore
exports.containsIrreversibleMigration = containsIrreversibleMigration
