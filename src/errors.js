'use strict'

exports = module.exports

class NonReversibleMigration extends Error {
  constructor (message) {
    super(message)
    this.name = 'NonReversibleMigration'
    this.message = message
  }
}

exports.NonReversibleMigration = NonReversibleMigration

class UnknownRepoStructure extends Error {
  constructor (message) {
    super(message)
    this.name = 'UnknownRepoStructure'
    this.message = message
  }
}

exports.UnknownRepoStructure = UnknownRepoStructure
