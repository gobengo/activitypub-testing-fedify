#!/usr/bin/env node

import { createReadStream, existsSync } from "fs"
import readNDJSONStream from 'ndjson-readablestream';
import { ReadableStream } from "stream/web";

/**
 * @param {object} options
 */
async function main(options = {}) {
  // whether the running process has a stdio pipe on stdin
  const hasStdin = !process.stdin.isTTY

  // get a ReadableStream of ndjson assertions like those output by activitypub-testing
  const assertionsStream = hasStdin ? ReadableStream.from(process.stdin) : createFileReadableStream(process.argv[2])

  // log assertions
  for await (const assertion of readNDJSONStream(assertionsStream)) {
    console.log('assertion', assertion)
  }
}

await main()

/** given path to file, return a ReadableStream iff the file exists */
function createFileReadableStream (assertionsFilePath) {
  if (!assertionsFilePath) {
    throw new Error(`provide an assertions file path as a positional argument`)
  }
  if (!existsSync(assertionsFilePath)) {
    throw new Error(`file does not exist`, {
      cause: assertionsFilePath
    })
  }
  return ReadableStream.from(createReadStream(assertionsFilePath))
}
