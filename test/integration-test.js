/* eslint-env mocha */
'use strict'

const { expect } = require('./util')

const migrator = require('../src')
const migrations = require('./test-migrations')
const { VERSION_KEY, CONFIG_KEY, getDatastoreAndOptions } = require('../src/utils')

module.exports = (setup, cleanup, repoOptions) => {
  let dir

  beforeEach(async () => {
    dir = await setup()
  })
  afterEach(() =>
    cleanup(dir)
  )

  it('migrate forward', async () => {
    await migrator.migrate(dir, migrator.getLatestMigrationVersion(migrations), {
      migrations: migrations,
      repoOptions
    })

    const {
      StorageBackend,
      storageOptions
    } = getDatastoreAndOptions(repoOptions, 'root')

    const store = new StorageBackend(dir, storageOptions)

    await store.open()
    const version = await store.get(VERSION_KEY)
    expect(version.toString()).to.be.equal('2')

    const config = await store.get(CONFIG_KEY)
    expect(config.toString()).to.include(migrations[0].newApiAddr)

    await store.close()
  })

  it('revert', async () => {
    await migrator.migrate(dir, migrator.getLatestMigrationVersion(migrations), {
      migrations: migrations,
      repoOptions
    })

    await migrator.revert(dir, 1, {
      migrations: migrations,
      repoOptions
    })

    const {
      StorageBackend,
      storageOptions
    } = getDatastoreAndOptions(repoOptions, 'root')

    const store = new StorageBackend(dir, storageOptions)

    await store.open()
    const version = await store.get(VERSION_KEY)
    expect(version.toString()).to.be.equal('1')

    const config = await store.get(CONFIG_KEY)
    expect(config.toString()).to.not.include(migrations[0].newApiAddr)

    await store.close()
  })
}
