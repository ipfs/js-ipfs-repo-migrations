'use strict'

module.exports = {
  webpack: {
    node: {
      // this is needed until level stops using node buffers in browser code
      Buffer: true,

      // needed by cbor, binary-parse-stream and nofilter
      stream: true
    }
  }
}
