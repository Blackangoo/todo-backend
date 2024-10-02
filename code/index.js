const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const cors = require('@koa/cors')
const router = require('./router')
const useConnection = require('./database')

const port = 8080

async function start() {
  useConnection()

  const app = new Koa();

  app
    .use(bodyParser())
    .use(cors())
    .use(router.routes())
    .use(router.allowedMethods())

  app.listen(port)

  console.log(`Started on port ${port}`)
}

start()
