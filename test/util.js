'use strict'
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
chai.use(require('chai-as-promised'))
chai.use(require('dirty-chai'))

module.exports = {
  expect,
  sinon
}
