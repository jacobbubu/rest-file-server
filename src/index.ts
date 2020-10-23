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
  getChunkedFileInfos,
  ChunkInfo,
} from './file-service'
import logger, { setLogLevel } from './log'
import { delay } from './util'

export { delay } from './util'
export { ChunkInfo }

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
  logLevel?: string
}

export class FileServer {
  private _expressApp: Express
  private _httpServer: Server | null = null

  constructor(private readonly _options: Options) {
    if (_options.logLevel) {
      setLogLevel(_options.logLevel)
    }
    const upload = multer({ storage: new SlowMemoryStorage() })

    const app = express()
    app.use(
      expressJwt({
        secret: SECRET,
        algorithms: ['HS256'],
        credentialsRequired: _options.useToken ?? false,
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

    app.get(`/${_options.route}/:filename/size`, (request, response) => {
      const result = getFileSize(request.params.filename)
      response.status(result.status).send(result.data)
    })

    app.get(`/${_options.route}/:filename/info`, (request, response) => {
      const result = getChunkedFileInfos(request.params.filename)
      response.status(result.status).send(result.data as ChunkInfo[])
    })

    app.get(`/${_options.route}/:filename`, (request, response) => {
      const result = readFile(request.params.filename)
      if (result.status >= 200 && result.status < 300) {
        response.writeHead(result.status, {
          'Content-Type': 'application/octet-stream',
          'Content-disposition': 'attachment;filename=' + result.filename ?? 'temp.dat',
        })
        response.end(result.data, 'binary')

        return
      }
      response.status(result.status).send(result.data)
    })

    app.delete(`/${_options.route}/:filename`, (request, response) => {
      const result = removeFile(request.params.filename)
      response.status(result.status).send({})
    })

    app.post(`/${_options.route}`, upload.single('file'), async (request, response) => {
      await saveFile(request, response, request.file.originalname)
    })

    app.post(`/${_options.route}/:filename`, upload.single('file'), async (request, response) => {
      await saveFile(request, response, request.params.filename)
    })

    app.post(`/${_options.route}/chunk/:filename`, upload.single('file'), (request, response) => {
      const result = writeFileChunk(
        request.params.filename,
        request.file.buffer,
        request.body[_options.chunkNumber || 'chunknumber']
      )
      response.status(result.status).send(result.data)
    })

    app.post(`/${_options.route}/assemble/:filename`, (request, response) => {
      const result = assembleFileChunks(
        request.params.filename,
        request.body[_options.totalSize || 'totalsize']
      )
      response.status(result.status).send(result.data)
    })

    this._expressApp = app
  }

  get options() {
    return this._options
  }

  listen(): Promise<Server> {
    return new Promise((resolve) => {
      const opts = this.options
      this._httpServer = this._expressApp.listen(opts.port, () => {
        logger.info('Server ready. Configuration:')
        logger.info('  * Port: %d', opts.port)
        logger.info('  * Use Token: %s', opts.useToken)
        logger.info('  * Routes: %s', `/${opts.route}`)
        logger.info('  * Verbose: %s', opts.verbose ? 'yes' : 'no')
        resolve(this._httpServer!)
      })
    })
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this._httpServer) {
        this._httpServer.close(() => {
          this._httpServer = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}

const SECRET = 'ƐᄅƖʇǝɹɔǝs'
const OneDay = 3600 * 24
const ADMIN = 'lovecraft'
