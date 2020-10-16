import * as fs from 'fs'
import * as path from 'path'
import nodegetopt = require('node-getopt')
import logger, { setLogLevel } from './log'
import { FileServer } from '.'
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))

const opt = nodegetopt
  .create([
    ['p', 'port=PORT', 'server port (default 5000)'],
    ['', 'usetoken=true', 'whether to enable token authentication'],
    ['', 'chunknumber=CHUNKNUMBER', "chunk number parameter (default 'chunknumber')"],
    ['', 'totalsize=TOTALSIZE', "total size parameter (default 'totalsize')"],
    ['', 'route=flies', "the API starting path (default '/files')"],
    ['v', 'verbose', 'change log level to lowest'],
  ])
  .bindHelp()
  .parseSystem().options

logger.info('================================')
logger.info('>>> Express REST file server')
logger.info(`>>> version: ${pkg.version}`)
logger.info('================================')

if (opt.verbose) {
  setLogLevel('verbose')
  logger.debug('Command line options', opt)
}

// tslint:disable-next-line no-floating-promises
const server = new FileServer({
  port: Number(opt.port || process.env.PORT || 8080),
  useToken: opt.usetoken === 'true',
  chunkNumber: opt.chunknumber as string,
  totalSize: opt.totalsize as string,
  route: (opt.route as string) || 'files',
  verbose: !!opt.verbose,
})

// tslint:disable-next-line no-floating-promises
server.listen()
