'use strict'

const errors = require('./errors')

class MigrationInterface {
  static async migrate (repo) {
    throw new Error('migrate method has to be overridden!')
  }

  static async revert (repo) {
    throw new errors.NonReversibleMigration('Migration is not possible to revert!')
  }

  static get version () {
    return null
  }
}

module.exports = MigrationInterface
