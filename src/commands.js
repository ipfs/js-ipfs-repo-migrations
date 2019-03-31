'use strict'

const os = require('os')
const path = require('path')
const process = require('process')

const chalk = require('chalk')

const repoVersion = require('./repo/version')
const migrator = require('./index')

function asyncClosure(fnc) {
  return function asyncWrapper({resolve, ...options}) {
    resolve(fnc(options))
  }
}

function reportingClosure(action){
  return (migration, currentlyMigrated, totalToMigrate) =>
    process.stdout.write(`${chalk.green(`[${currentlyMigrated}/${totalToMigrate}]`)} Successfully ${action} ${chalk.bold(migration.version)}: ${migration.description}\n`)
}

async function migrate({repoPath, ver, dry}) {
  repoPath = repoPath || process.env.IPFS_PATH || path.join(os.homedir(), '.jsipfs')
  await migrator.migrate(repoPath, ver, reportingClosure(dry ? 'loaded migration' : 'migrated to version'), dry)
}

async function revert({repoPath, ver, dry}) {
  repoPath = repoPath || process.env.IPFS_PATH || path.join(os.homedir(), '.jsipfs')
  await migrator.revert(repoPath, ver, reportingClosure(dry ? 'loaded migration' : 'reverted to version'), dry)
}

async function status({repoPath}) {
  repoPath = repoPath || process.env.IPFS_PATH || path.join(os.homedir(), '.jsipfs')

  const version = await repoVersion.getVersion(repoPath)
  const lastMigrationVersion = migrator.getLatestMigrationVersion()
  const statusString =
    version < lastMigrationVersion ? chalk.yellow('There are migrations to be applied!') : chalk.green('Nothing to migrate!')

  return `${statusString}\nCurrent repo version: ${version}\nLast migration's version: ${lastMigrationVersion}`
}

module.exports = {
  migrate: {
    command: 'migrate',
    describe: 'Migrate IPFS repo to latest or specific version',
    handler: asyncClosure(migrate),
    builder: yargv => yargv
      .option('ver', {
        describe: 'Specify to which version should be repo migrated to',
        type: 'number'
      })
      .option('dry', {
        describe: 'Only displays what migrations will be reverted',
        type: 'boolean'
      })
  },
  revert: {
    command: 'revert <ver>',
    describe: 'Revert IPFS repo to specific version',
    handler: asyncClosure(revert),
    builder: yargv => yargv
      .option('dry', {
        describe: 'Only displays what migrations will be applied',
        type: 'boolean'
      })
      .positional('ver', {
        describe: 'version to revert to (inclusive)',
        type: 'number'
      }),
  },
  status: {
    command: 'status',
    describe: 'Display status of IPFS repo',
    handler: asyncClosure(status),
  }
}
