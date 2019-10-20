/* eslint-env mocha */
'use strict'

const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
chai.use(require('chai-as-promised'))
chai.use(require('dirty-chai'))

const migrator = require('../src/index')
const repoVersion = require('../src/repo/version')
const repoLock = require('../src/repo/lock')
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
    migrations: createMigrations(),
  }
}

describe('index.js', () => {
  let getVersionStub
  let setVersionStub
  let lockStub
  let initStub
  let lockCloseStub

  beforeEach(() => {
    // Reset all stubs
    sinon.reset()

    initStub.resolves(true)
    lockCloseStub.resolves()
    lockStub.resolves({ close: lockCloseStub })
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

      return expect(migrator.revert(undefined, undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with out toVersion argument', () => {
      const options = createOptions()

      return expect(migrator.revert('/some/path', undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with invalid toVersion argument', () => {
      const invalidValues = ['eight', '-1', '1', -1]
      const options = createOptions()

      return Promise.all(
        invalidValues.map((value) => expect(migrator.revert('/some/path', value, options))
          .to.eventually.be.rejectedWith(errors.InvalidValueError).with.property('code', errors.InvalidValueError.code))
      )
    })

    it('should not revert if current repo version and toVersion matches', async () => {
      getVersionStub.returns(2)
      const options = createOptions()

      await expect(migrator.revert('/some/path', 2, options))
        .to.eventually.be.fulfilled()

      expect(lockStub.called).to.be.false()
    })

    it('should not revert if current repo version is lower then toVersion', async () => {
      getVersionStub.returns(2)
      const options = createOptions()

      await expect(migrator.revert('/some/path', 3, options))
        .to.eventually.be.rejectedWith(errors.InvalidValueError).with.property('code', errors.InvalidValueError.code)

      expect(lockStub.called).to.be.false()
    })

    it('should not allow to reverse migration that is not reversible', () => {
      const nonReversibleMigrationsMock = createMigrations()
      nonReversibleMigrationsMock[2].revert = undefined
      const options = { migrations: nonReversibleMigrationsMock }

      getVersionStub.returns(4)
      return expect(
        migrator.revert('/some/path', 1, options)
      ).to.eventually.be.rejectedWith(errors.NonReversibleMigrationError)
        .with.property('code', errors.NonReversibleMigrationError.code)
    })

    it('should revert expected migrations', async () => {
      const options = createOptions()
      getVersionStub.returns(3)

      await expect(migrator.revert('/some/path', 1, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith('/some/path', 1)).to.be.true()

      // Checking migrations
      expect(options.migrations[3].revert.called).to.be.false()
      expect(options.migrations[2].revert.calledOnce).to.be.true()
      expect(options.migrations[1].revert.calledOnce).to.be.true()
      expect(options.migrations[0].revert.called).to.be.false()
    })

    it('should revert one migration as expected', async () => {
      const options = createOptions()
      getVersionStub.returns(2)

      await expect(migrator.revert('/some/path', 1, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith('/some/path', 1)).to.be.true()

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

      await expect(migrator.revert('/some/path', 1, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith('/some/path', 1)).to.be.true()

      // Checking migrations
      expect(migrationsMock[0].revert.calledOnce).to.be.true()
    })

    it('should not have any side-effects when in dry run', async () => {
      const options = createOptions()
      getVersionStub.returns(4)
      options.isDryRun = true

      await expect(migrator.revert('/some/path', 2, options))
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

      await expect(migrator.revert('/some/path', 2, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.called).to.be.false()
      expect(lockStub.called).to.be.false()
      expect(setVersionStub.calledOnceWith('/some/path', 2)).to.be.true()

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

      await expect(migrator.revert('/some/path', 2, options))
        .to.eventually.be.fulfilled()

      expect(options.onProgress.getCall(0).calledWith(sinon.match.any, 1, 2)).to.be.true()
      expect(options.onProgress.getCall(1).calledWith(sinon.match.any, 2, 2)).to.be.true()
    })

    it('should unlock repo when error is thrown', async () => {
      getVersionStub.returns(4)
      const options = createOptions()
      options.migrations[2].revert = sinon.stub().rejects()

      await expect(migrator.revert('/some/path', 2, options))
        .to.eventually.be.rejected()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()

      // The last successfully reverted migration should be set as repo's version
      expect(setVersionStub.calledOnceWith('/some/path', 3)).to.be.true()
    })
  })

  describe('migrate', () => {
    it('should error with out path argument', () => {
      const options = createOptions()

      return expect(migrator.migrate(undefined, undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with out toVersion argument', () => {
      const options = createOptions()

      return expect(migrator.migrate('/some/path', undefined, options))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError).with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with invalid toVersion argument', () => {
      const invalidValues = ['eight', '-1', '1', -1, {}]

      return Promise.all(
        invalidValues.map((invalidValue) => expect(migrator.migrate('/some/path', invalidValue, createOptions()))
          .to.eventually.be.rejectedWith(errors.InvalidValueError).with.property('code', errors.InvalidValueError.code))
      )
    })

    it('should error if migrations does not exist', () => {
      const options = createOptions()

      return expect(migrator.migrate('/some/path', 5, options))
        .to.eventually.be.rejectedWith(errors.InvalidValueError).with.property('code', errors.InvalidValueError.code)
    })

    it('should not migrate if current repo version and toVersion matches', async () => {
      getVersionStub.returns(2)
      const options = createOptions()

      await expect(migrator.migrate('/some/path', 2, options))
        .to.eventually.be.fulfilled()

      expect(lockStub.called).to.be.false()
    })

    it('should not migrate if current repo version is higher then toVersion', async () => {
      getVersionStub.returns(3)
      const options = createOptions()

      await expect(migrator.migrate('/some/path', 2, options))
        .to.eventually.be.rejectedWith(errors.InvalidValueError).with.property('code', errors.InvalidValueError.code)

      expect(lockStub.called).to.be.false()
    })

    it('should migrate expected migrations', async () => {
      const options = createOptions()
      getVersionStub.returns(1)

      await expect(migrator.migrate('/some/path', 3, options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith('/some/path', 3)).to.be.true()

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

      await expect(migrator.migrate('/some/path', 4, options))
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

      await expect(migrator.migrate('/some/path', 4,  options))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.called).to.be.false()
      expect(lockStub.called).to.be.false()
      expect(setVersionStub.calledOnceWith('/some/path', 4)).to.be.true()

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

      await expect(migrator.migrate('/some/path', 4, options))
        .to.eventually.be.fulfilled()

      expect(options.onProgress.getCall(0).calledWith(sinon.match.any, 1, 2)).to.be.true()
      expect(options.onProgress.getCall(1).calledWith(sinon.match.any, 2, 2)).to.be.true()
    })

    it('should unlock repo when error is thrown', async () => {
      getVersionStub.returns(2)
      const options = createOptions()
      options.migrations[3].migrate = sinon.stub().rejects()

      await expect(migrator.migrate('/some/path', 4, options))
        .to.eventually.be.rejected()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()

      // The last successfully migrated migration should be set as repo's version
      expect(setVersionStub.calledOnceWith('/some/path', 3)).to.be.true()
    })
  })
})
