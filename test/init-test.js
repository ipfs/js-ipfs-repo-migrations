/* eslint-env mocha */
'use strict'

const { expect } = require('aegir/utils/chai')
const { CONFIG_KEY, VERSION_KEY, createStore } = require('../src/utils')
const repoInit = require('../src/repo/init')
const uint8ArrayFromString = require('uint8arrays/from-string')

module.exports = (setup, cleanup, repoOptions) => {
  let dir

  beforeEach(async () => {
    dir = await setup()
  })
  afterEach(() =>
    cleanup(dir)
  )

  it('should return true with valid initialized repo', async () => {
    const store = await createStore(dir, 'root', repoOptions)
    await store.open()
    await store.put(VERSION_KEY, uint8ArrayFromString('7'))
    await store.put(CONFIG_KEY, uint8ArrayFromString('config'))
    await store.close()

    expect(await repoInit.isRepoInitialized(dir, repoOptions)).to.be.true()
  })

  it('should return false with missing version key', async () => {
    const store = await createStore(dir, 'root', repoOptions)
    await store.open()
    await store.put(CONFIG_KEY, '')
    await store.close()

    expect(await repoInit.isRepoInitialized(dir, repoOptions)).to.be.false()
  })

  it('should return false with missing config key', async () => {
    const store = await createStore(dir, 'root', repoOptions)
    await store.open()
    await store.put(VERSION_KEY, '')
    await store.close()

    expect(await repoInit.isRepoInitialized(dir, repoOptions)).to.be.false()
  })

  it('should return false if the repo does not exists', async () => {
    return expect(await repoInit.isRepoInitialized('/some/random/dirrr', repoOptions)).to.be.false()
  })
}
