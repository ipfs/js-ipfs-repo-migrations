'use strict'

const errors = require('./errors')

module.exports = MigrationInterface
class MigrationInterface {

    version = null

    static async migrate(repo) {
        throw new Error('migrate method has to be overridden!')
    }

    static async revert(repo) {
        throw new errors.NonReversibleMigration('Migration is not possible to revert!')
    }
}
