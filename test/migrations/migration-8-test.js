/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const expect = chai.expect

const path = require('path')
const migration = require('../../migrations/migration-8')
const Key = require('interface-datastore').Key
const Datastore = require('datastore-fs')
const core = require('datastore-core')
const ShardingStore = core.ShardingDatastore

const blocksFixtures = [
  ['AFKREIBFG77IKIKDMBDUFDCSPK7H5TE5LNPMCSXYLPML27WSTT5YA5IUNU',
    'CIQCKN76QUQUGYCHIKGFE6V6P3GJ2W26YFFPQW6YXV7NFHH3QB2RI3I']
]

async function bootstrapBlocks (dir, encoded) {
  const baseStore = new Datastore(path.join(dir, 'blocks'), { extension: '.data', createIfMissing: true })
  const shard = new core.shard.NextToLast(2)

  await baseStore.open()
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

  await baseStore.open()
  const store = await ShardingStore.createOrOpen(baseStore, shard)

  let newName, oldName
  for (const blockNames of blocksFixtures) {
    newName = shouldBeEncoded ? blockNames[1] : blockNames[0]
    oldName = shouldBeEncoded ? blockNames[0] : blockNames[1]
    expect(await store.has(new Key(`/${oldName}`))).to.be.false(`${oldName} was not migrated to ${newName}`)
    expect(await store.has(new Key(`/${newName}`))).to.be.true(`${newName} was not removed`)
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

    it('should migrate blocks forward', async () => {
      await bootstrapBlocks(dir, false)
      await migration.migrate(dir)
      await validateBlocks(dir, true)
    })

    it('should migrate blocks backward', async () => {
      await bootstrapBlocks(dir, true)
      await migration.revert(dir)
      await validateBlocks(dir, false)
    })
  })
}
