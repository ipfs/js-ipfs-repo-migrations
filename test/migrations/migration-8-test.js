/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const chaiAsPromised = require("chai-as-promised")
chai.use(chaiAsPromised)
const expect = chai.expect

const path = require('path')
const migration = require('../../migrations/migration-8')
const Key = require('interface-datastore').Key
const Datastore = require('datastore-fs')

const log = require('debug')('js-ipfs-repo-migrations:migration-8')

const fixtures = [
  ['aAa', 'key_mfawc'],
  ['bbb', 'key_mjrge'],
  ['self', 'key_onswyzq']
]

async function bootstrapKeys (dir, encoded) {
  const store = new Datastore(path.join(dir, 'keys'), { extension: '.data', createIfMissing: true })
  await store.open()

  let name
  for (let keyNames of fixtures) {
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
  for (let keyNames of fixtures) {
    name = shouldBeEncoded ? keyNames[1] : keyNames[0]
    expect(await store.has(new Key(`/pkcs8/${name}`))).to.be.true()
    expect(await store.has(new Key(`/info/${name}`))).to.be.true()
  }

  await store.close()
}

module.exports = (setup, cleanup) => {
  let dir

  beforeEach(async () => {
    dir = await setup()
  })
  afterEach(() => cleanup(dir))

  it('should migrate forward', async () => {
    await bootstrapKeys(dir, false)
    await migration.migrate(dir)
    await validateKeys(dir, true)
  })

  it('should migrate backward', async () => {
    await bootstrapKeys(dir, true)
    await migration.revert(dir)
    await validateKeys(dir, false)
  })

  it('should fail to migrate backward with invalid key name', async () => {
    const store = new Datastore(path.join(dir, 'keys'), { extension: '.data', createIfMissing: true })
    await store.open()

    await store.put(new Key('/pkcs8/mfawc'), '')
    await store.put(new Key('/info/mfawc'), '')

    await store.close()

    expect(migration.revert(dir)).to.eventually.rejectedWith('Unknown format of key\'s name!')
  })
}
