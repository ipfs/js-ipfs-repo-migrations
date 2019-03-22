const os = require('os')
const path = require('path')
const process = require('process')

const IPFSRepo = require('ipfs-repo')
const chalk = require('chalk')
const log = require('debug')('js-ipfs-repo-migrations:commands')

const migrator = require('./index')

function getRepo(dir) {
  const repoPath = dir || process.env.IPFS_PATH || path.join(os.homedir(), '.jsipfs')

  return new IPFSRepo(repoPath)
}

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
  const repo = getRepo(repoPath)
  await migrator.migrate(repo, ver, reportingClosure(dry ? 'loaded migration' : 'migrated to version'), dry)
}

async function revert({repoPath, ver, dry}) {
  const repo = getRepo(repoPath)
  await migrator.revert(repo, ver, reportingClosure(dry ? 'loaded migration' : 'reverted to version'), dry)
}

async function status({repoPath}) {
  const repo = getRepo(repoPath)

  const repoExists = await repo.exists()
  log(`Repo exists: ${repoExists}`)
  if (!repoExists) {
    throw new Error(`Repo on path \'${repo.path}\' does not exists!`)
  }

  // Will fail with error, if the repo is locked or not initialized.
  // There is not much to do about those errors, so letting them propagate...
  await repo.open()

  const repoVersion = await repo.version.get()
  const lastMigrationVersion = migrator.getLatestVersion()
  const statusString =
    repoVersion < lastMigrationVersion ? chalk.yellow('There are migrations to be applied!') : chalk.green('Nothing to migrate!')

  return `${statusString}\nCurrent repo version: ${repoVersion}\nLast migration's version: ${lastMigrationVersion}`
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
