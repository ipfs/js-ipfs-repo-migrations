'use strict'

const keysEncoding = require('./keys-encoding')
const blocksToMultihash = require('./blocks-to-multihash')
const log = require('debug')('ipfs-repo-migrations:migration-8')

async function migrate (repoPath, options) {
  await keysEncoding.migrate(repoPath, options)

  try{
    await blocksToMultihash.migrate(repoPath, options)
  }catch (e) {
    log('During migration of Blockstore to multihash exception was raised! Reverting keys part of migration!')
    await keysEncoding.revert(repoPath, options)

    throw e
  }
}

async function revert (repoPath, options) {
  await keysEncoding.revert(repoPath, options)

  try{
    await blocksToMultihash.revert(repoPath, options)
  }catch (e) {
    log('During reversion of Blockstore to CID exception was raised! Migrating keys part of migration!')
    await keysEncoding.migrate(repoPath, options)

    throw e
  }
}

module.exports = {
  version: 8,
  description: 'Transforms key\'s names into base32 encoding and converts Block store to use multihashes',
  migrate,
  revert
}
