'use strict'

module.exports = (setup, cleanup) => {
  require('./migration-8-test')(setup, cleanup)
  require('./migration-9-test')(setup, cleanup)
  require('./migration-10-test')(setup, cleanup)
}
