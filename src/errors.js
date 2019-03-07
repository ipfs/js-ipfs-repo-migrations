exports = module.exports

exports.NonReversibleMigration = NonReversibleMigration
class NonReversibleMigration extends Error {
    constructor(message) {
        super(message)
        this.name = 'NonReversibleMigration'
        this.message = message
    }
}