import { Server } from 'http'
import express = require('express')
import { Express, Request, Response } from 'express'
import cors = require('cors')
import multer = require('multer')
import { urlencoded, json } from 'body-parser'
import { SlowMemoryStorage } from './slow-memory-storage'
import expressJwt = require('express-jwt')
import jwt = require('jsonwebtoken')

import {
  writeFile,
  getFileSize,
  readFile,
  removeFile,
  writeFileChunk,
  assembleFileChunks,
} from './file-service'
import logger, { setLogLevel } from './log'
import { delay } from './util'

export { delay } from './util'

const saveFile = async (request: Request, response: Response, filename: string) => {
  logger.verbose('Saving file: %o %s', request.file, filename)

  const wait = Number(request.query.wait ?? 0)
  const result = writeFile(request.file)

  if (wait) {
    await delay(wait)
  }
  if (request.query._postmessage) {
    if (request.query._postmessageid) {
      result.data._postmessageid = request.query._postmessageid
    }
    response
      .status(result.status)
      .header('Content-Type', 'text/html')
      .send(
        `<!DOCTYPE html><script>parent.postMessage(JSON.stringify(${JSON.stringify(
          result.data
        )}), '*');</script>`
      )
  } else {
    response.status(result.status).send(result.data)
  }
}

export interface Options {
  port?: number
  route: string
  useToken?: boolean
  chunkNumber?: string
  totalSize?: string
  verbose?: boolean
}

interface Exp {
  _server: Server | null
  init(options: Options): Express
  run(options: Options): Promise<void>
  close(): Promise<void>
}

const SECRET = 'ƐᄅƖʇǝɹɔǝs'
const OneDay = 3600 * 24
const ADMIN = 'lovecraft'

const exp: Exp = {
  _server: null,
  init(options: Options) {
    if (process.env.NODE_ENV === 'test') {
      setLogLevel('ERROR')
    }
    const upload = multer({ storage: new SlowMemoryStorage() })

    const app = express()
    app.use(
      expressJwt({
        secret: SECRET,
        algorithms: ['HS256'],
        credentialsRequired: options.useToken ?? false,
      }).unless({ path: ['/token'] })
    )
    app.use(
      urlencoded({
        extended: true,
      })
    )
    app.use(json())
    app.use(cors())

    app.get(`/token`, (request, response) => {
      const expiresIn = Number(request.query.expiresIn ?? OneDay)
      const expiresAt = Date.now() / 1000 + expiresIn
      const token =
        'Bearer ' +
        jwt.sign(
          {
            _id: ADMIN,
          },
          SECRET,
          {
            expiresIn,
          }
        )
      logger.info(
        `Generated a new token that will be expired at '${new Date(
          expiresAt * 1000
        ).toLocaleString('zh-CN', { hour12: false })}'`
      )
      response.json({
        status: 'ok',
        data: { token, expiresAt: expiresAt * 1000 },
      })
    })

    app.get(`/protected`, (request, response) => {
      const user = (request as any).user
      if (user._id !== ADMIN) {
        return response.sendStatus(401)
      }
      response.json({ status: 'ok' })
    })

    app.get(`/${options.route}/:filename/size`, (request, response) => {
      const result = getFileSize(request.params.filename)
      response.status(result.status).send(result.data)
    })

    app.get(`/${options.route}/:filename`, (request, response) => {
      const result = readFile(request.params.filename)

      response.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-disposition': 'attachment;filename=' + result.filename ?? 'temp.dat',
        // 'Content-Length': data.length
      })
      response.end(result.data, 'binary')
    })
    app.delete(`/${options.route}/:filename`, (request, response) => {
      const result = removeFile(request.params.filename)
      response.status(result.status)
    })

    app.post(`/${options.route}`, upload.single('file'), async (request, response) => {
      await saveFile(request, response, request.file.originalname)
    })

    app.post(`/${options.route}/:filename`, upload.single('file'), async (request, response) => {
      await saveFile(request, response, request.params.filename)
    })

    app.post(`/${options.route}/chunk/:filename`, upload.single('file'), (request, response) => {
      const result = writeFileChunk(
        request.params.filename,
        request.file.buffer,
        request.body[options.chunkNumber || 'chunknumber']
      )
      response.status(result.status).send(result.data)
    })

    app.post(`/${options.route}/assemble/:filename`, (request, response) => {
      const result = assembleFileChunks(
        request.params.filename,
        request.body[options.totalSize || 'totalsize']
      )
      response.status(result.status).send(result.data)
    })

    return app
  },

  run(options: Options): Promise<void> {
    return new Promise((resolve) => {
      const express = this.init(options)
      this._server = express.listen(options.port, () => {
        logger.info('Server ready. Configuration:')
        logger.info('  * Port: %d', options.port)
        logger.info('  * Use Token: %s', options.useToken)
        logger.info('  * Routes: %s', `/${options.route}`)
        logger.info('  * Verbose: %s', options.verbose ? 'yes' : 'no')
        resolve()
      })
    })
  },

  close() {
    return new Promise((resolve) => {
      if (this._server) {
        this._server.close(() => {
          this._server = null
          resolve()
        })
      }
    })
  },
}

export default exp
