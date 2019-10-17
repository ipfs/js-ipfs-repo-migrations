/* eslint-env mocha */
'use strict'

const chai = require('chai')
const expect = chai.expect

const Datastore = require('datastore-fs')
const Key = require('interface-datastore').Key
const repoInit = require('../src/repo/init')

module.exports = (setup, cleanup) => {
  let dir

  beforeEach(async () => {
    dir = await setup()
  })
  afterEach(() =>
    cleanup(dir)
  )

  it('should return true with valid initialized repo', async () => {
    const versionKey = new Key('version')
    const configKey = new Key('config')
    const store = new Datastore(dir, { extension: '', createIfMissing: false })
    await store.open()
    await store.put(versionKey, Buffer.from('7'))
    await store.put(configKey, '')
    await store.close()

    expect(await repoInit.isRepoInitialized(dir)).to.be.true()
  })

  it('should return false with missing version key', async () => {
    const configKey = new Key('config')
    const store = new Datastore(dir, { extension: '', createIfMissing: false })
    await store.open()
    await store.put(configKey, '')
    await store.close()

    expect(await repoInit.isRepoInitialized(dir)).to.be.false()
  })

  it('should return false with missing config key', async () => {
    const versionKey = new Key('version')
    const store = new Datastore(dir, { extension: '', createIfMissing: false })
    await store.open()
    await store.put(versionKey, '')
    await store.close()

    expect(await repoInit.isRepoInitialized(dir)).to.be.false()
  })

  it('should return false if the repo does not exists', async () => {
    return expect(await repoInit.isRepoInitialized('/some/random/dirrr')).to.be.false()
  })
}
