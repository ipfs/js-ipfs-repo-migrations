'use strict'

const os = require('os')
const path = require('path')
const fs = require('fs')
const process = require('process')
const util = require('util')

const writeFile = util.promisify(fs.writeFile)
const mkdir = util.promisify(fs.mkdir)
const exec = util.promisify(require('child_process').exec)

const chalk = require('chalk')

const repoVersion = require('./repo/version')
const migrator = require('./index')
const templates = require('./migration-templates')
const migrations = require('../migrations')

function asyncClosure (fnc) {
  return function asyncWrapper ({ resolve, ...options }) {
    resolve(fnc(options))
  }
}

function reportingClosure (action) {
  return (migration, currentlyMigrated, totalToMigrate) =>
    process.stdout.write(`${chalk.green(`[${currentlyMigrated}/${totalToMigrate}]`)} Successfully ${action} ${chalk.bold(migration.version)}: ${migration.description}\n`)
}

async function migrate ({ repoPath, ver, dry }) {
  repoPath = repoPath || process.env.IPFS_PATH || path.join(os.homedir(), '.jsipfs')
  await migrator.migrate(repoPath, ver, false, reportingClosure(dry ? 'loaded migration' : 'migrated to version'), dry)
}

async function revert ({ repoPath, ver, dry }) {
  repoPath = repoPath || process.env.IPFS_PATH || path.join(os.homedir(), '.jsipfs')
  await migrator.revert(repoPath, ver, false, reportingClosure(dry ? 'loaded migration' : 'reverted version'), dry)
}

async function status ({ repoPath }) {
  repoPath = repoPath || process.env.IPFS_PATH || path.join(os.homedir(), '.jsipfs')

  const version = await repoVersion.getVersion(repoPath)
  const lastMigrationVersion = migrator.getLatestMigrationVersion()
  const statusString =
    version < lastMigrationVersion ? chalk.yellow('There are migrations to be applied!') : chalk.green('Nothing to migrate!')

  return `${statusString}\nCurrent repo version: ${version}\nLast migration's version: ${lastMigrationVersion}`
}

async function getAuthor () {
  try {
    const name = (await exec('git config --get user.name')).stdout
    const email = (await exec('git config --get user.email')).stdout
    return `${name.replace('\n', '')} <${email.replace('\n', '')}>`
  } catch (e) {
    return ''
  }
}

async function add ({ repoPath, empty }) {
  const newMigrationVersion = migrator.getLatestMigrationVersion() + 1
  const newMigrationFolder = path.join(__dirname, '..', 'migrations', 'migration-' + newMigrationVersion)

  const migrationsImport = migrations.map((migration) => migration.empty ? `  Object.assign({version: ${migration.version}}, emptyMigration),` : `  require('./migration-${migration.version}'),`)
  if (empty) {
    migrationsImport.push(`  Object.assign({version: ${newMigrationVersion}}, emptyMigration),`)
  } else {
    migrationsImport.push(`  require('./migration-${newMigrationVersion}'),`)
  }
  const migrationsIndexJsContent = templates.migrationsIndexJs
    .replace('{{imports}}', migrationsImport.join('\n'))
  await writeFile(path.join(newMigrationFolder, '..', 'index.js'), migrationsIndexJsContent)

  if (empty) return

  await mkdir(newMigrationFolder)

  const packageJsonContent = templates.packageJson
    .replace(/{{version}}/gi, newMigrationVersion)
    .replace(/{{author}}/gi, await getAuthor())
  await writeFile(path.join(newMigrationFolder, 'package.json'), packageJsonContent)

  const indexJsContent = templates.indexJs
    .replace(/{{version}}/gi, newMigrationVersion)
  await writeFile(path.join(newMigrationFolder, 'index.js'), indexJsContent)
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
      })
  },
  status: {
    command: 'status',
    describe: 'Display status of IPFS repo',
    handler: asyncClosure(status)
  },
  add: {
    command: 'add',
    describe: 'Bootstrap new migration',
    handler: asyncClosure(add),
    builder: yargv => yargv
      .option('empty', {
        describe: 'Creates empty migration',
        type: 'boolean'
      })
  }
}
