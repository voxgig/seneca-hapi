
const Seneca = require('seneca')
const Hapi = require('@hapi/hapi')
const Inert = require('@hapi/inert')
const Cookie = require('@hapi/cookie')

setup()

async function setup() {
  const si = Seneca({legacy:{transport:false}})

  si
    .test('print')
    .use('promisify')
    .use('..', {test: true})

    .message('a:1', async function(msg) {
      return {x:msg.x}
    })
    .message('b:1', async function(msg) {
      const a1 = await this.post('a:1,x:2')
      return {x:a1.x,y:msg.y}
    })
    .message('c:1', async function(msg) {
      throw new Error('C1')
    })


  si.act('role:web-handler,hook:result', {
    result: function(msg, err, out, req, h) {
      h.state('seneca-hapi-plain', 'BAR:'+Date.now())
      h.state('seneca-hapi', 'FOO:'+Date.now())
      if(!err) {
        out.z = 1
      }
    }
  })

  
  await si.ready()
  
  const hapi = new Hapi.Server({port:8080})

  await hapi.register(Inert)
  await hapi.register(Cookie)


  hapi.auth.strategy('session', 'cookie', {
    cookie: {
      name: 'seneca-hapi',
      password: 'foo'.repeat(12)
    }
  })

  
  hapi.route({
    method: 'GET',
    path: '/{path*}',
    handler: {
      directory: {
        path: __dirname
      }
    }
  })

  hapi.route({
    method: 'GET',
    path: '/seneca-browser.js',
    handler: {
      file: {
        path: __dirname + '/../node_modules/seneca-browser/seneca-browser.js'
      }
    }
  })

  hapi.route({
    method: 'POST',
    path: '/msg',
    config: {
      handler: si.export('hapi/action_handler')
    }
  })

  await hapi.start()

  console.log(hapi.info)
}
