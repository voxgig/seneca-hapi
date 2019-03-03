/* Copyright (c) 2018 voxgig and other contributors, MIT License */
'use strict'

const Util = require('util')

const Lab = require('lab')
const Code = require('code')
const lab = (exports.lab = Lab.script())
const expect = Code.expect

const PluginValidator = require('seneca-plugin-validator')
const Seneca = require('seneca')
const Optioner = require('optioner')
const Joi = Optioner.Joi

const Plugin = require('..')

lab.test(
  'validate',
  Util.promisify(function(x, fin) {
    PluginValidator(Plugin, module)(fin)
  })
)

lab.test('make_handler', async () => {
  const si = seneca_instance()

  si.message('a:1', async function(msg) {
    return { x: msg.x, q: msg.q }
  }).message('b:1', async function(msg, meta) {
    return { y: msg.y, z: meta.custom.z }
  })

  await si.ready()

  const make_handler = si.export('hapi/make_handler')

  const handler = make_handler(async function(seneca, req, h) {
    var xq = await seneca.post('a:1', { x: req.payload.x })
    var yz = await seneca.post('b:1', { y: req.payload.y })
    return { x: xq.x, y: yz.y, z: yz.z, q: xq.q, did: seneca.did }
  })

  await si.post('role:web-handler,hook:custom', {
    custom: 'ignored'
  })

  await si.post('role:web-handler,hook:fixed', {
    fixed: 'ignored'
  })

  await si.post('role:web-handler,hook:custom', {
    custom: function(custom) {
      custom.z = 3
    }
  })

  await si.post('role:web-handler,hook:fixed', {
    fixed: function(fixed) {
      fixed.q = 4
    }
  })

  await si.post('role:web-handler,hook:delegate', {
    delegate: function(seneca, req) {
      seneca.did += '~' + req.payload.x
    }
  })

  var out = await handler({ payload: { x: 1, y: 2 } })
  expect(out).includes({ x: 1, y: 2, z: 3, q: 4 })
  expect(out.did).endsWith('~1')
})

lab.test('action_handler', async () => {
  const si = seneca_instance()

  si.message('a:1', async function(msg) {
    return { x: msg.x, w: msg.w }
  }).message('e:1', async function(msg) {
    throw new Error('eek')
  })

  await si.ready()

  const handler = si.export('hapi/action_handler')

  var out = await handler({ payload: '{"a":1,"x":2}' })
  expect(out).includes({ x: 2 })

  await si.post('role:web-handler,hook:custom', {
    custom: function(custom) {
      custom.foo = 1
    }
  })

  await si.post('role:web-handler,hook:action', {
    action: 'ignored'
  })

  await si.post('role:web-handler,hook:action', {
    action: function(msg) {
      msg.w = 5
    }
  })

  var out = await handler({ payload: { a: 1, x: 2 } })
  expect(out).includes({ x: 2, w: 5 })
  expect(out.meta$.custom.foo).equals(1)

  si.quiet()

  // NOTE: Seneca handles seneca errors, so not a HTTP error
  out = await handler({ payload: { e: 1 } })
  expect(out.message).equal('eek')
  expect(out.stack).equal(null)
})

function seneca_instance(testmode) {
  return Seneca({ legacy: { transport: false } })
    .test(testmode)
    .use('promisify')
    .use(Plugin, { test: true })
}
