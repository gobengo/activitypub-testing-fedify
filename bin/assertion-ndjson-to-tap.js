#!/usr/bin/env node

import { createReadStream, existsSync } from "fs"
import readNDJSONStream from 'ndjson-readablestream';
import { Readable } from "stream";
import { finished, pipeline } from "stream/promises"
import { ReadableStream, WritableStream } from "stream/web";

/**
 * @param {object} options
 */
async function main(options = {}) {
  // whether the running process has a stdio pipe on stdin
  const hasStdin = !process.stdin.isTTY

  // get a ReadableStream of ndjson assertions like those output by activitypub-testing
  const assertionsStream = hasStdin ? ReadableStream.from(process.stdin) : createFileReadableStream(process.argv[2])

  console.log('TAP version 14')

  let assertionIndex = -1
  process.stdout.setMaxListeners(1000) // to avoid nodejs warnings
  // log assertions
  for await (const assertion of readNDJSONStream(assertionsStream)) {
    assertionIndex++
    const assertionsTap = Readable.from(renderAssertionTap(assertionIndex, assertion))
    await pipeline(assertionsTap, process.stdout, { end: false })
    process.stdout.write('\n\n')
  }
  const plan = `1..${assertionIndex+1}\n`
  process.stdout.write(plan)
}

await main()

function * renderAssertionTap(index, assertion) {
  const skipped = assertion.result.outcome === 'inapplicable'
  const okness = assertion.result.outcome === 'passed' ? 'ok' : 'not ok'
  yield `${okness} ${index} - ${assertion.test.name}`
  if (skipped) yield ` # SKIP`
  if (assertion.result.outcome === 'failed') {
    // render the diagnostic block
    function * renderDiagnostic (inner) {
      yield * indented('  ', function * () {
        yield '---\n'
        yield 'foo: bar\n'
        yield 'baz: bar\n'
        yield '...\n'
      }())
    }
    yield '\n'
    yield * renderDiagnostic('foo')
  }
}

function * indented(prefix, content) {
  for (const c of content) {
    yield prefix
    yield c
  }
}

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
