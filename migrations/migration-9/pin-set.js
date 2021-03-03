'use strict'

const CID = require('cids')
const {
  ipfs: {
    pin: {
      Set: PinSet
    }
  }
} = require('./pin')

// @ts-ignore
const fnv1a = require('fnv1a')
const varint = require('varint')
const dagpb = require('ipld-dag-pb')
const DAGNode = require('ipld-dag-pb/src/dag-node/dagNode')
const DAGLink = require('ipld-dag-pb/src/dag-link/dagLink')
const multihash = require('multihashing-async').multihash
const { cidToKey, DEFAULT_FANOUT, MAX_ITEMS, EMPTY_KEY } = require('./utils')
const uint8ArrayConcat = require('uint8arrays/concat')
const uint8ArrayCompare = require('uint8arrays/compare')
const uint8ArrayToString = require('uint8arrays/to-string')
const uint8ArrayFromString = require('uint8arrays/from-string')
const uint8ArrayEquals = require('uint8arrays/equals')

/**
 * @typedef {import('interface-datastore').Datastore} Datastore
 *
 * @typedef {object} Pin
 * @property {CID} key
 * @property {Uint8Array} [data]
 */

/**
 * @param {Uint8Array | CID} hash
 */
function toB58String (hash) {
  return new CID(hash).toBaseEncodedString()
}

/**
 * @param {DAGNode} rootNode
 */
function readHeader (rootNode) {
  // rootNode.data should be a buffer of the format:
  // < varint(headerLength) | header | itemData... >
  const rootData = rootNode.Data
  const hdrLength = varint.decode(rootData)
  const vBytes = varint.decode.bytes

  if (vBytes <= 0) {
    throw new Error('Invalid Set header length')
  }

  if (vBytes + hdrLength > rootData.length) {
    throw new Error('Impossibly large set header length')
  }

  const hdrSlice = rootData.slice(vBytes, hdrLength + vBytes)
  const header = PinSet.toObject(PinSet.decode(hdrSlice), {
    defaults: false,
    arrays: true,
    longs: Number,
    objects: false
  })

  if (header.version !== 1) {
    throw new Error(`Unsupported Set version: ${header.version}`)
  }

  if (header.fanout > rootNode.Links.length) {
    throw new Error('Impossibly large fanout')
  }

  return {
    header: header,
    data: rootData.slice(hdrLength + vBytes)
  }
}

/**
 * @param {number} seed
 * @param {CID} key
 */
function hash (seed, key) {
  const buffer = new Uint8Array(4)
  const dataView = new DataView(buffer.buffer)
  dataView.setUint32(0, seed, true)
  const encodedKey = uint8ArrayFromString(toB58String(key))
  const data = uint8ArrayConcat([buffer, encodedKey], buffer.byteLength + encodedKey.byteLength)

  return fnv1a(uint8ArrayToString(data))
}

/**
 * @param {Datastore} blockstore
 * @param {DAGNode} node
 * @returns {AsyncGenerator<CID, void, undefined>}
 */
async function * walkItems (blockstore, node) {
  const pbh = readHeader(node)
  let idx = 0

  for (const link of node.Links) {
    if (idx < pbh.header.fanout) {
      // the first pbh.header.fanout links are fanout bins
      // if a fanout bin is not 'empty', dig into and walk its DAGLinks
      const linkHash = link.Hash

      if (!uint8ArrayEquals(EMPTY_KEY, linkHash.bytes)) {
        // walk the links of this fanout bin
        const buf = await blockstore.get(cidToKey(linkHash))
        const node = dagpb.util.deserialize(buf)

        yield * walkItems(blockstore, node)
      }
    } else {
      // otherwise, the link is a pin
      yield link.Hash
    }

    idx++
  }
}

/**
 * @param {Datastore} blockstore
 * @param {DAGNode} rootNode
 * @param {string} name
 */
async function * loadSet (blockstore, rootNode, name) {
  const link = rootNode.Links.find(l => l.Name === name)

  if (!link) {
    throw new Error('No link found with name ' + name)
  }

  const buf = await blockstore.get(cidToKey(link.Hash))
  const node = dagpb.util.deserialize(buf)

  yield * walkItems(blockstore, node)
}

/**
 * @param {Datastore} blockstore
 * @param {Pin[]} items
 */
function storeItems (blockstore, items) {
  return storePins(items, 0)

  /**
   * @param {Pin[]} pins
   * @param {number} depth
   */
  async function storePins (pins, depth) {
    const pbHeader = PinSet.encode({
      version: 1,
      fanout: DEFAULT_FANOUT,
      seed: depth
    }).finish()

    const header = varint.encode(pbHeader.length)
    const headerBuf = uint8ArrayConcat([header, pbHeader])
    const fanoutLinks = []

    for (let i = 0; i < DEFAULT_FANOUT; i++) {
      fanoutLinks.push(new DAGLink('', 1, EMPTY_KEY))
    }

    if (pins.length <= MAX_ITEMS) {
      const nodes = pins
        .map(item => {
          return ({
            link: new DAGLink('', 1, item.key),
            data: item.data || new Uint8Array()
          })
        })
        // sorting makes any ordering of `pins` produce the same DAGNode
        .sort((a, b) => {
          return uint8ArrayCompare(a.link.Hash.bytes, b.link.Hash.bytes)
        })

      const rootLinks = fanoutLinks.concat(nodes.map(item => item.link))
      const rootData = uint8ArrayConcat([headerBuf, ...nodes.map(item => item.data)])

      return new DAGNode(rootData, rootLinks)
    } else {
      // If the array of pins is > MAX_ITEMS, we:
      //  - distribute the pins among `DEFAULT_FANOUT` bins
      //    - create a DAGNode for each bin
      //      - add each pin as a DAGLink to that bin
      //  - create a root DAGNode
      //    - add each bin as a DAGLink
      //  - send that root DAGNode via callback
      // (using go-ipfs' "wasteful but simple" approach for consistency)
      // https://github.com/ipfs/go-ipfs/blob/master/pin/set.go#L57

      /** @type {Pin[][]} */
      const bins = pins.reduce((bins, pin) => {
        const n = hash(depth, pin.key) % DEFAULT_FANOUT
        // @ts-ignore
        bins[n] = n in bins ? bins[n].concat([pin]) : [pin]
        return bins
      }, [])

      let idx = 0
      for (const bin of bins) {
        const child = await storePins(bin, depth + 1)

        await storeChild(child, idx)

        idx++
      }

      return new DAGNode(headerBuf, fanoutLinks)
    }

    /**
     * @param {DAGNode} child
     * @param {number} binIdx
     */
    async function storeChild (child, binIdx) {
      const buf = dagpb.util.serialize(child)
      const cid = await dagpb.util.cid(buf, {
        cidVersion: 0,
        hashAlg: multihash.names['sha2-256']
      })
      await blockstore.put(cidToKey(cid), buf)

      fanoutLinks[binIdx] = new DAGLink('', child.size, cid)
    }
  }
}

/**
 * @param {Datastore} blockstore
 * @param {string} type
 * @param {CID[]} cids
 */
async function storeSet (blockstore, type, cids) {
  const rootNode = await storeItems(blockstore, cids.map(cid => {
    return {
      key: cid
    }
  }))
  const buf = rootNode.serialize()
  const cid = await dagpb.util.cid(buf, {
    cidVersion: 0,
    hashAlg: multihash.names['sha2-256']
  })

  await blockstore.put(cidToKey(cid), buf)

  return new DAGLink(type, rootNode.size, cid)
}

module.exports = {
  loadSet,
  storeSet
}
