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


lab.test('validate', Util.promisify(function(x,fin){PluginValidator(Plugin, module)(fin)}))


lab.test('handler', async () => {
  const si = seneca_instance()

  si
    .message('a:1', async function(msg) {
      return {x:msg.x}
    })

  await si.ready()
  
  const handler = si.export('hapi/handler')
  
  var out = await handler({payload:{a:1,x:2}})
  expect(out).includes({x:2})

  await si.post('role:web-handler,hook:custom', {
    custom: function(custom) {
      custom.foo = 1
    }
  })

  var out = await handler({payload:{a:1,x:2}})
  expect(out.meta$.custom.foo).equals(1)

})



function seneca_instance(testmode) {
  return Seneca({legacy:{transport: false}})
    .test(testmode)
    .use('promisify')
    .use(Plugin, {test:true})
}
