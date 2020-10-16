import * as fs from 'fs'
import * as path from 'path'
import concat = require('concat-stream')
import superagent = require('superagent')
import { FileServer } from '../src'

const ROUTE = 'files'
const PORT = 8080
const TestFileFolder = path.resolve(__dirname, 'test-files')
const url = `http://localhost:${PORT}/${ROUTE}`
const fileName = '1k.txt'

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

describe('basic', () => {
  it('upload', async (done) => {
    const fileStream = fs.createReadStream(path.join(TestFileFolder, fileName))
    const expectedContent = fs.readFileSync(path.join(TestFileFolder, fileName), 'utf8')

    const startTime = Date.now()

    await superagent.post(url).attach('file', fileStream as any, {
      filename: fileName,
    })

    superagent.get(url + '/' + fileName).pipe(
      concat((result) => {
        const elapsed = Date.now() - startTime
        expect(elapsed).toBeLessThan(500)
        expect(result.toString('utf8')).toBe(expectedContent)
        done()
      })
    )
  })

  it('info', async () => {
    const fileStream = fs.createReadStream(path.join(TestFileFolder, fileName))
    const expectedSize = fs.statSync(path.join(TestFileFolder, fileName)).size

    await superagent.post(url).attach('file', fileStream as any, {
      filename: fileName,
    })

    const res = await superagent.get(url + '/' + fileName + '/info')
    expect(res.body).toEqual([
      {
        chunkNum: 1,
        size: expectedSize,
        chunkSize: expectedSize,
      },
    ])
  })
})
