'use strict'

const migrations = require('../migrations')
const debug = require('debug')

const log = debug('js-ipfs-repo-migrations:migrator')
exports = module.exports

exports.getLatestVersion = getLatestVersion

function getLatestVersion() {
  return migrations[migrations.length - 1].version
}

exports.migrate = migrate

async function migrate(repo, toVersion, progressCb, isDryRun) {
  await bootstrapRepo(repo)

  const currentVersion = await repo.version.get()

  toVersion = parseInt(toVersion) || getLatestVersion()
  if (currentVersion === toVersion) {
    log('Nothing to migrate, skipping migrations.')
    return
  }

  let counter = 0, totalMigrations = toVersion - currentVersion
  for (let migration of migrations) {
    if (toVersion !== undefined && migration.version > toVersion) {
      break
    }

    counter++

    if (migration.version > currentVersion) {
      log(`Migrating version ${migration.version}`)
      if (!isDryRun) {
        try {
          await migration.migrate(repo)
        } catch (e) {
          e.message = `During migration to version ${migration.version} exception was raised: ${e.message}`
          throw e
        }
      }
      typeof progressCb === 'function' && progressCb(migration, counter, totalMigrations) // Reports on migration process
      log(`Migrating to version ${migration.version} finished`)
    }
  }

  if (!isDryRun) await repo.version.set(toVersion || getLatestVersion())
  log('All migrations successfully migrated ', toVersion !== undefined ? `to version ${toVersion}!` : 'to latest version!')

  await repo.close()
}

exports.revert = revert

async function revert(repo, toVersion, progressCb, isDryRun) {
  await bootstrapRepo(repo)

  const currentVersion = await repo.version.get()

  if (!toVersion) {
    throw new Error('When reverting migrations, you have to specify to which version to revert!')
  }

  if (!Number.isInteger(toVersion) || toVersion <= 0) {
    throw new Error('Version has to be positive integer!')
  }

  if (currentVersion === toVersion) {
    log('Nothing to revert, skipping reverting.')
    return
  }

  let {reversible, problematicMigration} = verifyReversibility(currentVersion, toVersion)
  if (!reversible) {
    throw new Error(`Migration version ${problematicMigration} is not possible to revert! Cancelling reversion.`)
  }

  let counter = 0, totalMigrations = currentVersion - toVersion
  for (let migration of migrations.reverse()) {
    if (migration.version <= toVersion) {
      break
    }

    if (migration.version <= currentVersion) {
      log(`Reverting migration version ${migration.version}`)
      if (!isDryRun) {
        try {
          await migration.revert(repo)
        } catch (e) {
          e.message = `During reversion to version ${migration.version} exception was raised: ${e.message}`
          throw e
        }
      }
      typeof progressCb === 'function' && progressCb(migration, counter, totalMigrations) // Reports on migration process
      log(`Reverting to version ${migration.version} finished`)
    }
  }

  if (!isDryRun) await repo.version.set(toVersion)
  log(`All migrations successfully reverted to version ${toVersion}!`)

  await repo.close()
}

function verifyReversibility(fromVersion, toVersion) {
  for (let migration of migrations.reverse()) {
    if (migration.version <= toVersion) {
      break
    }

    if (migration.version <= fromVersion && !migration.reversible) {
      return {reversible: false, version: migration.version}
    }
  }

  return {reversible: true}
}

async function bootstrapRepo(repo) {
  if (!(await repo.exists())) {
    throw Error(`Repo on path '${repo.path}' does not exists!`)
  }

  // Will fail with error, if the repo is locked or not initialized.
  // There is not much to do about those errors, so letting them propagate...
  await repo.open()
}
