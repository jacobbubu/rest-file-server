import * as fs from 'fs'
import * as path from 'path'
import concat = require('concat-stream')
import superagent = require('superagent')
import server from '../src'

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
    let dataLeft = fs.readFileSync(filePath)
    let buffers: Buffer[] = []
    const chunkSize = 200

    while (true) {
      if (dataLeft.length <= chunkSize) {
        buffers.push(dataLeft)
        break
      } else {
        buffers.push(dataLeft.slice(0, chunkSize))
        dataLeft = dataLeft.slice(chunkSize)
        if (dataLeft.length === 0) {
          break
        }
      }
    }

    const totalSize = buffers.reduce((sum, buffer) => {
      sum += buffer.byteLength
      return sum
    }, 0)

    for (let i = 0; i < buffers.length; i++) {
      await superagent
        .post(url + `/chunk/${fileName}`)
        .field('filename', fileName)
        .field('chunknumber', i + 1)
        .attach('file', buffers[i], {
          filename: fileName,
        })
    }

    await superagent
      .post(url + `/assemble/${fileName}`)
      .send({ filename: fileName, totalsize: totalSize })

    superagent.get(url + '/' + fileName).pipe(
      concat((result) => {
        expect(result.toString()).toBe(fs.readFileSync(filePath).toString())
        done()
      })
    )
  })
})
