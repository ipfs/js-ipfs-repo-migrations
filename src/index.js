'use strict'

const migrations = require('../migrations')
const repoVersion = require('./repo/version')
const repoLock = require('./repo/lock')
const isBrowser = require('./option-node')
const errors = require('./errors')
const debug = require('debug')

const log = debug('js-ipfs-repo-migrations:migrator')

/**
 * Returns the version of latest migration.
 *
 * @returns {int}
 */
function getLatestMigrationVersion () {
  return migrations[migrations.length - 1].version
}

exports.getLatestMigrationVersion = getLatestMigrationVersion

/**
 * Main function to execute forward migrations.
 * It acquire lock on the provided path before doing any migrations.
 *
 * Signature of the progress callback is: function(migrationObject: object, currentMigrationNumber: int, totalMigrationsCount: int)
 *
 * @param {string} path - Path to initialized (!) JS-IPFS repo
 * @param {int|undefined} toVersion - Version to which the repo should be migrated, if undefined repo will be migrated to the latest version.
 * @param {function|undefined} progressCb - Callback which will be called after each executed migration to report progress
 * @param {boolean|undefined} isDryRun - Allows to simulate the execution of the migrations without any effect.
 * @returns {Promise<void>}
 */
async function migrate (path, toVersion, progressCb, isDryRun) {
  if (toVersion && (!Number.isInteger(toVersion) || toVersion <= 0)) {
    throw new Error('Version has to be positive integer!')
  }
  toVersion = toVersion || getLatestMigrationVersion()

  const currentVersion = await repoVersion.getVersion(path)

  let lock
  if (!isDryRun) lock = await repoLock.lock(currentVersion, path)

  try {
    if (currentVersion === toVersion) {
      log('Nothing to migrate, skipping migrations.')
      return
    }
    let counter = 0
    let totalMigrations = toVersion - currentVersion
    for (let migration of migrations) {
      if (toVersion !== undefined && migration.version > toVersion) {
        break
      }

      if (migration.version > currentVersion) {
        counter++
        log(`Migrating version ${migration.version}`)
        if (!isDryRun) {
          try {
            await migration.migrate(path, isBrowser)
          } catch (e) {
            e.message = `During migration to version ${migration.version} exception was raised: ${e.message}`
            throw e
          }
        }
        typeof progressCb === 'function' && progressCb(migration, counter, totalMigrations) // Reports on migration process
        log(`Migrating to version ${migration.version} finished`)
      }
    }

    if (!isDryRun) await repoVersion.setVersion(path, toVersion || getLatestMigrationVersion())
    log('All migrations successfully migrated ', toVersion !== undefined ? `to version ${toVersion}!` : 'to latest version!')
  } finally {
    if (!isDryRun) await lock.close()
  }
}

exports.migrate = migrate

/**
 * Main function to execute backward migration (reversion).
 * It acquire lock on the provided path before doing any migrations.
 *
 * Signature of the progress callback is: function(migrationObject: object, currentMigrationNumber: int, totalMigrationsCount: int)
 *
 * @param {string} path - Path to initialized (!) JS-IPFS repo
 * @param {int} toVersion - Version to which the repo will be reverted.
 * @param {function|undefined} progressCb - Callback which will be called after each reverted migration to report progress
 * @param {boolean|undefined} isDryRun - Allows to simulate the execution of the reversion without any effect.
 * @returns {Promise<void>}
 */
async function revert (path, toVersion, progressCb, isDryRun) {
  if (!toVersion) {
    throw new Error('When reverting migrations, you have to specify to which version to revert!')
  }

  if (!Number.isInteger(toVersion) || toVersion <= 0) {
    throw new Error('Version has to be positive integer!')
  }

  const currentVersion = await repoVersion.getVersion(path)
  if (currentVersion === toVersion) {
    log('Nothing to revert, skipping reverting.')
    return
  }

  let { reversible, problematicMigration } = verifyReversibility(currentVersion, toVersion)
  if (!reversible) {
    throw new errors.NonReversibleMigration(`Migration version ${problematicMigration} is not possible to revert! Cancelling reversion.`)
  }

  let lock
  if (!isDryRun) lock = await repoLock.lock(currentVersion, path)

  try {
    let counter = 0
    let totalMigrations = currentVersion - toVersion
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
            await migration.revert(path, isBrowser)
          } catch (e) {
            e.message = `During reversion to version ${migration.version} exception was raised: ${e.message}`
            throw e
          }
        }
        typeof progressCb === 'function' && progressCb(migration, counter, totalMigrations) // Reports on migration process
        log(`Reverting to version ${migration.version} finished`)
      }
    }

    if (!isDryRun) await repoVersion.setVersion(path, toVersion)
    log(`All migrations successfully reverted to version ${toVersion}!`)
  } finally {
    if (!isDryRun) await lock.close()
  }
}

exports.revert = revert

/**
 * Function checks if all migrations in given range supports reversion.
 *
 * @param {int} fromVersion
 * @param {int} toVersion
 * @returns {object}
 */
function verifyReversibility (fromVersion, toVersion) {
  const reversedMigrationArray = migrations.reverse()
  for (let migration of reversedMigrationArray) {
    if (migration.version <= toVersion) {
      break
    }

    if (migration.version <= fromVersion && !migration.reversible) {
      return { reversible: false, version: migration.version }
    }
  }

  return { reversible: true, version: undefined }
}
