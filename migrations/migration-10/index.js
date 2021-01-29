'use strict'

const {
  createStore,
  findLevelJs
} = require('../../src/utils')
const { Key } = require('interface-datastore')
const fromString = require('uint8arrays/from-string')
const toString = require('uint8arrays/to-string')

async function keysToBinary (name, store, onProgress = () => {}) {
  let db = findLevelJs(store)

  // only interested in level-js
  if (!db) {
    onProgress(`${name} did not need an upgrade`)

    return
  }

  onProgress(`Upgrading ${name}`)

  await withEach(db, (key, value) => {
    return [
      { type: 'del', key: key },
      { type: 'put', key: fromString(key), value: value }
    ]
  })
}

async function keysToStrings (name, store, onProgress = () => {}) {
  let db = findLevelJs(store)

  // only interested in level-js
  if (!db) {
    onProgress(`${name} did not need a downgrade`)

    return
  }

  onProgress(`Downgrading ${name}`)

  await withEach(db, (key, value) => {
    return [
      { type: 'del', key: key },
      { type: 'put', key: toString(key), value: value }
    ]
  })
}

async function process (repoPath, repoOptions, onProgress, fn) {
  const datastores = Object.keys(repoOptions.storageBackends)
    .filter(key => repoOptions.storageBackends[key].name === 'LevelDatastore')
    .map(name => ({
      name,
      store: createStore(repoPath, name, repoOptions)
    }))

  onProgress(0, `Migrating ${datastores.length} dbs`)
  let migrated = 0

  for (const { name, store } of datastores) {
    await store.open()

    try {
      await fn(name, store, (message) => {
        onProgress(parseInt((migrated / datastores.length) * 100), message)
      })
    } finally {
      migrated++
      store.close()
    }
  }

  onProgress(100, `Migrated ${datastores.length} dbs`)
}

module.exports = {
  version: 10,
  description: 'Migrates datastore-level keys to binary',
  migrate: (repoPath, repoOptions, onProgress = () => {}) => {
    return process(repoPath, repoOptions, onProgress, keysToBinary)
  },
  revert: (repoPath, repoOptions, onProgress = () => {}) => {
    return process(repoPath, repoOptions, onProgress, keysToStrings)
  }
}

/**
 * @typedef {Uint8Array|string} Key
 * @typedef {Uint8Array} Value
 * @typedef {{ type: 'del', key: Key } | { type: 'put', key: Key, value: Value }} Operation
 *
 * Uses the upgrade strategy from level-js@5.x.x - note we can't call the `.upgrade` command
 * directly because it will be removed in level-js@6.x.x and we can't guarantee users will
 * have migrated by then - e.g. they may jump from level-js@4.x.x straight to level-js@6.x.x
 * so we have to duplicate the code here.
 *
 * @param {import('interface-datastore').Datastore} db
 * @param {function (Key, Value): Operation[]} fn
 */
function withEach (db, fn) {
  function batch (operations, next) {
    const store = db.store('readwrite')
    const transaction = store.transaction
    let index = 0
    let error

    transaction.onabort = () => next(error || transaction.error || new Error('aborted by user'))
    transaction.oncomplete = () => next()

    function loop () {
      var op = operations[index++]
      var key = op.key

      try {
        var req = op.type === 'del' ? store.delete(key) : store.put(op.value, key)
      } catch (err) {
        error = err
        transaction.abort()
        return
      }

      if (index < operations.length) {
        req.onsuccess = loop
      }
    }

    loop()
  }

  return new Promise((resolve, reject) => {
    const it = db.iterator()
    // raw keys and values only
    it._deserializeKey = it._deserializeValue = (data) => data
    next()

    function next () {
      it.next((err, key, value) => {
        if (err || key === undefined) {
          it.end((err2) => {
            if (err2) {
              reject(err2)
              return
            }

            resolve()
          })

          return
        }

        batch(fn(key, value), next)
      })
    }
  })
}
