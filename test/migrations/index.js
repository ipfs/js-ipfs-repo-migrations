'use strict'

module.exports = (createRepo, repoCleanup, repoOptions) => {
  require('./migration-8-test')(createRepo, repoCleanup, repoOptions)
  require('./migration-9-test')(createRepo, repoCleanup, repoOptions)
  require('./migration-10-test')(createRepo, repoCleanup, repoOptions)
}
