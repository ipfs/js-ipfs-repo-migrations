'use strict'

const multibase = require('multibase')
const { Key } = require('interface-datastore')
const multihashes = require('multihashing-async').multihash

const PIN_DS_KEY = new Key('/local/pins')
const DEFAULT_FANOUT = 256
const MAX_ITEMS = 8192
const EMPTY_KEY = multihashes.fromB58String('QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n')

const PinTypes = {
  direct: 'direct',
  recursive: 'recursive'
}

/**
 * @param {import('cids')} cid
 */
function cidToKey (cid) {
  return new Key(`/${multibase.encoding('base32upper').encode(cid.multihash)}`)
}

module.exports = {
  PIN_DS_KEY,
  DEFAULT_FANOUT,
  MAX_ITEMS,
  EMPTY_KEY,
  PinTypes,
  cidToKey
}
