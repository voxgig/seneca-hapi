/* Copyright (c) 2018 voxgig and other contributors, MIT License */
'use strict'


const Util = require('util')


module.exports = hapi

hapi.defaults = {
  test: false,
  debug: false,
  make_custom: function(req) {
    return {}
  }
}

hapi.errors = {}

function hapi(options) {
  const root = this.root
  const tu = this.export('transport/utils')
  
  async function handler(req, h) {
    const data = req.payload
    const json = 'string' === typeof data ? tu.parseJSON(data) : data
    const custom = options.make_custom(req)
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

