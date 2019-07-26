'use strict'

module.exports = {
  indexJs: `'use strict'

const Datastore = require('datastore-fs')
const log = require('debug')('jsipfs-repo-migrations:migration-{{version}}')

async function migrate(repoPath, options, isBrowser) {
  const store = new Datastore(repoPath, {extension: '', createIfMissing: false})
  store.open()

  try {
    // Your migration
  } finally {
    await store.close()
  }
}

async function revert(repoPath, options, isBrowser) {
  const store = new Datastore(repoPath, {extension: '', createIfMissing: false})
  store.open()

  try {
    // Your reversion of migration (if supported, if not delete this function!!!)
  } finally {
    await store.close()
  }
}

module.exports = {
  version: {{version}},
  description: '', // <--- Fill in your description here
  migrate,
  revert,
}`,

  migrationsIndexJs: `'use strict'

// Do not modify this file manually as it will be overridden when running 'add' CLI command.
// Modify migration-templates.js file

const emptyMigration = {
  description: 'Empty migration.',
  migrate: () => {},
  revert: () => {},
  empty: true,
}

module.exports = [
{{imports}}
]
`
}
