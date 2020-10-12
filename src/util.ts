import through = require('through2')

export const delay = (ms: number) => new Promise((resolve) => setTimeout(() => resolve(), ms))

export const makeSlowStream = (chunkSize: number = 0, wait: number = 0) => {
  return through(async function (chunk: Buffer, enc, cb) {
    if (chunkSize === 0) {
      cb(null, chunk)
      if (wait) {
        await delay(wait)
      }
      return
    }

    do {
      this.push(chunk.slice(0, chunkSize))
      await delay(wait)
      chunk = chunk.slice(chunkSize)
    } while (chunk.length > chunkSize)
    if (chunk.length > 0) {
      this.push(chunk)
    }
    cb()
  })
}
