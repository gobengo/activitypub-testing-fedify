// logger

import { configure, getConsoleSink } from "@logtape/logtape";

await configure({
  sinks: { console: getConsoleSink() },
  filters: {},
  loggers: [
    // this must be level > info to avoid a warning in console
    { category: ["logtape", "meta"], sinks: ["console"], level: "warning" },
    { category: "fedify", sinks: ["console"], level: "info" },
  ],
});

// fedify

import {
  Accept, Article, Create,
  createFederation, MemoryKvStore, Person, Follow, Endpoints, Note,
  exportJwk, generateCryptoKeyPair, importJwk,
  Activity,
} from "@fedify/fedify";

import { Temporal, Intl, toTemporalInstant } from '@js-temporal/polyfill';
// @ts-expect-error new Date method
Date.prototype.toTemporalInstant = toTemporalInstant;

const kv = new MemoryKvStore()
const federation = createFederation<void>({
  kv,
});

/**
 * custom Actor subclass:
 * * #toJsonLd produces JSON-LD with @context containing "https://w3id.org/fep/7628"
 */
class CustomPerson extends Person {
  async toJsonLd(options) {
    const jsonLd = await super.toJsonLd(options)
    if (!(jsonLd && typeof jsonLd === 'object')) throw new Error(`expected jsonLd to be an object`)
    return {
      ...jsonLd,
      '@context': [
        ...jsonLd['@context'],
        // include this here so FEP-0f2a test applies
        "https://w3id.org/fep/7628",
      ]
    }
  }
}

// configure inbox handling, e.g. for accepting follows
federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.id == null || follow.actorId == null || follow.objectId == null) {
      return;
    }
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor" || parsed.handle !== "me") return;
    const follower = await follow.getActor(ctx);
    console.debug('DEBUG: sending Accept for new Follow ', { follower });
    // Note that if a server receives a `Follow` activity, it should reply
    // with either an `Accept` or a `Reject` activity.  In this case, the
    // server automatically accepts the follow request:
    if (follower) {
      await ctx.sendActivity(
        { handle: parsed.handle },
        follower,
        new Accept({ actor: follow.objectId, object: follow }),
      );
      console.debug('DEBUG: Accept (to follow) sent')
      // Store the follower in the key-value store:
      console.log('BEN: doing kv set', ["followers", follow.id.href], follow.actorId.href)
      const getFollowers = async () => {
        const prev = await kv.get(["followers"])
        if ( ! Array.isArray(prev)) return []
        return prev
      }
      await kv.set(["followers"], [...await getFollowers(), follow.actorId.href]);
    }
  })
  .on(Activity, async (ctx, activity) => {
    console.log('BEN ON ACTIVITY', activity)
  })
  .on(Create, async (ctx, activity) => {
    console.log('BEN ON Create', activity)
    const from = await activity.getActor(ctx)
    if ( ! from) {
      console.log('unable to determine from address. ending early', from, activity)
      return
    }
    const replyFromHandle = "me"
    const activityObject = await activity.getObject()
    console.log('about to sendActivity', { activityObject })
    const replyPostId = new URL(`/posts/${(new Date).toISOString()}`, ctx.url)
    const reply = new Create({
      id: new URL(`#activity`, replyPostId),
      actor: ctx.getActorUri(replyFromHandle),
      published: toTemporalInstant.call(new Date),
      to: new URL("https://www.w3.org/ns/activitystreams#Public"),
      object: new Article({
        id: replyPostId,
        summary: 'this is an automatic reply at ' + (new Date).toISOString(),
        content: 'this is a test post content ' + (new Date).toISOString(),
        published: toTemporalInstant.call(new Date),
        replyTarget: activityObject?.url || activity.objectId,
      }),
    })
    await ctx.sendActivity(
      { handle: replyFromHandle },
      from,
      reply,
    );
    console.log('finished sendActivity', reply)
  })

federation
  .setActorDispatcher("/users/{handle}", async (ctx, handle) => {
    if (handle !== "me") return null;  // Other than "me" is not found.
    const actor = new CustomPerson({
      id: ctx.getActorUri(handle),
      name: "Me",  // Display name
      summary: "This is me! (hi ben)",  // Bio
      preferredUsername: handle,  // Bare handle
      url: new URL("/", ctx.url),
      inbox: ctx.getInboxUri(handle),  // Inbox URI
      outbox: ctx.getOutboxUri(handle),
      endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
      assertionMethods: (await ctx.getActorKeyPairs(handle))
        .map((pair) => pair.multikey),
      // endpoints: new Endpoints({
      //   sharedInbox: new URL("/inbox", ctx.url)
      // })
      publicKeys: (await ctx.getActorKeyPairs(handle))
        .map(keyPair => keyPair.cryptographicKey),
    });
    return actor
  })
  .setKeyPairsDispatcher(async (ctx, handle) => {
    if (handle != "me") return [];  // Other than "me" is not found.
    const entry = await kv.get<{ privateKey: unknown, publicKey: unknown }>(["key"]);
    if (!entry) {
      // Generate a new key pair at the first time:
      const { privateKey, publicKey } =
        await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
      // Store the generated key pair to the Deno KV database in JWK format:
      await kv.set(
        ["key"],
        {
          privateKey: await exportJwk(privateKey),
          publicKey: await exportJwk(publicKey),
        }
      );
      return [{ privateKey, publicKey }];
    }
    // Load the key pair from the KV database:
    // @ts-expect-error not parsing privateKey
    const privateKey = await importJwk(entry.privateKey, "private");
    // @ts-expect-error not parsing publicKey
    const publicKey = await importJwk(entry.publicKey, "public");
    return [{ privateKey, publicKey }];
  });

const notes = [
  {
    id: '0',
    content: 'i am 0',
  }
]
federation.setObjectDispatcher(
  Note,
  "/users/{handle}/notes/{id}",
  async (ctx, { handle, id }) => {
    // Work with the database to find the note by the author's handle and the note ID.
    const note = notes.find(n => n?.id === id)
    if (note == null) return null;  // Return null if the note is not found.
    return new Note({
      id: ctx.getObjectUri(Note, { handle, id }),
      content: note.content,
    });
  }
);

// add an outboxDispatcher for /users/me so the actor has an outbox of recent posts
federation.setOutboxDispatcher("/users/{handle}/outbox", async (ctx, handle) => {
  return  {
    totalItems: 1,
    items: [
      new Create({
        id: new URL(`/posts/0#activity`, ctx.url),
        actor: ctx.getActorUri(handle),
        published: toTemporalInstant.call(new Date),
        to: new URL("https://www.w3.org/ns/activitystreams#Public"),
        object: new Article({
          id: new URL(`/posts/0`, ctx.url),
          summary: 'this is a test post summary',
          content: 'this is a test post content',
          published: toTemporalInstant.call(new Date)
        }),
      })
    ]
  }
}).setCounter(async () => {
  return 1
})

// make hono app from fedify federation
// + add an html home page that renders followers from kv

import { Hono } from "hono";
import * as fedifyHono from "@fedify/fedify/x/hono";

export const app = new Hono
app.use(fedifyHono.federation(federation, () => undefined))
app.get('/', async (ctx) => {
  const followersFromKv = await kv.get<Array<string>|undefined>(["followers"])
  return new Response(
    `
    <h1>Followers</h1>
    ${followersFromKv ? `<ul>${followersFromKv.map(
      follower => `<li>${follower}</li>`
    ).join('\n')}</ul>` : ''}
    `,
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
})

// serve app on http

import { serve } from "@hono/node-server";
import { behindProxy } from "x-forwarded-fetch";
import { fileURLToPath } from 'url';

const filePath = fileURLToPath(import.meta.url)
const processPath = process.argv[1]

if (filePath === processPath) {
  const port = parseInt(process.env.PORT || '8000')
  const server = serve({
    port,
    fetch: behindProxy(app.fetch),
  }).once('listening', () => {
    console.debug('listening', server.address())
  });
}
