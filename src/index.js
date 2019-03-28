'use strict'

const migrations = require('../migrations')
const repo_version = require('./repo/version')
const repo_lock = require('./repo/lock')
const debug = require('debug')

const log = debug('js-ipfs-repo-migrations:migrator')

exports.getLatestMigrationVersion = getLatestMigrationVersion

/**
 * Returns the version of latest migration.
 *
 * @returns int
 */
function getLatestMigrationVersion() {
  return migrations[migrations.length - 1].version
}

async function migrate(store, toVersion, progressCb, isDryRun) {
  if (toVersion && (!Number.isInteger(toVersion) || toVersion <= 0)) {
    throw new Error('Version has to be positive integer!')
  }
  toVersion = toVersion || getLatestMigrationVersion()

  const currentVersion = await repo_version.getVersion(store)

  let lock
  if (!isDryRun) lock = await repo_lock.lock(currentVersion, store.path)

  if (currentVersion === toVersion) {
    log('Nothing to migrate, skipping migrations.')
    return
  }
  let counter = 0, totalMigrations = toVersion - currentVersion
  for (let migration of migrations) {
    if (toVersion !== undefined && migration.version > toVersion) {
      break
    }

    if (migration.version > currentVersion) {
      counter++
      log(`Migrating version ${migration.version}`)
      if (!isDryRun) {
        try {
          await migration.migrate(store)
        } catch (e) {
          e.message = `During migration to version ${migration.version} exception was raised: ${e.message}`
          throw e
        }
      }
      typeof progressCb === 'function' && progressCb(migration, counter, totalMigrations) // Reports on migration process
      log(`Migrating to version ${migration.version} finished`)
    }
  }

  if (!isDryRun) await repo_version.setVersion(store, toVersion || getLatestMigrationVersion())
  log('All migrations successfully migrated ', toVersion !== undefined ? `to version ${toVersion}!` : 'to latest version!')

  if (!isDryRun) await lock.close()
  await store.close()
}

exports.migrate = migrate

async function revert(store, toVersion, progressCb, isDryRun) {
  if (!toVersion) {
    throw new Error('When reverting migrations, you have to specify to which version to revert!')
  }

  if (!Number.isInteger(toVersion) || toVersion <= 0) {
    throw new Error('Version has to be positive integer!')
  }

  const currentVersion = await repo_version.getVersion(store)
  if (currentVersion === toVersion) {
    log('Nothing to revert, skipping reverting.')
    return
  }

  let {reversible, problematicMigration} = verifyReversibility(currentVersion, toVersion)
  if (!reversible) {
    throw new Error(`Migration version ${problematicMigration} is not possible to revert! Cancelling reversion.`)
  }

  let lock
  if (!isDryRun) lock = await repo_lock.lock(currentVersion, store.path)
  let counter = 0, totalMigrations = currentVersion - toVersion
  const reversedMigrationArray = migrations.reverse()
  for (let migration of reversedMigrationArray) {
    if (migration.version <= toVersion) {
      break
    }

    if (migration.version <= currentVersion) {
      counter++
      log(`Reverting migration version ${migration.version}`)
      if (!isDryRun) {
        try {
          await migration.revert(store)
        } catch (e) {
          e.message = `During reversion to version ${migration.version} exception was raised: ${e.message}`
          throw e
        }
      }
      typeof progressCb === 'function' && progressCb(migration, counter, totalMigrations) // Reports on migration process
      log(`Reverting to version ${migration.version} finished`)
    }
  }

  if (!isDryRun) await repo_version.setVersion(store, toVersion)
  log(`All migrations successfully reverted to version ${toVersion}!`)

  if (!isDryRun) await lock.close()
  await store.close()
}

exports.revert = revert

function verifyReversibility(fromVersion, toVersion) {
  const reversedMigrationArray = migrations.reverse()
  for (let migration of reversedMigrationArray) {
    if (migration.version <= toVersion) {
      break
    }

    if (migration.version <= fromVersion && !migration.reversible) {
      return {reversible: false, version: migration.version}
    }
  }

  return {reversible: true, version: undefined}
}
