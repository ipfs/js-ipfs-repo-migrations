/* eslint-env mocha */
'use strict'

const rimraf = require('rimraf')
const promisify = require('util').promisify
const asyncRimraf = promisify(rimraf)
const path = require('path')
const fs = require('fs')

async function repoSetup () {
  const testRepoPath = path.join(__dirname, 'test-repo')
  const date = Date.now().toString()
  const dir = testRepoPath + '-for-' + date
  fs.mkdirSync(dir)

  return dir
}

async function repoCleanup (dir) {
  return asyncRimraf(dir)
}

describe('Node specific tests', () => {
  describe('lock.js tests', () => {
    describe('fs-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock'), repoSetup, repoCleanup)
    })

    describe('mem-lock tests', () => {
      require('./lock-test')(require('../src/repo/lock-memory'), repoSetup, repoCleanup)
    })
  })

  describe('version tests', () => {
    require('./version-test')(repoSetup, repoCleanup)
  })

  describe('init tests', () => {
    require('./init-test')(repoSetup, repoCleanup)
  })
})
