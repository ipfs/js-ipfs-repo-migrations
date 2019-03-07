'use strict'

const migrations = require('../migrations')
const debug = require('debug')

const log = debug('migrator')
const exports = module.exports

exports.getLatestVersion = getLatestVersion

function getLatestVersion () {
  return migrations[migrations.length - 1].version
}

exports.migrate = migrate

async function migrate (repo, toVersion) {
  await bootstrapRepo(repo)

  const currentVersion = await repo.version.get()

  if ((toVersion !== undefined && currentVersion === toVersion) ||
    currentVersion === getLatestVersion()) {
    log('Nothing to migrate, skipping migrations.')
    return
  }

  for (let migration of migrations) {
    if (toVersion !== undefined && migration.version > toVersion) {
      break
    }

    if (migration.version > currentVersion) {
      log(`Migrating version ${migration.version}`)
      await migration.migrate(repo)
      log(`Migrating to version ${migration.version} finished`)
    }
  }

  await repo.version.set(toVersion || getLatestVersion())
  log('All migrations successfully migrated ', (`to version ${toVersion}!` ? toVersion !== undefined : 'to latest version!'))

  await repo.close()
}

exports.revert = revert

async function revert (repo, toVersion) {
  await bootstrapRepo(repo)

  const currentVersion = await repo.version.get()

  if (toVersion === undefined) {
    throw new Error('When reverting migrations, you have to specify to which version to revert!')
  }

  if (currentVersion === toVersion) {
    log('Nothing to revert, skipping reverting.')
    return
  }

  for (let migration of migrations.revert()) {
    if (migration.version <= toVersion) {
      break
    }

    if (migration.version <= currentVersion) {
      log(`Reverting migration version ${migration.version}`)
      try {
        await migration.revert(repo)
      } catch (e) {
        if (e.name === 'NonReversibleMigration') {
          log(`Migration version ${migration.version} is not possible to revert! Aborting...`)
          return
        }

        throw e
      }
      log(`Reverting to version ${migration.version} finished`)
    }
  }

  await repo.version.set(toVersion)
  log(`All migrations successfully reverted to version ${toVersion}!`)

  await repo.close()
}

async function bootstrapRepo (repo) {
  if (!(await repo.exists())) {
    throw new Error('Repo does not exists!')
  }

  // Will fail with error, if the repo is locked or not initialized.
  // There is not much to do about those errors, so letting them propagate...
  await repo.open()
}
