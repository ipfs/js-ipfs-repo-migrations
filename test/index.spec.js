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
      reversible: true,
      migrate: sinon.stub().resolves(),
      revert: sinon.stub().resolves()
    },
    {
      version: 2,
      reversible: true,
      migrate: sinon.stub().resolves(),
      revert: sinon.stub().resolves()
    },
    {
      version: 3,
      reversible: true,
      migrate: sinon.stub().resolves(),
      revert: sinon.stub().resolves()
    },
    {
      version: 4,
      reversible: true,
      migrate: sinon.stub().resolves(),
      revert: sinon.stub().resolves()
    }
  ]
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

    expect(
      () => migrator.getLatestMigrationVersion([])
    ).to.throw(errors.InvalidValueError, 'Migrations must be non-empty array!').with.property('code', errors.InvalidValueError.code)
  })

  describe('revert', () => {
    it('should error with out path argument', () => {
      const migrationsMock = createMigrations()

      return expect(migrator.revert(undefined, undefined, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError, 'Path argument is required!').with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with out toVersion argument', () => {
      const migrationsMock = createMigrations()

      return expect(migrator.revert('/some/path', undefined, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError, 'When reverting migrations, you have to specify to which version to revert!').with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with invalid toVersion argument', () => {
      const invalidValues = ['eight', '-1', '1', -1]
      const migrationsMock = createMigrations()

      return Promise.all(
        invalidValues.map((value) => expect(migrator.revert('/some/path', value, undefined, undefined, undefined, undefined, migrationsMock))
          .to.eventually.be.rejectedWith(errors.InvalidValueError, 'Version has to be positive integer!').with.property('code', errors.InvalidValueError.code))
      )
    })

    it('should not revert if current repo version and toVersion matches', async () => {
      getVersionStub.returns(2)
      const migrationsMock = createMigrations()

      await expect(migrator.revert('/some/path', 2, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockStub.called).to.be.false()
    })

    it('should not revert if current repo version is lower then toVersion', async () => {
      getVersionStub.returns(2)
      const migrationsMock = createMigrations()

      await expect(migrator.revert('/some/path', 3, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockStub.called).to.be.false()
    })

    it('should not allow to reverse migration that is not reversible', () => {
      const nonReversibleMigrationsMock = createMigrations()
      nonReversibleMigrationsMock[2].reversible = false

      getVersionStub.returns(4)
      return expect(
        migrator.revert('/some/path', 1, undefined, undefined, undefined, undefined, nonReversibleMigrationsMock)
      ).to.eventually.be.rejectedWith(errors.NonReversibleMigrationError, 'Migration version 3 is not possible to revert! Cancelling reversion.')
       .with.property('code', errors.NonReversibleMigrationError.code)
    })

    it('should revert expected migrations', async () => {
      const migrationsMock = createMigrations()
      getVersionStub.returns(3)

      await expect(migrator.revert('/some/path', 1, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith('/some/path', 1)).to.be.true()

      // Checking migrations
      expect(migrationsMock[3].revert.called).to.be.false()
      expect(migrationsMock[2].revert.calledOnce).to.be.true()
      expect(migrationsMock[1].revert.calledOnce).to.be.true()
      expect(migrationsMock[0].revert.called).to.be.false()
    })

    it('should revert one migration as expected', async () => {
      const migrationsMock = createMigrations()
      getVersionStub.returns(2)

      await expect(migrator.revert('/some/path', 1, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith('/some/path', 1)).to.be.true()

      // Checking migrations
      expect(migrationsMock[3].revert.called).to.be.false()
      expect(migrationsMock[2].revert.called).to.be.false()
      expect(migrationsMock[1].revert.calledOnce).to.be.true()
      expect(migrationsMock[0].revert.called).to.be.false()
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
      getVersionStub.returns(2)

      await expect(migrator.revert('/some/path', 1, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith('/some/path', 1)).to.be.true()

      // Checking migrations
      expect(migrationsMock[0].revert.calledOnce).to.be.true()
    })

    it('should not have any side-effects when in dry run', async () => {
      const migrationsMock = createMigrations()
      getVersionStub.returns(4)

      await expect(migrator.revert('/some/path', 2, undefined, undefined, undefined, true, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.called).to.be.false()
      expect(lockStub.called).to.be.false()
      expect(setVersionStub.called).to.be.false()

      return migrationsMock.forEach(({ revert }) => expect(revert.calledOnce).to.be.false)
    })

    it('should not lock repo when ignoreLock is used', async () => {
      const migrationsMock = createMigrations()
      getVersionStub.returns(4)

      await expect(migrator.revert('/some/path', 2, true, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.called).to.be.false()
      expect(lockStub.called).to.be.false()
      expect(setVersionStub.calledOnceWith('/some/path', 2)).to.be.true()

      // Checking migrations
      expect(migrationsMock[3].revert.calledOnce).to.be.true()
      expect(migrationsMock[2].revert.calledOnce).to.be.true()
      expect(migrationsMock[1].revert.called).to.be.false()
      expect(migrationsMock[0].revert.called).to.be.false()
    })

    it('should report progress when progress callback is supplied', async () => {
      const migrationsMock = createMigrations()
      getVersionStub.returns(4)
      const progressCb = sinon.stub()

      await expect(migrator.revert('/some/path', 2, undefined, undefined, progressCb,  undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(progressCb.getCall(0).calledWith(sinon.match.any, 1, 2)).to.be.true()
      expect(progressCb.getCall(1).calledWith(sinon.match.any, 2, 2)).to.be.true()
    })

    it('should unlock repo when error is thrown', async () => {
      getVersionStub.returns(4)
      const migrationsMock = createMigrations()
      migrationsMock[3].revert = sinon.stub().rejects()

      await expect(migrator.revert('/some/path', 2, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.rejected()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.called).to.be.false()
    })
  })

  describe('migrate', () => {
    it('should error with out path argument', () => {
      const migrationsMock = createMigrations()

      return expect(migrator.migrate(undefined, undefined, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.rejectedWith(errors.RequiredParameterError, 'Path argument is required!').with.property('code', errors.RequiredParameterError.code)
    })

    it('should error with invalid toVersion argument', () => {
      const invalidValues = ['eight', '-1', '1', -1]
      const migrationsMock = createMigrations()

      return Promise.all(
        invalidValues.map((value) => expect(migrator.migrate('/some/path', value, undefined, undefined, undefined, undefined, migrationsMock))
          .to.eventually.be.rejectedWith(errors.InvalidValueError, 'Version has to be positive integer!').with.property('code', errors.InvalidValueError.code))
      )
    })

    it('should use latest migration\'s version if no toVersion is provided', async () => {
      const migrationsMock = createMigrations()
      getVersionStub.returns(2)

      await expect(migrator.migrate('/some/path', undefined, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      setVersionStub.calledOnceWithExactly('/some/path', 4) // 4 is the latest migration's version
    })

    it('should not migrate if current repo version and toVersion matches', async () => {
      getVersionStub.returns(2)
      const migrationsMock = createMigrations()

      await expect(migrator.migrate('/some/path', 2, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockStub.called).to.be.false()
    })

    it('should not migrate if current repo version is higher then toVersion', async () => {
      getVersionStub.returns(3)
      const migrationsMock = createMigrations()

      await expect(migrator.migrate('/some/path', 2, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockStub.called).to.be.false()
    })

    it('should migrate expected migrations', async () => {
      const migrationsMock = createMigrations()
      getVersionStub.returns(1)

      await expect(migrator.migrate('/some/path', 3, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.calledOnceWith('/some/path', 3)).to.be.true()

      // Checking migrations
      expect(migrationsMock[3].migrate.called).to.be.false()
      expect(migrationsMock[2].migrate.calledOnce).to.be.true()
      expect(migrationsMock[1].migrate.calledOnce).to.be.true()
      expect(migrationsMock[0].migrate.called).to.be.false()
    })

    it('should not have any side-effects when in dry run', async () => {
      const migrationsMock = createMigrations()
      getVersionStub.returns(2)

      await expect(migrator.migrate('/some/path', 4, undefined, undefined, undefined, true, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.called).to.be.false()
      expect(lockStub.called).to.be.false()
      expect(setVersionStub.called).to.be.false()

      return migrationsMock.forEach(({ migrate }) => expect(migrate.calledOnce).to.be.false)
    })

    it('should not lock repo when ignoreLock is used', async () => {
      const migrationsMock = createMigrations()
      getVersionStub.returns(2)

      await expect(migrator.migrate('/some/path', 4, true, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(lockCloseStub.called).to.be.false()
      expect(lockStub.called).to.be.false()
      expect(setVersionStub.calledOnceWith('/some/path', 4)).to.be.true()

      // Checking migrations
      expect(migrationsMock[3].migrate.calledOnce).to.be.true()
      expect(migrationsMock[2].migrate.calledOnce).to.be.true()
      expect(migrationsMock[1].migrate.called).to.be.false()
      expect(migrationsMock[0].migrate.called).to.be.false()
    })

    it('should report progress when progress callback is supplied', async () => {
      const migrationsMock = createMigrations()
      getVersionStub.returns(2)
      const progressCb = sinon.stub()

      await expect(migrator.migrate('/some/path', 4, undefined, undefined, progressCb, undefined, migrationsMock))
        .to.eventually.be.fulfilled()

      expect(progressCb.getCall(0).calledWith(sinon.match.any, 1, 2)).to.be.true()
      expect(progressCb.getCall(1).calledWith(sinon.match.any, 2, 2)).to.be.true()
    })

    it('should unlock repo when error is thrown', async () => {
      getVersionStub.returns(2)
      const migrationsMock = createMigrations()
      migrationsMock[3].migrate = sinon.stub().rejects()

      await expect(migrator.migrate('/some/path', 4, undefined, undefined, undefined, undefined, migrationsMock))
        .to.eventually.be.rejected()

      expect(lockCloseStub.calledOnce).to.be.true()
      expect(lockStub.calledOnce).to.be.true()
      expect(setVersionStub.called).to.be.false()
    })
  })
})
