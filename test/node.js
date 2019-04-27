/* eslint-env mocha */
'use strict'

const promisify = require('util').promisify
const asyncRimraf = promisify(require('rimraf'))
const asyncNcp = promisify(require('ncp').ncp)
const path = require('path')
const fs = require('fs')

async function createRepo () {
  const testRepoPath = path.join(__dirname, 'fixtures', 'test-repo')
  const date = Date.now().toString()
  const dir = testRepoPath + '-for-' + date
  fs.mkdirSync(dir)

  return dir
}

async function createAndLoadRepo () {
  const dir = await createRepo()
  const testRepoPath = path.join(__dirname, 'fixtures', 'test-repo')

  await asyncNcp(testRepoPath, dir)
  return dir
}

async function repoCleanup (dir) {
  return asyncRimraf(dir)
}

describe('Node specific tests', () => {
  describe('lock.js tests', () => {
    describe('fs-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock'), createRepo, repoCleanup)
    })

    describe('mem-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock-memory'), createRepo, repoCleanup)
    })
  })

  describe('version tests', () => {
    require('./version-test')(createRepo, repoCleanup)
  })

  describe('migrations tests', () => {
    require('./migrations/migration-8-test')(repoSetup, repoCleanup)
  })

  describe('init tests', () => {
    require('./init-test')(createRepo, repoCleanup)
  })

  describe('integration tests', () => {
    require('./integration-test')(createAndLoadRepo, repoCleanup)
  })
})
