const path = require('path')
const CID = require('cids')
const Key = require('interface-datastore').Key
const core = require('datastore-core')
const ShardingStore = core.ShardingDatastore
const base32 = require('base32.js')
const utils = require('../../src/utils')
const log = require('debug')('ipfs-repo-migrations:migration-8')
const errCode = require('err-code')
const multihashes = require('multihashes')

function isValidMultihash (buf) {
  try {
    multihashes.validate(buf)
    return true
  } catch (err) {
    return false
  }
}

function isValidCid (buf) {
  try {
    CID.validateCID(new CID(buf))
    return true
  } catch (err) {
    return false
  }
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

function keyToMultihash (key) {
  const decoder = new base32.Decoder()
  const buf = Buffer.from(decoder.finalize(key.toString().slice(1)))

  if (isValidMultihash(buf)) {
    throw errCode(new Error('Key is already a multihash'), 'ERR_ALREADY_MIGRATED')
  }

  // Extract multihash from CID
  const enc = new base32.Encoder()
  const multihash =  enc.finalize(new CID(buf).multihash)

  return new Key(`/${multihash}`, false)
}

function keyToCid (key) {
  const decoder = new base32.Decoder()
  const buf = Buffer.from(decoder.finalize(key.toString().slice(1)))

  if (isValidCid(buf) && new CID(buf).version === 1) {
    throw errCode(new Error('Key is already a CID'), 'ERR_ALREADY_MIGRATED')
  }

  if (!isValidMultihash(buf)) {
    throw errCode(new Error('Key is already a CID'), 'ERR_ALREADY_MIGRATED')
  }

  // CID to Key
  const enc = new base32.Encoder()
  return new Key('/' + enc.finalize(new CID(1, 'raw', buf).buffer), false)
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
      try {
        const newKey = keyFunction(block.key)

        // If the Key is base32 CIDv0 then there's nothing to do
        if(newKey.toString() !== block.key.toString()) {
          counter += 1

          log(`Migrating Block from ${block.key.toString()} to ${newKey.toString()}`)
          await store.delete(block.key)
          await store.put(newKey, block.value)
        }
      } catch (err) {
        if (err.code !== 'ERR_ALREADY_MIGRATED') {
          throw err
        }
      }
    }

    log(`Changed ${ counter } blocks`)
  } finally {
    await store.close()
  }
}

exports.migrate = function blocksMigrate (repoPath, options) {
  return process(repoPath, options, keyToMultihash)
}

exports.revert = function blocksRevert (repoPath, options) {
  return process(repoPath, options, keyToCid)
}
