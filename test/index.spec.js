/* eslint-env mocha */
'use strict'

const { expect } = require('aegir/utils/chai')
const sinon = require('sinon')
const { MemoryBlockstore } = require('interface-blockstore')
const { MemoryDatastore } = require('interface-datastore')

const migrator = require('../src/index')
const repoVersion = require('../src/repo/version')
const repoInit = require('../src/repo/init')
const errors = require('../src/errors')

function createMigrations () {
  return [
    {
      version: 1,
      migrate: sinon.stub().resolves(),
      revert: sinon.stub().resolves()
    },
    {
      version: 2,
      migrate: sinon.stub().resolves(),
      revert: sinon.stub().resolves()
    },
    {
      version: 3,
      migrate: sinon.stub().resolves(),
      revert: sinon.stub().resolves()
    },
    {
      version: 4,
      migrate: sinon.stub().resolves(),
      revert: sinon.stub().resolves()
    }
  ]
}

function createOptions () {
  return {
    migrations: createMigrations()
  }
}

describe('index.js', () => {
  let getVersionStub
  let setVersionStub
  let lockStub
  let initStub
  let lockCloseStub
  let repoOptions
  const repoLock = {
    lock: () => ({
      close: () => {}
    })
  }
  const backends = {
    root: new MemoryDatastore(),
    blocks: new MemoryBlockstore(),
    datastore: new MemoryDatastore(),
    keys: new MemoryDatastore(),
    pins: new MemoryDatastore()
  }

  beforeEach(() => {
    // Reset all stubs
    sinon.reset()

    initStub.resolves(true)
    lockCloseStub.resolves()
    lockStub.resolves({ close: lockCloseStub })

    repoOptions = {
      repoLock
    }
  })

  before(() => {
    getVersionStub = sinon.stub(repoVersion, 'getVersion')
    setVersionStub = sinon.stub(repoVersion, 'setVersion')
    lockCloseStub = sinon.stub()
    lockStub = sinon.stub(repoLock, 'lock')
    initStub = sinon.stub(repoInit, 'isRepoInitialized')
  })

  after(() => {
    getVersionStub.restore()
    setVersionStub.restore()
    lockStub.restore()
    initStub.restore()
  })

  it('get version of the latest migration', () => {
    const migrationsMock = createMigrations()

    expect(migrator.getLatestMigrationVersion(migrationsMock)).to.equal(4)
    expect(migrator.getLatestMigrationVersion([])).to.equal(0)
  })

  describe('revert', () => {
    it('should error with out path argument', () => {
      const options = createOptions()

      return expect(migrator.revert(undefined, undefined, undefined, undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error without backends argument', () => {
      const options = createOptions()

      return expect(migrator.revert('/some/path', undefined, undefined, undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error without repo options argument', () => {
      const options = createOptions()

      return expect(migrator.revert('/some/path', backends, undefined, undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error without toVersion argument', () => {
      const options = createOptions()

      return expect(migrator.revert('/some/path', backends, {}, undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with invalid toVersion argument', () => {
      const invalidValues = ['eight', '-1', '1', -1]
      const options = createOptions()

      return Promise.all(
        invalidValues.map((value) => expect(migrator.revert('/some/path', backends, repoOptions, value, options))
          .to.eventually.be.rejectedWith(errors.InvalidValueError).with.property('code', errors.InvalidValueError.code))
      )
    })

    it('should not revert if current repo version and toVersion matches', async () => {
      getVersionStub.returns(2)
      const options = createOptions()

      await expect(migrator.revert('/some/path', backends, repoOptions, 2, options))
        .to.eventually.be.fulfilled()

      expect(lockStub.called).to.be.false()
    })

    it('should not revert if current repo version is lower then toVersion', async () => {
      getVersionStub.returns(2)
      const options = createOptions()

      await expect(migrator.revert('/some/path', backends, repoOptions, 3, options))
        .to.eventually.be.rejectedWith(errors.InvalidValueError).with.property('code', errors.InvalidValueError.code)

      expect(lockStub.called).to.be.false()
    })

    it('should not allow to reverse migration that is not reversible', () => {
      const nonReversibleMigrationsMock = createMigrations()
      nonReversibleMigrationsMock[2].revert = undefined
      const options = { migrations: nonReversibleMigrationsMock }

      getVersionStub.returns(4)
      return expect(
        migrator.revert('/some/path', backends, repoOptions, 1, options)
      ).to.eventually.be.rejectedWith(errors.NonReversibleMigrationError)
        .with.property('code', errors.NonReversibleMigrationError.code)
    })

    it('should revert expected migrations', async () => {
      const options = createOptions()
      getVersionStub.returns(3)

      await expect(migrator.revert('/some/path', backends, repoOptions, 1, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith(1, backends)).to.be.true()

      // Checking migrations
      expect(options.migrations[3].revert.called).to.be.false()
      expect(options.migrations[2].revert.calledOnce).to.be.true()
      expect(options.migrations[1].revert.calledOnce).to.be.true()
      expect(options.migrations[0].revert.called).to.be.false()
    })

    it('should revert one migration as expected', async () => {
      const options = createOptions()
      getVersionStub.returns(2)

      await expect(migrator.revert('/some/path', backends, repoOptions, 1, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith(1, backends)).to.be.true()

      // Checking migrations
      expect(options.migrations[3].revert.called).to.be.false()
      expect(options.migrations[2].revert.called).to.be.false()
      expect(options.migrations[1].revert.calledOnce).to.be.true()
      expect(options.migrations[0].revert.called).to.be.false()
    })

    it('should reversion with one migration', async () => {
      const migrationsMock = [
        {
          version: 2,
          reversible: true,
          migrate: sinon.stub().resolves(),
          revert: sinon.stub().resolves()
        }
      ]
      const options = { migrations: migrationsMock }
      getVersionStub.returns(2)

      await expect(migrator.revert('/some/path', backends, repoOptions, 1, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith(1, backends)).to.be.true()

      // Checking migrations
      expect(migrationsMock[0].revert.calledOnce).to.be.true()
    })

    it('should not have any side-effects when in dry run', async () => {
      const options = createOptions()
      getVersionStub.returns(4)
      options.isDryRun = true

      await expect(migrator.revert('/some/path', backends, repoOptions, 2, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.called).to.be.false()
      expect(lockStub.called).to.be.false()
      expect(setVersionStub.called).to.be.false()

      return options.migrations.forEach(({ revert }) => expect(revert.calledOnce).to.be.false)
    })

    it('should not lock repo when ignoreLock is used', async () => {
      const options = createOptions()
      options.ignoreLock = true

      getVersionStub.returns(4)

      await expect(migrator.revert('/some/path', backends, repoOptions, 2, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.called).to.be.false()
      expect(lockStub.called).to.be.false()
      expect(setVersionStub.calledOnceWith(2, backends)).to.be.true()

      // Checking migrations
      expect(options.migrations[3].revert.calledOnce).to.be.true()
      expect(options.migrations[2].revert.calledOnce).to.be.true()
      expect(options.migrations[1].revert.called).to.be.false()
      expect(options.migrations[0].revert.called).to.be.false()
    })

    it('should report progress when progress callback is supplied', async () => {
      const options = createOptions()
      options.onProgress = sinon.stub()
      getVersionStub.returns(4)

      options.migrations[2].revert = (backends, onProgress) => {
        onProgress(50, 'hello')
      }

      await expect(migrator.revert('/some/path', backends, repoOptions, 2, options))
        .to.eventually.be.fulfilled()

      expect(options.onProgress.getCall(0).calledWith(3, '50.00', 'hello')).to.be.true()
    })

    it('should unlock repo when error is thrown', async () => {
      getVersionStub.returns(4)
      const options = createOptions()
      options.migrations[2].revert = sinon.stub().rejects()

      await expect(migrator.revert('/some/path', backends, repoOptions, 2, options))
        .to.eventually.be.rejected()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()

      // The last successfully reverted migration should be set as repo's version
      expect(setVersionStub.calledOnceWith(3, backends)).to.be.true()
    })
  })

  describe('migrate', () => {
    it('should error with out path argument', () => {
      const options = createOptions()

      return expect(migrator.migrate(undefined, undefined, undefined, undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with out backends argument', () => {
      const options = createOptions()

      return expect(migrator.migrate('/some/path', undefined, undefined, undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with out repoOptions argument', () => {
      const options = createOptions()

      return expect(migrator.migrate('/some/path', backends, undefined, undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with out toVersion argument', () => {
      const options = createOptions()

      return expect(migrator.migrate('/some/path', backends, repoOptions, undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with invalid toVersion argument', () => {
      const invalidValues = ['eight', '-1', '1', -1, {}]

      return Promise.all(
        invalidValues.map((invalidValue) => expect(migrator.migrate('/some/path', backends, repoOptions, invalidValue, createOptions()))
          .to.eventually.be.rejectedWith(errors.InvalidValueError).with.property('code', errors.InvalidValueError.code))
      )
    })

    it('should verify that all migrations are available', () => {
      const options = {
        migrations: [
          {
            version: 3,
            migrate: sinon.stub().resolves(),
            revert: sinon.stub().resolves()
          },
          {
            version: 4,
            migrate: sinon.stub().resolves(),
            revert: sinon.stub().resolves()
          }
        ]
      }

      getVersionStub.returns(1)

      return expect(migrator.migrate('/some/path', backends, repoOptions, 3, options))
        .to.eventually.be.rejectedWith(errors.InvalidValueError).with.property('code', errors.InvalidValueError.code)
    })

    it('should verify that all migrations are available', () => {
      const options = {
        migrations: [
          {
            version: 3,
            migrate: sinon.stub().resolves(),
            revert: sinon.stub().resolves()
          },
          {
            version: 4,
            migrate: sinon.stub().resolves(),
            revert: sinon.stub().resolves()
          }
        ]
      }

      getVersionStub.returns(3)

      return expect(migrator.migrate('/some/path', backends, repoOptions, 5, options))
        .to.eventually.be.rejectedWith(errors.InvalidValueError).with.property('code', errors.InvalidValueError.code)
    })

    it('should not migrate if current repo version and toVersion matches', async () => {
      getVersionStub.returns(2)
      const options = createOptions()

      await expect(migrator.migrate('/some/path', backends, repoOptions, 2, options))
        .to.eventually.be.fulfilled()

      expect(lockStub.called).to.be.false()
    })

    it('should not migrate if current repo version is higher then toVersion', async () => {
      getVersionStub.returns(3)
      const options = createOptions()

      await expect(migrator.migrate('/some/path', backends, repoOptions, 2, options))
        .to.eventually.be.rejectedWith(errors.InvalidValueError).with.property('code', errors.InvalidValueError.code)

      expect(lockStub.called).to.be.false()
    })

    it('should migrate expected migrations', async () => {
      const options = createOptions()
      getVersionStub.returns(1)

      await expect(migrator.migrate('/some/path', backends, repoOptions, 3, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith(3, backends)).to.be.true()

      // Checking migrations
      expect(options.migrations[3].migrate.called).to.be.false()
      expect(options.migrations[2].migrate.calledOnce).to.be.true()
      expect(options.migrations[1].migrate.calledOnce).to.be.true()
      expect(options.migrations[0].migrate.called).to.be.false()
    })

    it('should not have any side-effects when in dry run', async () => {
      const options = createOptions()
      options.isDryRun = true
      getVersionStub.returns(2)

      await expect(migrator.migrate('/some/path', backends, repoOptions, 4, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.called).to.be.false()
      expect(lockStub.called).to.be.false()
      expect(setVersionStub.called).to.be.false()

      return options.migrations.forEach(({ migrate }) => expect(migrate.calledOnce).to.be.false)
    })

    it('should not lock repo when ignoreLock is used', async () => {
      const options = createOptions()
      options.ignoreLock = true
      getVersionStub.returns(2)

      await expect(migrator.migrate('/some/path', backends, repoOptions, 4, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.called).to.be.false()
      expect(lockStub.called).to.be.false()
      expect(setVersionStub.calledOnceWith(4, backends)).to.be.true()

      // Checking migrations
      expect(options.migrations[3].migrate.calledOnce).to.be.true()
      expect(options.migrations[2].migrate.calledOnce).to.be.true()
      expect(options.migrations[1].migrate.called).to.be.false()
      expect(options.migrations[0].migrate.called).to.be.false()
    })

    it('should report progress when progress callback is supplied', async () => {
      const options = createOptions()
      options.onProgress = sinon.stub()
      getVersionStub.returns(2)

      options.migrations[2].migrate = (backends, onProgress) => {
        onProgress(50, 'hello')
      }

      await expect(migrator.migrate('/some/path', backends, repoOptions, 4, options))
        .to.eventually.be.fulfilled()

      expect(options.onProgress.getCall(0).calledWith(3, '50.00', 'hello')).to.be.true()
    })

    it('should unlock repo when error is thrown', async () => {
      getVersionStub.returns(2)
      const options = createOptions()
      options.migrations[3].migrate = sinon.stub().rejects()

      await expect(migrator.migrate('/some/path', backends, repoOptions, 4, options))
        .to.eventually.be.rejected()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()

      // The last successfully migrated migration should be set as repo's version
      expect(setVersionStub.calledOnceWith(3, backends)).to.be.true()
    })
  })
})
