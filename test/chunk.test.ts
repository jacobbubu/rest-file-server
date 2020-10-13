import * as fs from 'fs'
import * as path from 'path'
import concat = require('concat-stream')
import superagent = require('superagent')
import through = require('through2')
import server from '../src'
import { nextTick } from 'process'

const ROUTE = 'files'
const PORT = 8080
const TestFileFolder = path.resolve(__dirname, 'test-files')

beforeAll(async () => {
  await server.run({
    port: PORT,
    route: ROUTE,
  })
})

afterAll(async () => {
  await server.close()
})

describe('chunk', () => {
  it('upload', async (done) => {
    const url = `http://localhost:${PORT}/${ROUTE}`
    const fileName = '1k.txt'
    const filePath = path.join(TestFileFolder, fileName)
    const chunkSize = 200

    fs.createReadStream(filePath).pipe(
      getChunkableStream(chunkSize, async (chunk, index, len) => {
        if (chunk === null) {
          await drain(len)
          return
        }

        async function drain(totalSize: number) {
          await superagent
            .post(url + `/assemble/${fileName}`)
            .send({ filename: fileName, totalsize: totalSize })

          superagent.get(url + '/' + fileName).pipe(
            concat((result) => {
              expect(result.toString()).toBe(fs.readFileSync(filePath).toString())
              done()
            })
          )
        }

        await superagent
          .post(url + `/chunk/${fileName}`)
          .field('filename', fileName)
          .field('chunknumber', index)
          .attach('file', chunk, {
            filename: fileName,
          })
      })
    )
  })
})

function getChunkableStream(
  chunkSize: number,
  onNext: (chunk: Buffer | null, chunkIndex: number, currLen: number) => Promise<void>
) {
  let rest: Buffer = Buffer.alloc(0)
  let currLen = 0
  let chunkIndex = 0
  return through(async function (chunk, enc, cb) {
    rest = Buffer.concat([rest, chunk])
    while (rest.length >= chunkSize) {
      currLen += chunkSize
      chunkIndex += 1
      await onNext(rest.slice(0, chunkSize), chunkIndex, currLen)
      rest = Buffer.concat([rest.slice(chunkSize)])
    }
    if (rest.length > 0) {
      currLen += rest.length
      chunkIndex += 1
      await onNext(rest, chunkIndex, currLen)
    }
    await onNext(null, chunkIndex, currLen)
    cb()
  })
}
