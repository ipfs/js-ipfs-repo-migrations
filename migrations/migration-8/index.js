'use strict'

const Datastore = require('datastore-fs')
const path = require('path')
const base32 = require('base32.js')
const Key = require('interface-datastore').Key
const log = require('debug')('ipfs-repo-migrations:migration-8')

const KEY_PREFIX = 'key_'

function encode(name) {
  name = Buffer.from(name)
  const encoder = new base32.Encoder({type: "rfc4648"});
  return (KEY_PREFIX + encoder.finalize(name)).toLowerCase()
}

function decode(name) {
  log(name)
  if (!name.startsWith(KEY_PREFIX)) {
    throw Error("Unknown format of key's name!")
  }

  const decoder = new base32.Decoder({type: "rfc4648"});
  return decoder.finalize(name.replace(KEY_PREFIX, '').toUpperCase())
}

async function processFolder(store, prefix, fileNameProcessor) {
  const query = {
    prefix: `/${prefix}`,
  }

  const files = await store.query(query)
  for await (let file of files) {
    const name = String(file.key._buf).replace(`/${prefix}/`, '')
    const encodedFileName = fileNameProcessor(name)
    const newKey = new Key(`${prefix}/${encodedFileName}`)

    await store.delete(file.key)
    log(`Translating key's name '${file.key}' into '${newKey}'`)
    await store.put(newKey, file.value)
  }
}

async function migrate(repoPath, isBrowser) {
  const store = new Datastore(path.join(repoPath, 'keys'), {extension: '.data', createIfMissing: false})
  store.open()
  try {
    const info = processFolder(store, 'info', encode)
    const data = processFolder(store, 'pkcs8', encode)

    await Promise.all([info, data])
  } finally {
    await store.close()
  }
}

async function revert(repoPath, isBrowser) {
  const store = new Datastore(path.join(repoPath, 'keys'), {extension: '.data', createIfMissing: false})
  store.open()

  try {
    const info = processFolder(store, 'info', decode)
    const data = processFolder(store, 'pkcs8', decode)

    await Promise.all([info, data])
  } finally {
    await store.close()
  }
}

module.exports = {
  version: 8,
  description: 'Transforms key\'s names into base32 encoding.',
  reversible: true,
  migrate,
  revert,
}
