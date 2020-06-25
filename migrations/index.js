'use strict'

// Do not modify this file manually as it will be overridden when running 'add' CLI command.
// Modify migration-templates.js file

const emptyMigration = {
  description: 'Empty migration.',
  migrate: () => {},
  revert: () => {},
  empty: true
}

module.exports = [
  Object.assign({version: 1}, emptyMigration),
  Object.assign({version: 2}, emptyMigration),
  Object.assign({version: 3}, emptyMigration),
  Object.assign({version: 4}, emptyMigration),
  Object.assign({version: 5}, emptyMigration),
  Object.assign({version: 6}, emptyMigration),
  Object.assign({version: 7}, emptyMigration),
  require('./migration-8')
]
