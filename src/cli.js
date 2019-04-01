#! /usr/bin/env node

'use strict'

const YargsPromise = require('yargs-promise')
const yargs = require('yargs')
const process = require('process')
const log = require('debug')('js-ipfs-repo-migrations:cli')

const commands = require('./commands')


function print(msg, newline) {
  if (newline === undefined) {
    newline = true
  }

  if (msg === undefined) {
    msg = ''
  }
  msg = newline ? msg + '\n' : msg
  process.stdout.write(msg)
}

async function main(args) {
  const cli = yargs()
    .option('repo-path', {
      desc: 'Path to the IPFS repo',
      type: 'string',
    })
    .command(commands.migrate)
    .command(commands.revert)
    .command(commands.status)
    .command(commands.add)
    .demandCommand(1, 'You need at least one command before continuing')
    .strict()
    .fail((msg, err, yargs) => {
      if (err) {
        throw err // preserve stack
      }

      if (args.length > 0) {
        print(msg)
      }

      yargs.showHelp()
    })

  let exitCode = 0

  try {
    const {data} = await new YargsPromise(cli).parse(args)
    if (data) print(data)
  } catch (err) {
    log(err)

    // the argument can have a different shape depending on where the error came from
    if (err.message || (err.error && err.error.message)) {
      print(err.message || err.error.message)
    } else {
      print('Unknown error, please re-run the command with DEBUG=js-ipfs-repo-migrations:cli to see debug output')
    }

    exitCode = 1
  }

  if (exitCode) {
    process.exit(exitCode)
  }
}

main(process.argv.slice(2))
