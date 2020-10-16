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
    useToken: true,
  })
  await _server.listen()
})

afterAll(async () => {
  await _server!.close()
})

describe('enable token', () => {
  it('upload with token', async (done) => {
    const url = `http://localhost:${PORT}/${ROUTE}`
    const tokenUrl = `http://localhost:${PORT}/token`
    const fileName = '1k.txt'
    const fileStream = fs.createReadStream(path.join(TestFileFolder, fileName))
    const expectedContent = fs.readFileSync(path.join(TestFileFolder, fileName), 'utf8')

    const { token } = (await superagent.get(tokenUrl)).body.data

    await superagent
      .post(url)
      .set('Authorization', token)
      .attach('file', fileStream as any, {
        filename: fileName,
      })

    superagent
      .get(url + '/' + fileName)
      .set('Authorization', token)
      .pipe(
        concat((result) => {
          expect(result.toString('utf8')).toBe(expectedContent)
          done()
        })
      )

    done()
  })

  it('unauthorized', async (done) => {
    const url = `http://localhost:${PORT}/${ROUTE}`
    const fileName = '1k.txt'
    const fileStream = fs.createReadStream(path.join(TestFileFolder, fileName))

    try {
      await superagent.post(url).attach('file', fileStream as any, {
        filename: fileName,
      })
    } catch (err) {
      expect(err.message).toBe('Unauthorized')
      done()
    }
  })

  it('expired', async (done) => {
    const url = `http://localhost:${PORT}/${ROUTE}`
    const tokenUrl = `http://localhost:${PORT}/token?expiresIn=-10`
    const fileName = '1k.txt'
    const fileStream = fs.createReadStream(path.join(TestFileFolder, fileName))

    const { token } = (await superagent.get(tokenUrl)).body.data

    try {
      await superagent
        .post(url)
        .set('Authorization', token)
        .attach('file', fileStream as any, {
          filename: fileName,
        })
    } catch (err) {
      expect(err.message).toBe('Unauthorized')
      done()
    }
  })
})
