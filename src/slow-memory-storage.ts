import { Request } from 'express'
import concat = require('concat-stream')
import { makeSlowStream } from './util'

export type HandleFileCallback = (err?: Error | null, info?: Partial<Express.Multer.File>) => void
export type RemoveFileCallback = (error: any) => void

export interface SlowMemoryStorageOptions {
  chunkSize: number
  wait: number
}

export class SlowMemoryStorage {
  constructor(private readonly _opts: Partial<SlowMemoryStorageOptions> = {}) {
    _opts.chunkSize = _opts.chunkSize ?? Infinity
    _opts.wait = _opts.wait ?? 0
  }

  _handleFile(req: Request, file: Express.Multer.File, cb: HandleFileCallback) {
    const chunkSize = Number(req.query.chunkSize ?? this._opts.chunkSize)
    const wait = Number(req.query.wait ?? this._opts.wait)
    if (wait === 0 && chunkSize === Infinity) {
      file.stream.pipe(
        concat({ encoding: 'buffer' }, function (data) {
          cb(null, {
            buffer: data,
            size: data.length,
          })
        })
      )
    } else {
      file.stream.pipe(makeSlowStream(chunkSize, wait)).pipe(
        concat({ encoding: 'buffer' }, function (data) {
          cb(null, {
            buffer: data,
            size: data.length,
          })
        })
      )
    }
  }

  _removeFile(req: Request, file: Express.Multer.File, cb: RemoveFileCallback) {
    delete (file as any).buffer
    cb(null)
  }
}
