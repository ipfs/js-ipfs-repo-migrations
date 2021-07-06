/* eslint-env mocha */
/* eslint-disable max-nested-callbacks */
'use strict'

const { expect } = require('aegir/utils/chai')
const cbor = require('cborg')
const migration = require('../../migrations/migration-9')
const { PIN_DS_KEY } = require('../../migrations/migration-9/utils')
const { CID } = require('multiformats/cid')
const { CarReader } = require('@ipld/car')
const loadFixture = require('aegir/utils/fixtures')
const dagPb = require('@ipld/dag-pb')
const mhd = require('multiformats/hashes/digest')
const { base32 } = require('multiformats/bases/base32')

function pinToCid (key, pin) {
  return CID.create(
    pin.version || 0,
    pin.codec || dagPb.code,
    mhd.decode(base32.decode('b' + key.toString().toLowerCase().split('/').pop()))
  )
}

// the test data is generated by the file /test/fixtures/generate-car-files.js
// nb. you need to `npm install ipfs@0.48.1` or below in a place it can `require`
// it from before running it
const pinsets = {
  'basic pinset': {
    car: loadFixture('test/fixtures/pinset-basic.car'),
    root: CID.parse('QmeKxgcTtiE1XfvwcVf8wc65GgMmZumEtXK6YJKuvf3VYx'),
    pins: 31
  },
  'multiple bucket pinset': {
    car: loadFixture('test/fixtures/pinset-multiple-buckets.car'),
    root: CID.parse('QmPGd36dodHj1LQtVWK3LcBVkkVWvfXHEwBHnMpN6tu4BD'),

    // we need at least 8192 pins in order to create a new bucket
    pins: 9031
  }
}

const directPins = [
  'QmTgj3HVGSuCckhJURLbaBuhPgArb36MEkRhvh5A7WkiFR',
  'QmaLHnphKK4dBk9TuRe5uQMLztQgJ7VbAeaMR8LErHGkcH',
  'QmRnkQuzXiZSQ5DtXfkSsMtL6PyKTK1HBqUxcD8zmgQLQi',
  'QmfDfLw7rrzedHn7XUc7q5UNPyekREE1hFZrwDWfCNBqg8',
  'QmdSzyeG1wALG5vaDP75f8QqcZWRcU4EDtkeY9LnB38eP2',
  'QmR2iwMMYNcCJNcC73ku37QD3oeeV98jUdT2c2xTsaMYvR',
  'QmQMQrVxtNN5JsWVDWtpFyUkjbm8sNbSjy364pGQdfgSx2',
  'QmNgWoYcmsqs6uUhFysC7BjfKTbYXWnL3edpLQJSsWdRqF',
  'QmUjoRPzozKhjJyxkJaP1rgnp6Lvp43fCA247kyCZsGrhN',
  'QmciA8jujqBJmCsnUgp9uXwW4HEzhg7vH4oPKBeiJu5cXC'
]

const nonDagPbRecursivePins = [
  'bafyreigv7udtoqiouyeelfijgfix42yc44zsqncbmar6jadq7xfs4mgg4e',
  'bafyreif4nfemzpljifoquq5dqjgmddhiv53b66zbr7ul3goeahyhphxyhq',
  'bafyreif2d33ncuaeeb37jnjylbgrgot3acpy5g33rs5rqvbxxmcnei6tua',
  'bafyreig2zauiy4t5ltjwoaf6tjbdnanah4q6qz5ilol3g2bwfrblpcv2bm',
  'bafyreiglffsxrbgxrnlx7wu2n5rsdtd73ih7zf65pormaarrqr26uhczxa',
  'bafyreiboyxf575xniqegisc2okkerinv4gehmlmjrybcfsc4fbnkhn77te',
  'bafyreif7z4hkico2i4kv3q36ix2qb5g4y62q2filnlmqrkzzbkwt3ewtya',
  'bafyreiczsrn43dxizcmwav2gkjbrvngmqcmdywq7nwyb7a3vn5hssudhr4',
  'bafyreiguc2wwt77l63uan4opi6bo6b4uuizbmfhbx3izb5ca7qp2rtp2xi',
  'bafyreihkjb36nob7cezu3m5psjqo46cturnut4fi6x3fj7md4eiefsinsy'
]

const nonDagPbDirectPins = [
  'bafyreibuvrik6o3lyantziriciygeb6jbwocvd7kwtozrjo37n6dki5aom',
  'bafyreicn35rsdstjo2574mtympyup2a6rh7tb5pip3seg6s6j6epe7jduu',
  'bafyreiang6jqksnq7ka3vajo3jvxo624nzt2wskn422sdrjl2cbald4ckq',
  'bafyreie3f7gzq4dvdqitq75bxtkocjpfcny5dta3dzg4gi76q6ql3blfrq',
  'bafyreic54zlg7mq5tojnpj73qc5acjyyzz2kxksmtceavb6q4fryeksp6i',
  'bafyreih3zs3htz6qun62ogeqdlf2iyyw3zkfngelfjgrft3bjeeqegxwiq',
  'bafyreigebeyuxa37qu7p2bxpjn7wlf4itkgwfjiqzetraihvhobs6z4fw4',
  'bafyreigpw4hiw2uggape2nkd7dts3x7lpkpczmmfojtzofmodjkjfcikxq',
  'bafyreifumpjckmmnsiqmpfg4vsxgihjb3pwtygdjqiu6ztabswguko52xm',
  'bafyreiamyrx7wjuxyewnjsu6vfj2u4jzqz2tclukgzwuinic6zbukazgci'
]

async function bootstrapBlocks (blockstore, datastore, { car: carBuf, root: expectedRoot }) {
  const car = await CarReader.fromBytes(carBuf)
  const [actualRoot] = await car.getRoots()

  expect(actualRoot.toString()).to.equal(expectedRoot.toString())
  await blockstore.open()

  const batch = blockstore.batch()

  for await (const { cid, bytes } of car.blocks()) {
    // if we don't create a new Uint8Array, IDB writes the whole backing buffer into the db
    batch.put(CID.parse(cid.toString()), new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  }

  await batch.commit()

  await blockstore.close()

  await datastore.open()
  await datastore.put(PIN_DS_KEY, actualRoot.multihash.bytes)
  await datastore.close()
}

async function assertPinsetRootIsPresent (datastore, pinset) {
  await datastore.open()
  const buf = await datastore.get(PIN_DS_KEY)
  await datastore.close()
  const cid = CID.decode(buf)
  expect(cid.toString()).to.equal(pinset.root.toString())
}

module.exports = (setup, cleanup) => {
  describe('migration 9', function () {
    this.timeout(1000 * 1000)

    let dir
    let backends

    beforeEach(async () => {
      ({ dir, backends } = await setup())
    })

    afterEach(async () => {
      await cleanup(dir)
    })

    describe('empty repo', () => {
      describe('forwards', () => {
        it('should migrate pins forward', async () => {
          await migration.migrate(backends, () => {})
        })
      })

      describe('backwards', () => {
        it('should migrate pins backward', async () => {
          await migration.revert(backends, () => {})
        })
      })
    })

    Object.keys(pinsets).forEach(title => {
      const pinset = pinsets[title]
      const pinned = {}

      describe(title, () => {
        describe('forwards', () => {
          beforeEach(async () => {
            await bootstrapBlocks(backends.blocks, backends.datastore, pinset)
            await assertPinsetRootIsPresent(backends.datastore, pinset)
          })

          it('should migrate pins forward', async () => {
            await migration.migrate(backends, () => {})

            await backends.pins.open()
            let migratedDirect = 0
            let migratedNonDagPBRecursive = 0

            for await (const { key, value } of backends.pins.query({})) {
              pinned[key] = value

              const pin = cbor.decode(value)

              const cid = pinToCid(key, pin)

              if (directPins.includes(`${cid}`) || nonDagPbDirectPins.includes(`${cid}`)) {
                expect(pin.depth).to.equal(0)
                migratedDirect++
              } else {
                expect(pin.depth).to.equal(Infinity)
              }

              if (nonDagPbRecursivePins.includes(`${cid}`)) {
                migratedNonDagPBRecursive++
              }
            }

            await backends.pins.close()

            expect(migratedDirect).to.equal(directPins.length + nonDagPbDirectPins.length)
            expect(migratedNonDagPBRecursive).to.equal(nonDagPbRecursivePins.length)
            expect(Object.keys(pinned)).to.have.lengthOf(pinset.pins)

            await backends.datastore.open()
            await expect(backends.datastore.has(PIN_DS_KEY)).to.eventually.be.false()
            await backends.datastore.close()
          })
        })

        describe('backwards', () => {
          beforeEach(async () => {
            await backends.pins.open()

            for (const key of Object.keys(pinned)) {
              await backends.pins.put(key, pinned[key])
            }

            await backends.pins.close()
          })

          it('should migrate pins backward', async () => {
            await migration.revert(backends, () => {})

            await assertPinsetRootIsPresent(backends.datastore, pinset)
          })
        })
      })
    })
  })
}
