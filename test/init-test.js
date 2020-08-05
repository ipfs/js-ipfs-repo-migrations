/* eslint-env mocha */
'use strict'

const { expect } = require('./util')

const Datastore = require('datastore-fs')
const Key = require('interface-datastore').Key
const repoInit = require('../src/repo/init')
const uint8ArrayFromString = require('uint8arrays/from-string')

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
    await store.put(versionKey, uint8ArrayFromString('7'))
    await store.put(configKey, uint8ArrayFromString('config'))
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
