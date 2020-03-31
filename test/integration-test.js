/* eslint-env mocha */
'use strict'

const { expect } = require('./util')

const migrator = require('../src')
const migrations = require('./test-migrations')

const Datastore = require('datastore-fs')
const Key = require('interface-datastore').Key
const CONFIG_KEY = new Key('config')
const VERSION_KEY = new Key('version')

module.exports = (setup, cleanup) => {
  let dir

  beforeEach(async () => {
    dir = await setup()
  })
  afterEach(() =>
    cleanup(dir)
  )

  it('migrate forward', async () => {
    await migrator.migrate(dir, migrator.getLatestMigrationVersion(migrations), { migrations: migrations })

    const store = new Datastore(dir, { extension: '', createIfMissing: false })
    await store.open()
    const version = await store.get(VERSION_KEY)
    expect(version.toString()).to.be.equal('2')

    const config = await store.get(CONFIG_KEY)
    expect(config.toString()).to.include(migrations[0].newApiAddr)

    await store.close()
  })

  it('revert', async () => {
    await migrator.migrate(dir, migrator.getLatestMigrationVersion(migrations), { migrations: migrations })

    await migrator.revert(dir, 1, { migrations: migrations })

    const store = new Datastore(dir, { extension: '', createIfMissing: false })
    await store.open()
    const version = await store.get(VERSION_KEY)
    expect(version.toString()).to.be.equal('1')

    const config = await store.get(CONFIG_KEY)
    expect(config.toString()).to.not.include(migrations[0].newApiAddr)

    await store.close()
  })
}
