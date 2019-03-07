'use strict'

const exports = module.exports

class NonReversibleMigration extends Error {
  constructor (message) {
    super(message)
    this.name = 'NonReversibleMigration'
    this.message = message
  }
}

exports.NonReversibleMigration = NonReversibleMigration
