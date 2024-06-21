import { test } from 'node:test'
import { app } from "./server.js"
import { serve } from "@hono/node-server";
import assert from 'node:assert'

class AddressUrl extends URL {
  constructor(address) {
    if (!('address' in address)) throw new Error(`options must have address property`)
    super(`http://${address.address}${address.port ? `:${address.port}` : ''}`)
  }
}

await test('server serves http', async (t) => {
  const server = await serve({ ...app, port: 0 })
  await new Promise((resolve) =>
    server.addListener('listening', () => resolve(undefined)))
  try { await checkServer(server) }
  finally { server.close() }
  async function checkServer(server) {
    const url = new AddressUrl(server.address())

    /** @param {URL} url */
    const fetchJson = (url) => fetch(url, {
      headers: {
        accept: 'application/json'
      }
    }).then(async response => ({ response, json: await response.json() }))

    const meId = new URL('/users/me', url)

    {
      // GET actor and expect JSON
      const { json: me } = await fetchJson(meId)
      assert.equal(me.type, 'Person', `me.type is "Person"`)
    }

    // POST a Follow to [/users/me, inbox]
    {
      const { json: me } = await fetchJson(meId)
      const inboxId = await getInboxUrl(me)
      assert.ok(inboxId instanceof URL, `inboxId instanceof URL`)
      const postFollow = await fetch(inboxId, {
        method: 'post',
        headers: {
          'content-type': `application/ld+json; profile="https://www.w3.org/ns/activitystreams"`,
        },
        body: JSON.stringify({
          "@context": ["https://www.w3.org/ns/activitystreams",],
          type: "Follow",
          actor: `https://bengo.is`,
          object: meId,
        })
      })
      console.debug('postFollow', await postFollow.text())
      // @todo make a request with enough auth to get a 201
      assert.equal(postFollow.status, 401, `POST response has status indicating insufficient auth`)
    }
  }
})

/**
 * given an actor, return a URL for the inbox
 * @param {unknown} actor
 */
async function getInboxUrl(actor) {
  const inboxId = actor.inbox
  if (inboxId instanceof URL) return inboxId
  if (typeof inboxId === 'string') {
    return new URL(inboxId)
  }
  throw new Error(`unable to determine inbox URL`)
}
