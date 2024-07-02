#!/usr/bin/env node

import { createReadStream, existsSync } from "fs"
import readNDJSONStream from 'ndjson-readablestream';
import { ReadableStream } from "stream/web";

/**
 * @param {object} options
 */
async function main(options = {}) {
  console.log('hi', process.stdin.isTTY, process.argv)
  const assertionsFilePath = process.argv[2]
  if (!existsSync(assertionsFilePath)) {
    throw new Error(`file does not exist`, {
      cause: assertionsFilePath
    })
  }

  for await (const assertion of readNDJSONStream(ReadableStream.from(createReadStream(assertionsFilePath)))) {
    console.log('assertion', assertion)
  }
}

await main()
