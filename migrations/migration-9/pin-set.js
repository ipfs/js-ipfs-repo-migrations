'use strict'

const CID = require('cids')
const protobuf = require('protons')
const fnv1a = require('fnv1a')
const varint = require('varint')
const dagpb = require('ipld-dag-pb')
const { DAGNode, DAGLink } = dagpb
const multicodec = require('multicodec')
const pbSchema = require('./pin.proto')
const { Buffer } = require('buffer')
const { cidToKey, DEFAULT_FANOUT, MAX_ITEMS, EMPTY_KEY } = require('./utils')

const pb = protobuf(pbSchema)

function toB58String (hash) {
  return new CID(hash).toBaseEncodedString()
}

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
  const header = pb.Set.decode(hdrSlice)

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

function hash (seed, key) {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(seed, 0)
  const data = Buffer.concat([
    buf, Buffer.from(toB58String(key))
  ])
  return fnv1a(data.toString('binary'))
}

async function * walkItems (blockstore, node) {
  const pbh = readHeader(node)
  let idx = 0

  for (const link of node.Links) {
    if (idx < pbh.header.fanout) {
      // the first pbh.header.fanout links are fanout bins
      // if a fanout bin is not 'empty', dig into and walk its DAGLinks
      const linkHash = link.Hash

      if (!EMPTY_KEY.equals(linkHash.buffer)) {
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

async function * loadSet (blockstore, rootNode, name) {
  const link = rootNode.Links.find(l => l.Name === name)

  if (!link) {
    throw new Error('No link found with name ' + name)
  }

  const buf = await blockstore.get(cidToKey(link.Hash))
  const node = dagpb.util.deserialize(buf)

  yield * walkItems(blockstore, node)
}

function storeItems (blockstore, items) {
  return storePins(items, 0)

  async function storePins (pins, depth) {
    const pbHeader = pb.Set.encode({
      version: 1,
      fanout: DEFAULT_FANOUT,
      seed: depth
    })
    const headerBuf = Buffer.concat([
      Buffer.from(varint.encode(pbHeader.length)), pbHeader
    ])
    const fanoutLinks = []

    for (let i = 0; i < DEFAULT_FANOUT; i++) {
      fanoutLinks.push(new DAGLink('', 1, EMPTY_KEY))
    }

    if (pins.length <= MAX_ITEMS) {
      const nodes = pins
        .map(item => {
          return ({
            link: new DAGLink('', 1, item.key),
            data: item.data || Buffer.alloc(0)
          })
        })
        // sorting makes any ordering of `pins` produce the same DAGNode
        .sort((a, b) => Buffer.compare(a.link.Hash.buffer, b.link.Hash.buffer))

      const rootLinks = fanoutLinks.concat(nodes.map(item => item.link))
      const rootData = Buffer.concat(
        [headerBuf].concat(nodes.map(item => item.data))
      )

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

      const bins = pins.reduce((bins, pin) => {
        const n = hash(depth, pin.key) % DEFAULT_FANOUT
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

    async function storeChild (child, binIdx) {
      const opts = {
        version: 0,
        format: multicodec.DAG_PB,
        hashAlg: multicodec.SHA2_256,
        preload: false
      }

      const buf = dagpb.util.serialize(child)
      const cid = dagpb.util.cid(buf, {
        cidVersion: 0,
        hashAlg: multicodec.SHA2_256,
      })
      await blockstore.put(cidToKey(cid), buf)

      fanoutLinks[binIdx] = new DAGLink('', child.size, cid)
    }
  }
}

async function storeSet (blockstore, type, cids) {
  const rootNode = await storeItems(blockstore, cids.map(cid => {
    return {
      key: cid,
      data: null
    }
  }))
  const buf = rootNode.serialize(rootNode)
  const cid = await dagpb.util.cid(buf, {
    cidVersion: 0,
    hashAlg: multicodec.SHA2_256
  })

  await blockstore.put(cidToKey(cid), buf)

  return new DAGLink(type, rootNode.size, cid)
}

module.exports = {
  loadSet,
  storeSet
}
