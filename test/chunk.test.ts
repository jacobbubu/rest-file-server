import * as fs from 'fs'
import * as path from 'path'
import concat = require('concat-stream')
import superagent = require('superagent')
import through = require('through2')
import { FileServer } from '../src'

const ROUTE = 'files'
const PORT = 8080
const TestFileFolder = path.resolve(__dirname, 'test-files')

let _server: FileServer | null = null

beforeAll(async () => {
  _server = new FileServer({
    port: PORT,
    route: ROUTE,
    logLevel: 'ERROR',
  })
  await _server.listen()
})

afterAll(async () => {
  await _server!.close()
})

describe('chunk', () => {
  it('upload', async (done) => {
    const url = `http://localhost:${PORT}/${ROUTE}`
    const fileName = '1k.txt'
    const filePath = path.join(TestFileFolder, fileName)
    const chunkSize = 200
    const expectedSize = fs.statSync(filePath).size

    fs.createReadStream(filePath).pipe(
      getChunkableStream(chunkSize, async (chunk, index, len) => {
        if (chunk === null) {
          await drain(len)
          return
        }

        async function drain(totalSize: number) {
          const res = await superagent.get(url + '/' + fileName + '/info')
          expect(res.body).toEqual([
            { chunkNum: 1, size: chunkSize, chunkSize: chunkSize },
            { chunkNum: 2, size: chunkSize, chunkSize: chunkSize },
            { chunkNum: 3, size: chunkSize, chunkSize: chunkSize },
            { chunkNum: 4, size: chunkSize, chunkSize: chunkSize },
            { chunkNum: 5, size: chunkSize, chunkSize: chunkSize },
            { chunkNum: 6, size: 24, chunkSize: 24 },
          ])

          await superagent
            .post(url + `/assemble/${fileName}`)
            .send({ filename: fileName, totalsize: totalSize })

          superagent.get(url + '/' + fileName).pipe(
            concat(async (result) => {
              // for now, we check assembled file
              expect(result.toString()).toBe(fs.readFileSync(filePath).toString())

              const res = await superagent.get(url + '/' + fileName + '/info')
              expect(res.body).toEqual([
                {
                  chunkNum: 1,
                  size: expectedSize,
                  chunkSize: expectedSize,
                },
              ])
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
