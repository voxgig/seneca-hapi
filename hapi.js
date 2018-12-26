/* Copyright (c) 2018 voxgig and other contributors, MIT License */
'use strict'

const Util = require('util')

module.exports = hapi

hapi.defaults = {
  test: false,
  debug: false
}

hapi.errors = {}

function hapi(options) {
  const root = this.root
  const tu = this.export('transport/utils')

  // Functions to modify the custom object in Seneca message meta$ descriptions
  const modify_custom = []

  // Functions to modify the fixed arguments to Seneca messages
  const modify_fixed = []

  // Functions to modify the action or message
  const modify_action = []

  
  this.message('role:web-handler,hook:custom', async function(msg) {
    if ('function' === typeof msg.custom) {
      modify_custom.push(msg.custom)
    }
  })

  this.message('role:web-handler,hook:fixed', async function(msg) {
    if ('function' === typeof msg.fixed) {
      modify_fixed.push(msg.fixed)
    }
  })

  this.message('role:web-handler,hook:action', async function(msg) {
    if ('function' === typeof msg.action) {
      modify_action.push(msg.action)
    }
  })

  
  // Creates per-request seneca instance
  function make_handler(handler) {
    return async function handler_instance(req, h) {
      const seneca = prepare_seneca(req)
      return await handler(seneca, req, h)
    }
  }

  // Convenience handler to call a seneca action directly from inbound POST JSON.
  async function action_handler(req, h) {
    const data = req.payload
    const json = 'string' === typeof data ? tu.parseJSON(data) : data
    if(json instanceof Error) {
      throw json
    }

    const seneca = prepare_seneca(req, json)
    const msg = tu.internalize_msg(seneca, json)

    return await new Promise(resolve => {
      var out = null
      for(var i = 0; i < modify_action.length; i++) {
        out = modify_action[i].call(seneca,msg,req)
        if(out) {
          return resolve(out)
        }
      }
      
      seneca.act(msg, function(err, out, meta) {
        if (err && !options.debug) {
          err.stack = null
        }

        resolve(tu.externalize_reply(this, err, out, meta))
      })
    })
  }

  function prepare_seneca(req, json) {
    const custom = {}
    for (var i = 0; i < modify_custom.length; i++) {
      modify_custom[i](custom, req, json)
    }

    const fixed = {}
    for (var i = 0; i < modify_fixed.length; i++) {
      modify_fixed[i](fixed, req, json)
    }

    const seneca = root.delegate(fixed, { custom: custom })
    return seneca
  }

  return {
    exports: {
      make_handler: make_handler,
      action_handler: action_handler
    }
  }
}

const intern = (hapi.intern = {})
