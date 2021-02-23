'use strict'

const path = require('path')

const esbuild = {
  // this will inject all the named exports from 'node-globals.js' as globals
  inject: [path.join(__dirname, 'scripts/node-globals.js')],
  plugins: [
    {
      name: 'node built ins', // this will make the bundler resolve node builtins to the respective browser polyfill
      setup (build) {
        build.onResolve({ filter: /^stream$/ }, () => {
          return { path: require.resolve('readable-stream') }
        })
        build.onResolve({ filter: /^assert$/ }, () => {
          return { path: require.resolve('assert') }
        })
        build.onResolve({ filter: /^util$/ }, () => {
          return { path: require.resolve('util') }
        })
        build.onResolve({ filter: /^events$/ }, () => {
          return { path: require.resolve('events') }
        })
      }
    }
  ]
}

module.exports = {
  test: {
    browser: esbuild
  },
  build: {
    config: esbuild
  }
}
