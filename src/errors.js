'use strict'

/**
 * Exception raised when trying to revert migration that is not possible
 * to revert.
 */
class NonReversibleMigration extends Error {
  constructor (message) {
    super(message)
    this.name = 'NonReversibleMigration'
    this.message = message
  }
}
exports.NonReversibleMigration = NonReversibleMigration

/**
 * Exception raised when structure of a repo is not as expected.
 */
class UnknownRepoStructure extends Error {
  constructor (message) {
    super(message)
    this.name = 'UnknownRepoStructure'
    this.message = message
  }
}
exports.UnknownRepoStructure = UnknownRepoStructure

/**
 * Exception raised when repo is not initialized.
 */
class NotInitializedRepo extends Error {
  constructor (message) {
    super(message)
    this.name = 'NotInitializedRepo'
    this.message = message
  }
}
exports.NotInitializedRepo = NotInitializedRepo
