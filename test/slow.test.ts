import * as fs from 'fs'
import * as path from 'path'
import concat = require('concat-stream')
import superagent = require('superagent')
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

describe('slow', () => {
  it('upload', async (done) => {
    const url = `http://localhost:${PORT}/${ROUTE}`
    const fileName = '1k.txt'
    const fileStream = fs.createReadStream(path.join(TestFileFolder, fileName))
    const expectedContent = fs.readFileSync(path.join(TestFileFolder, fileName), 'utf8')

    const startTime = Date.now()

    await superagent
      .post(url)
      // tell the server to receive in chunk of 100 bytes with a delay of 100 ms
      .query({ wait: 100, chunkSize: 100 })
      .attach('file', fileStream as any, {
        filename: fileName,
      })

    superagent.get(url + '/' + fileName).pipe(
      concat((result) => {
        const elapsed = Date.now() - startTime
        expect(elapsed).toBeGreaterThan(1000)
        expect(result.toString('utf8')).toBe(expectedContent)
        done()
      })
    )
  })
})
