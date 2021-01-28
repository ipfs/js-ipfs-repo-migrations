'use strict'

const {
  Key,
  Errors
} = require('interface-datastore')
const core = require('datastore-core')
const ShardingStore = core.ShardingDatastore

/**
 * @typedef {import('interface-datastore').Key} Key
 * @typedef {import('interface-datastore').Datastore} Datastore
 */

const CONFIG_KEY = new Key('/config')
const VERSION_KEY = new Key('/version')

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

/**
 * Level dbs wrap level dbs that wrap level dbs. Find a level-js
 * instance in the chain if one exists.
 *
 * @param {Datastore} store
 */
function findLevelJs (store) {
  let db = store

  while (db.db || db.child) {
    db = db.db || db.child

    // `Level` is only present in the browser, in node it is LevelDOWN
    if (db.type === 'level-js' || db.constructor.name === 'Level') {
      return db
    }
  }
}

/**
 * @param {Key} key
 * @param {function (Key): Promise<boolean>} has
 * @param {Datastore} store
 */
async function hasWithFallback (key, has, store) {
  const result = await has(key)

  if (result) {
    return result
  }

  // Newer versions of level.js changed the key type from Uint8Array|string
  // to Uint8Array  so fall back to trying Uint8Arrays if we are using level.js
  // and the string version of the key did not work
  const levelJs = findLevelJs(store)

  if (!levelJs) {
    return false
  }

  return new Promise((resolve, reject) => {
    // drop down to IndexDB API, otherwise level-js will monkey around with the keys/values
    const req = levelJs.store('readonly').get(key.toString())
    req.transaction.onabort = () => {
      reject(req.transaction.error)
    }
    req.transaction.oncomplete = () => {
      resolve(Boolean(req.result))
    }
  })
}

/**
 * @param {import('interface-datastore').Key} key
 * @param {function (Key): Promise<Uint8Array>} get
 * @param {function (Key): Promise<boolean>} has
 * @param {import('interface-datastore').Datastore} store
 */
async function getWithFallback (key, get, has, store) {
  if (await has(key)) {
    return get(key)
  }

  // Newer versions of level.js changed the key type from Uint8Array|string
  // to Uint8Array  so fall back to trying Uint8Arrays if we are using level.js
  // and the string version of the key did not work
  const levelJs = findLevelJs(store)

  if (!levelJs) {
    throw Errors.notFoundError()
  }

  return new Promise((resolve, reject) => {
    // drop down to IndexDB API, otherwise level-js will monkey around with the keys/values
    const req = levelJs.store('readonly').get(key.toString())
    req.transaction.onabort = () => {
      reject(req.transaction.error)
    }
    req.transaction.oncomplete = () => {
      if (req.result) {
        return resolve(req.result)
      }

      reject(Errors.notFoundError())
    }
  })
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

  // necessary since level-js@5 cannot read keys from level-js@4 and earlier
  const originalGet = store.get.bind(store)
  const originalHas = store.has.bind(store)
  store.get = (key) => getWithFallback(key, originalGet, originalHas, store)
  store.has = (key) => hasWithFallback(key, originalHas, store)

  return store
}

module.exports = {
  createStore,
  hasWithFallback,
  getWithFallback,
  findLevelJs,
  CONFIG_KEY,
  VERSION_KEY
}
