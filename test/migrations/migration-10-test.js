/* eslint-env mocha */
/* eslint-disable max-nested-callbacks */
'use strict'

const { expect } = require('aegir/utils/chai')

const { createStore } = require('../../src/utils')
const migration = require('../../migrations/migration-10')
const Key = require('interface-datastore').Key
const fromString = require('uint8arrays/from-string')
const Level5 = require('level-5')
const Level6 = require('level-6')

const keys = {
  CIQCKN76QUQUGYCHIKGFE6V6P3GJ2W26YFFPQW6YXV7NFHH3QB2RI3I: 'hello',
  CIQKKLBWAIBQZOIS5X7E32LQAL6236OUKZTMHPQSFIXPWXNZHQOV7JQ: fromString('derp')
}

async function bootstrap (dir, backend, repoOptions) {
  const store = createStore(dir, backend, repoOptions)
  await store.open()

  for (const name of Object.keys(keys)) {
    await store.put(new Key(name), keys[name])
  }

  await store.close()
}

async function validate (dir, backend, repoOptions) {
  const store = createStore(dir, backend, repoOptions)

  await store.open()

  for (const name of Object.keys(keys)) {
    const key = new Key(`/${name}`)

    expect(await store.has(key)).to.be.true(`Could not read key ${name}`)
    expect(store.get(key)).to.eventually.equal(keys[name], `Could not read value for key ${keys[name]}`)
  }

  await store.close()
}

function withLevel (repoOptions, levelImpl) {
  const stores = Object.keys(repoOptions.storageBackends)
    .filter(key => repoOptions.storageBackends[key].name === 'LevelDatastore')

  const output = {
    ...repoOptions
  }

  stores.forEach(store => {
    // override version of level passed to datastore options
    output.storageBackendOptions[store] = {
      ...output.storageBackendOptions[store],
      db: levelImpl
    }
  })

  return output
}

module.exports = (setup, cleanup, repoOptions) => {
  describe('migration 10', function () {
    this.timeout(240 * 1000)
    let dir

    beforeEach(async () => {
      dir = await setup()
    })

    afterEach(async () => {
      await cleanup(dir)
    })

    describe('forwards', () => {
      beforeEach(async () => {
        for (const backend of Object.keys(repoOptions.storageBackends)) {
          await bootstrap(dir, backend, withLevel(repoOptions, Level5))
        }
      })

      it('should migrate keys and values forward', async () => {
        await migration.migrate(dir, withLevel(repoOptions, Level6), () => {})

        for (const backend of Object.keys(repoOptions.storageBackends)) {
          await validate(dir, backend, withLevel(repoOptions, Level6))
        }
      })
    })

    describe('backwards using level@6.x.x', () => {
      beforeEach(async () => {
        for (const backend of Object.keys(repoOptions.storageBackends)) {
          await bootstrap(dir, backend, withLevel(repoOptions, Level6))
        }
      })

      it('should migrate keys and values backward', async () => {
        await migration.revert(dir, withLevel(repoOptions, Level6), () => {})

        for (const backend of Object.keys(repoOptions.storageBackends)) {
          await validate(dir, backend, withLevel(repoOptions, Level5))
        }
      })
    })

    describe('backwards using level@5.x.x', () => {
      beforeEach(async () => {
        for (const backend of Object.keys(repoOptions.storageBackends)) {
          await bootstrap(dir, backend, withLevel(repoOptions, Level6))
        }
      })

      it('should migrate keys and values backward', async () => {
        await migration.revert(dir, withLevel(repoOptions, Level5), () => {})

        for (const backend of Object.keys(repoOptions.storageBackends)) {
          await validate(dir, backend, withLevel(repoOptions, Level5))
        }
      })
    })
  })
}
