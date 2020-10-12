import { readFileSync, unlinkSync } from 'fs'
import { Stream } from 'stream'
import logger from './log'

export interface FileInfo {
  age: number
  buffer?: Buffer | null
  filepath?: string
  size?: number
  stream?: Stream
}

const files: Record<string, FileInfo> = {}

const result = (status: number, data?: any, filename?: string) => ({
  status,
  data: data || {},
  filename: filename,
})

const exists = (filename: string) => !!files[filename]

const size = (filename: string) => files[filename].size

const read = (filename: string) => files[filename].buffer || readFileSync(files[filename].filepath!)

const remove = (filename: string) => {
  const file = files[filename]
  if (file.filepath) {
    unlinkSync(file.filepath)
  }
  delete files[filename]
  logger.debug(`File removed ${filename}`)
}

const write = (filename: string, buffer: Buffer | null, fileSize?: number, filepath?: string) => {
  files[filename] = {
    age: new Date().getTime(),
    buffer,
    filepath,
    size: buffer ? buffer.length : fileSize,
  }
  logger.debug(`File saved ${files[filename]}`)
}

export const getFileSize = (filename: string) => {
  if (exists(filename)) {
    const fileSize = size(filename)
    logger.debug('Request size of', filename, 'is', fileSize)
    return result(200, { fileSize }, filename)
  }
  logger.debug('Request size of %s not found', filename)
  return result(404)
}

export const readFile = (filename: string) => {
  if (exists(filename)) {
    logger.debug(`Streaming ${filename}`)
    return result(200, read(filename), filename)
  }
  logger.debug('Streaming %s not found', filename)
  return result(404)
}

export const writeFile = (file: Express.Multer.File) => {
  logger.debug('Storing %s', file.originalname)
  write(file.originalname, file.buffer, file.size, file.path)
  return result(200)
}

export const writeFileChunk = (filename: string, buffer: Buffer, chunkNumber: number) => {
  logger.debug(`Storing ${filename} chunk ${chunkNumber}`)
  write(`${filename}.${chunkNumber}.chunk`, buffer)
  return result(200)
}

export const assembleFileChunks = (filename: string, requestTotalSize: number) => {
  logger.debug('Assembling %s total size %d', filename, requestTotalSize)
  let chunkNumber = 1
  let totalSize = 0
  while (true) {
    const chunkName = `${filename}.${chunkNumber}.chunk`
    if (exists(chunkName)) {
      const fileSize = size(chunkName)
      logger.debug(`Testing ${chunkName} with size ${fileSize}`)
      chunkNumber += 1
      totalSize += fileSize!
    } else {
      // logger.error(`Testing ${chunkName} not found`)
      break
    }
  }
  if (requestTotalSize !== totalSize) {
    logger.error(
      `Request total size ${requestTotalSize} not equal to calculated total size ${totalSize}`
    )
    return result(412)
  }
  logger.debug(`Request total size ${requestTotalSize} equal to calculated total size ${totalSize}`)
  let buffer = null
  chunkNumber = 1
  while (true) {
    const chunkNameX = `${filename}.${chunkNumber}.chunk`
    if (!exists(chunkNameX)) {
      break
    }
    buffer = buffer ? Buffer.concat([buffer, read(chunkNameX)]) : read(chunkNameX)
    remove(chunkNameX)
    chunkNumber += 1
  }
  write(filename, buffer)
  return result(200)
}

export const removeFile = (filename: string) => {
  if (exists(filename)) {
    logger.debug(`Removing file ${filename}`)
    remove(filename)
    return result(200)
  }
  logger.error(`Removing ${filename} not found`)
  return result(404)
}
