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

  const modify_custom = []
  
  this.message('role:web-handler,hook:custom', async function(msg) {
    if('function' === typeof msg.custom) {
      modify_custom.push(msg.custom)
    }
  })
  
  
  async function handler(req, h) {
    const data = req.payload
    const json = 'string' === typeof data ? tu.parseJSON(data) : data

    const custom = {}
    for(var i = 0; i < modify_custom.length; i++) {
      modify_custom[i](custom,json,'hapi',req)
    }

    const seneca = root.delegate(null, { custom: custom })
    const msg = tu.internalize_msg(seneca, json)

    return await new Promise((resolve)=>{
      seneca.act(msg, function(err, out, meta) {
        if (err && !options.debug) {
          err.stack = null
        }
        
        resolve(tu.externalize_reply(this, err, out, meta))
      })
    })
  }
  
  return {
    exports: {
      handler: handler
    }
  }
}


const intern = hapi.intern = {
}

