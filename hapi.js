/* Copyright (c) 2018-2019 voxgig and other contributors, MIT License */
'use strict'

module.exports = hapi

hapi.defaults = {
  test: false,
  debug: false
}

hapi.errors = {}

function hapi(options) {
  const seneca = this
  const root = seneca.root
  const tu = seneca.export('transport/utils')

  const modifier_names = [
    // Functions to modify the custom object in Seneca message meta$ descriptions
    // params: (custom, json, req, h)
    'custom',

    // Functions to modify the fixed arguments to Seneca messages
    // params: (fixed, json, req, h)
    'fixed',

    // Functions to modify the seneca request delegate
    // params: (delegate, json, req, h)
    'delegate',

    // Functions to modify the action or message
    // params: (msg, req, h), this === seneca instance
    'action',

    // Functions to modify the result
    // params: (msg, err, out, req, h), this === seneca instance
    'result'
  ]

  modifier_names.forEach(name => {
    intern.modifiers[name] = []
    var hook_action = intern.make_modifier_hook(name)
    seneca.message({ role: 'web-handler', hook: name }, hook_action)
  })

  // Creates per-request seneca instance
  function make_handler(handler) {
    return async function handler_instance(req, h) {
      const seneca = prepare_seneca(null, req, h)
      return await handler(seneca, req, h)
    }
  }

  // Convenience handler to call a seneca action directly from inbound POST JSON.
  async function action_handler(req, h) {
    const data = req.payload
    const json = 'string' === typeof data ? tu.parseJSON(data) : data
    if (json instanceof Error) {
      throw json
    }

    const seneca = prepare_seneca(json, req, h)
    const msg = tu.internalize_msg(seneca, json)

    return await new Promise(resolve => {
      var out = null
      for (var i = 0; i < intern.modifiers.action.length; i++) {
        out = intern.modifiers.action[i].call(seneca, msg, req, h)
        if (out) {
          return resolve(out)
        }
      }

      seneca.act(msg, function(err, out, meta) {
        if (err && !options.debug) {
          err.stack = null
        }

        for (var i = 0; i < intern.modifiers.result.length; i++) {
          intern.modifiers.result[i].call(seneca, msg, err, out, req, h)
        }

        resolve(tu.externalize_reply(this, err, out, meta))
      })
    })
  }

  function prepare_seneca(json, req, h) {
    const custom = {}
    var i

    for (i = 0; i < intern.modifiers.custom.length; i++) {
      intern.modifiers.custom[i](custom, json, req, h)
    }

    const fixed = {}

    for (i = 0; i < intern.modifiers.fixed.length; i++) {
      intern.modifiers.fixed[i](fixed, json, req, h)
    }

    const delegate = root.delegate(fixed, { custom: custom })

    for (i = 0; i < intern.modifiers.delegate.length; i++) {
      intern.modifiers.delegate[i](delegate, json, req, h)
    }

    return delegate
  }

  return {
    exports: {
      make_handler: make_handler,
      action_handler: action_handler
    }
  }
}

const intern = (hapi.intern = {
  modifiers: {},
  make_modifier_hook: function(name) {
    return async function(msg) {
      if ('function' === typeof msg[name]) {
        intern.modifiers[name].push(msg[name])
      }
    }
  }
})
