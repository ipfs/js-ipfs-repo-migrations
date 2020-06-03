const utils = require('../../src/utils')
const path = require('path')
const base32 = require('base32.js')
const Key = require('interface-datastore').Key
const log = require('debug')('ipfs-repo-migrations:migration-8')

const KEY_PREFIX = 'key_'

function encode (name) {
  name = Buffer.from(name)
  const encoder = new base32.Encoder({ type: 'rfc4648' })
  return (KEY_PREFIX + encoder.finalize(name)).toLowerCase()
}

function decode (name) {
  if (!name.startsWith(KEY_PREFIX)) {
    throw Error('Unknown format of key\'s name!')
  }

  const decoder = new base32.Decoder({ type: 'rfc4648' })
  const decodedNameBuff = decoder.finalize(name.replace(KEY_PREFIX, '').toUpperCase())

  return Buffer.from(decodedNameBuff).toString()
}

async function processFolder (store, prefix, fileNameProcessor) {
  const query = {
    prefix: `/${ prefix }`
  }

  for await (let file of store.query(query)) {
    const name = String(file.key._buf).replace(`/${ prefix }/`, '')
    const encodedFileName = fileNameProcessor(name)
    const newKey = new Key(`${ prefix }/${ encodedFileName }`)

    if (await store.has(newKey)) {
      continue
    }

    await store.delete(file.key)

    log(`Translating key's name '${ file.key }' into '${ newKey }'`)

    await store.put(newKey, file.value)
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
