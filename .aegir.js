'use strict'

module.exports = {
  karma: {
    // multi-bucket pinset migrations are slow
    browserNoActivityTimeout: 240 * 1000
  },
  webpack: {
    node: {
      // this is needed until level stops using node buffers in browser code
      Buffer: true,

      // needed by cbor, binary-parse-stream and nofilter
      stream: true
    }
  }
}
