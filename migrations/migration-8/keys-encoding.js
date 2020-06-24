const utils = require('../../src/utils')
const path = require('path')
const mb = require('multibase')
const Key = require('interface-datastore').Key
const log = require('debug')('ipfs-repo-migrations:migration-8')
const errCode = require('err-code')

const KEY_PREFIX = 'key_'

function encode (name) {
  if (name.startsWith(KEY_PREFIX)) {
    throw errCode(new Error('Key has already been encoded'), 'ERR_ALREADY_MIGRATED')
  }

  name = Buffer.from(name)
  return `${KEY_PREFIX}${mb.encode('base32', name).slice(1)}`.toLowerCase()
}

function decode (name) {
  if (!name.startsWith(KEY_PREFIX)) {
    throw errCode(new Error('Key has already been decoded'), 'ERR_ALREADY_MIGRATED')
  }

  const decodedNameBuff = mb.decode(`b${name.replace(KEY_PREFIX, '').toUpperCase()}`)

  return Buffer.from(decodedNameBuff).toString()
}

async function processFolder (store, prefix, fileNameProcessor) {
  const query = {
    prefix: `/${ prefix }`
  }

  for await (let { key, value } of store.query(query)) {
    try {
      const name = String(key._buf).replace(`/${ prefix }/`, '')
      const encodedFileName = fileNameProcessor(name)
      const newKey = new Key(`${ prefix }/${ encodedFileName }`)

      if (await store.has(newKey)) {
        continue
      }

      await store.delete(key)

      log(`Translating key's name '${ key }' into '${ newKey }'`)

      await store.put(newKey, value)
    } catch (err) {
      if (err.code !== 'ERR_ALREADY_MIGRATED') {
        throw err
      }
    }
  }
}

async function process (repoPath, options, processor) {
  const { StorageBackend, storageOptions } = utils.getDatastoreAndOptions(options, 'keys')

  const store = new StorageBackend(path.join(repoPath, 'keys'), storageOptions)
  await store.open()

  try {
    await processFolder(store, 'info', processor)
    await processFolder(store, 'pkcs8', processor)
  } finally {
    await store.close()
  }
}

exports.migrate = async function keyEncode (repoPath, options) {
  return process(repoPath, options, encode)
}

exports.revert = async function keyDecode (repoPath, options) {
  return process(repoPath, options, decode)
}
