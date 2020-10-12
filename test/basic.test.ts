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

describe('basic', () => {
  it('upload', async (done) => {
    const url = `http://localhost:${PORT}/${ROUTE}`
    const fileName = '1k.txt'
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
})
