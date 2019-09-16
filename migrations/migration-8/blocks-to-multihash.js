const path = require('path')
const CID = require('cids')
const Key = require('interface-datastore').Key
const core = require('datastore-core')
const ShardingStore = core.ShardingDatastore
const base32 = require('base32.js')
const utils = require('../../src/utils')
const log = require('debug')('ipfs-repo-migrations:migration-8')

// This function in js-ipfs-repo defaults to not using sharding
// but the default value of the options.sharding is True hence this
// function defaults to use sharding.
async function maybeWithSharding (filestore, options) {
  if (options.sharding === false) {
    return filestore
  }

  const shard = new core.shard.NextToLast(2)
  return await ShardingStore.createOrOpen(filestore, shard)
}

function keyToMultihash(key){
  // Key to CID
  const decoder = new base32.Decoder()
  const buff = decoder.write(key.toString().slice(1)).finalize()
  const cid = new CID(Buffer.from(buff))

  // CID to multihash
  const enc = new base32.Encoder()
  return new Key('/' + enc.finalize(cid.multihash), false)
}

function keyToCid(key){
  // Key to CID
  const decoder = new base32.Decoder()
  const buff = decoder.write(key.toString().slice(1)).finalize()
  const cid = new CID(1, 'raw', Buffer.from(buff))

  // CID to Key
  const enc = new base32.Encoder()
  return new Key('/' + enc.finalize(cid.buffer), false)
}

async function process(repoPath, options, keyFunction){
  const { StorageBackend, storageOptions } = utils.getDatastoreAndOptions(options, 'blocks')

  const baseStore = new StorageBackend(path.join(repoPath, 'blocks'), storageOptions)
  const store = await maybeWithSharding(baseStore, storageOptions)

  try {
    const batch = store.batch()
    let counter = 0
    for await (const block of store.query({})) {
      batch.delete(block.key)

      counter += 1
      const newKey = keyFunction(block.key)
      log(`Migrating Block from ${block.key.toString()} to ${newKey.toString()}`)
      batch.put(newKey, block.value)
    }

    log(`Changing ${ counter } blocks`)
    await batch.commit()
  } finally {
    await store.close()
  }
}

exports.migrate = async function blocksMigrate (repoPath, options) {
  return process(repoPath, options, keyToMultihash)
}

exports.revert = async function blocksRevert (repoPath, options) {
  return process(repoPath, options, keyToCid)
}
