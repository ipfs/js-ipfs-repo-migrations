/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const expect = chai.expect

const path = require('path')
const keysMigration = require('../../migrations/migration-8/keys-encoding')
const blocksMigration = require('../../migrations/migration-8/blocks-to-multihash')
const Key = require('interface-datastore').Key
const Datastore = require('datastore-fs')
const core = require('datastore-core')
const ShardingStore = core.ShardingDatastore

const keysFixtures = [
  ['aAa', 'key_mfawc'],
  ['bbb', 'key_mjrge'],
  ['self', 'key_onswyzq']
]

const blocksFixtures = [
  ['AFKREIBFG77IKIKDMBDUFDCSPK7H5TE5LNPMCSXYLPML27WSTT5YA5IUNU', 'CIQCKN76QUQUGYCHIKGFE6V6P3GJ2W26YFFPQW6YXV7NFHH3QB2RI3I']
]

async function bootstrapKeys (dir, encoded) {
  const store = new Datastore(path.join(dir, 'keys'), { extension: '.data', createIfMissing: true })
  await store.open()

  let name
  for (const keyNames of keysFixtures) {
    name = encoded ? keyNames[1] : keyNames[0]
    await store.put(new Key(`/pkcs8/${name}`), '')
    await store.put(new Key(`/info/${name}`), '')
  }

  await store.close()
}

async function validateKeys (dir, shouldBeEncoded) {
  const store = new Datastore(path.join(dir, 'keys'), { extension: '.data', createIfMissing: false })
  await store.open()

  let name
  for (const keyNames of keysFixtures) {
    name = shouldBeEncoded ? keyNames[1] : keyNames[0]
    expect(await store.has(new Key(`/pkcs8/${name}`))).to.be.true(name)
    expect(await store.has(new Key(`/info/${name}`))).to.be.true(name)
  }

  await store.close()
}

async function bootstrapBlocks (dir, encoded) {
  const baseStore = new Datastore(path.join(dir, 'blocks'), { extension: '.data', createIfMissing: true })
  const shard = new core.shard.NextToLast(2)
  const store = await ShardingStore.createOrOpen(baseStore, shard)

  let name
  for (const blocksNames of blocksFixtures) {
    name = encoded ? blocksNames[1] : blocksNames[0]
    await store.put(new Key(name), '')
  }

  await store.close()
}

async function validateBlocks (dir, shouldBeEncoded) {
  const baseStore = new Datastore(path.join(dir, 'blocks'), { extension: '.data', createIfMissing: false })
  const shard = new core.shard.NextToLast(2)
  const store = await ShardingStore.createOrOpen(baseStore, shard)

  let newName, oldName
  for (const blockNames of blocksFixtures) {
    newName = shouldBeEncoded ? blockNames[1] : blockNames[0]
    oldName = shouldBeEncoded ? blockNames[0] : blockNames[1]
    expect(await store.has(new Key(oldName))).to.be.false(oldName)
    expect(await store.has(new Key(newName))).to.be.true(newName)
  }

  await store.close()
}

module.exports = (setup, cleanup) => {
  describe('migration 8', () => {
    let dir

    beforeEach(async () => {
      dir = await setup()
    })
    afterEach(() => cleanup(dir))

    it('should migrate keys forward', async () => {
      await bootstrapKeys(dir, false)
      await keysMigration.migrate(dir)
      await validateKeys(dir, true)
    })

    it('should migrate keys backward', async () => {
      await bootstrapKeys(dir, true)
      await keysMigration.revert(dir)
      await validateKeys(dir, false)
    })

    it('should fail to migrate keys backward with invalid key name', async () => {
      const store = new Datastore(path.join(dir, 'keys'), { extension: '.data', createIfMissing: true })
      await store.open()

      await store.put(new Key('/pkcs8/mfawc'), '')
      await store.put(new Key('/info/mfawc'), '')

      await store.close()

      expect(keysMigration.revert(dir)).to.eventually.rejectedWith('Unknown format of key\'s name!')
    })

    it('should migrate blocks forward', async () => {
      await bootstrapBlocks(dir, false)
      await blocksMigration.migrate(dir)
      await validateBlocks(dir, true)
    })
    //
    // it('should migrate blocks backward', async () => {
    //   await bootstrapKeys(dir, true)
    //   await blocksMigration.revert(dir)
    //   await validateKeys(dir, false)
    // })
  })
}
