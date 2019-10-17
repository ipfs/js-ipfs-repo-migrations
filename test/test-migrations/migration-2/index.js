'use strict'

const Datastore = require('datastore-fs')
const path = require('path')
const Key = require('interface-datastore').Key
const _set = require('just-safe-set')

const CONFIG_KEY = new Key('config')
const NEW_API_ADDRESS = '/ip6/::/tcp/5001'

/**
 * EXAMPLE MIGRATION
 * =================
 *
 * Shows how to update config values. Migrate:
 * 1) Changes 'Addresses.API' to Array with new IPv6 localhost
 * 2) Changes 'Gateway.HTTPHeaders.Access-Control-Allow-Origin' to specific origin
 */

function datastoreFactory (repoPath, options) {
  let StorageBackend, storageBackendOptions
  if (options !== undefined &&
    options.storageBackends !== undefined &&
    options.storageBackends.root !== undefined
  ) {
    StorageBackend = options.storageBackends.root
  } else {
    StorageBackend = Datastore
  }

  if (options !== undefined &&
    options.storageBackendOptions !== undefined &&
    options.storageBackendOptions.root !== undefined
  ) {
    storageBackendOptions = options.storageBackendOptions.root
  } else {
    storageBackendOptions = { extension: '' }
  }

  return new StorageBackend(path.join(repoPath), storageBackendOptions)
}

function addNewApiAddress (config) {
  let apiAddrs = config.Addresses.API

  if (!Array.isArray(apiAddrs)) {
    apiAddrs = [apiAddrs]
  }

  if (apiAddrs.includes(NEW_API_ADDRESS)) {
    return
  }
  apiAddrs.push(NEW_API_ADDRESS)
  config.Addresses.API = apiAddrs

  return config
}

function removeNewApiAddress (config) {
  let apiAddrs = config.Addresses.API

  if (!Array.isArray(apiAddrs)) {
    return config
  }

  if (apiAddrs.length > 2) {
    throw new Error('Not possible to revert as Addresses.API has more then 2 address, not sure what to do.')
  }

  if (!apiAddrs.includes(NEW_API_ADDRESS)) {
    throw new Error('Not possible to revert as Addresses.API has unknown address, not sure what to do.')
  }

  _set(config, 'Addresses.API', apiAddrs[0] === NEW_API_ADDRESS ? apiAddrs[1] : apiAddrs[0])

  return config
}

async function migrate (repoPath, options, isBrowser) {
  const store = datastoreFactory(repoPath, options)
  try {
    const rawConfig = await store.get(CONFIG_KEY)
    let config = JSON.parse(rawConfig.toString())

    // Convert Address.API to Array with new IPv6 localhost
    config = addNewApiAddress(config)

    // Modify allowed origin
    _set(config, 'Gateway.HTTPHeaders.Access-Control-Allow-Origin', 'some.origin.com')

    const buf = Buffer.from(JSON.stringify(config, null, 2))
    await store.put(CONFIG_KEY, buf)
  } finally {
    await store.close()
  }
}

async function revert (repoPath, options, isBrowser) {
  const store = datastoreFactory(repoPath, options)

  try {
    const rawConfig = await store.get(CONFIG_KEY)
    let config = JSON.parse(rawConfig.toString())

    // If possible revert to previous value
    config = removeNewApiAddress(config)

    // Reset origin
    _set(config, 'Gateway.HTTPHeaders.Access-Control-Allow-Origin', '*')

    const buf = Buffer.from(JSON.stringify(config, null, 2))
    await store.put(CONFIG_KEY, buf)
  } finally {
    await store.close()
  }
}

module.exports = {
  version: 2,
  description: 'Updates config',
  reversible: true,
  migrate,
  revert,
  newApiAddr: NEW_API_ADDRESS
}
