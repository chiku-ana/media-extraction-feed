import { IngesterEvent } from 'atingester'
import fs from 'fs'
import { CID } from 'multiformats/cid'
import { AtpAgent } from '@atproto/api'
import { BlobRef, JsonBlobRef } from '@atproto/lexicon'
import { AtUri } from '@atproto/syntax'
import { algoShortnames } from './algos'
import { getRepoLocation, getTLDbLocation, getTLDbs, type MainDatabase } from './db'
import { ids, lexicons } from './lexicon/lexicons'
import { type Main as Images } from './lexicon/types/app/bsky/embed/images'
import { type Main as RecordWithMedia } from './lexicon/types/app/bsky/embed/recordWithMedia'
import { type Main as Video } from './lexicon/types/app/bsky/embed/video'
import { type Record as PostRecord } from './lexicon/types/app/bsky/feed/post'
import { type Record as RepostRecord } from './lexicon/types/app/bsky/feed/repost'
import { type ListItemView } from './lexicon/types/app/bsky/graph/defs'
import { type Record as ListRecord } from './lexicon/types/app/bsky/graph/list'
import { type Record as ListitemRecord } from './lexicon/types/app/bsky/graph/listitem'

const agent = new AtpAgent({service: 'https://public.api.bsky.app'})

export const handleEvent = async (evt: IngesterEvent, db: MainDatabase): Promise<void> => {
  if (evt.event === 'create') {
    if (evt.collection === ids.AppBskyFeedPost && isPost(evt.record)) {
      if (isImages(evt.record.embed) || isRecordWithMedia(evt.record.embed) || isVideo(evt.record.embed)) {
        for (const tLDb of await getTLDbs(db, evt.did)) {
          const indexedAt = new Date().toISOString()
          await tLDb.db
            .insertInto('post')
            .values({
              uri: evt.uri.toString(),
              cursor: indexedAt,
              indexedAt,
            })
            .onConflict((oc) => oc.doNothing())
            .execute()
        }
      }
    } else if (evt.collection === ids.AppBskyFeedRepost && isRepost(evt.record)) {
      for (const tLDb of await getTLDbs(db, evt.did)) {
        const repostedPostUri = new AtUri(evt.record.subject.uri)
        const repostedPost = await getPost(agent, repostedPostUri)
        if (isImages(repostedPost.value.embed) || isRecordWithMedia(repostedPost.value.embed) || isVideo(repostedPost.value.embed)) {
          const indexedAt = new Date().toISOString()
          await tLDb.db
            .insertInto('post')
            .values({
              uri: evt.record.subject.uri,
              repost: evt.uri.toString(),
              cursor: indexedAt,
              indexedAt,
            })
            .onConflict((oc) => oc
              .column('uri')
              .doUpdateSet((eb) => ({
                repost: eb.ref('excluded.repost'),
                cursor: eb.ref('excluded.cursor'),
              }))
            )
            .execute()
          await tLDb.db
            .insertInto('repost')
            .values({
              uri: evt.uri.toString(),
              subject: evt.record.subject.uri,
              indexedAt,
            })
            .onConflict((oc) => oc.doNothing())
            .execute()
        }
      }
    } else if (evt.collection === ids.AppBskyGraphList && isList(evt.record)) {
      if (evt.record.name in algoShortnames) {
        const tLDbLocation = await getTLDbLocation(evt.did, algoShortnames[evt.record.name])
        if (fs.existsSync(tLDbLocation)) await fs.promises.rm(tLDbLocation, {recursive: true, force: true})
        await db
          .deleteFrom('listitem')
          .where('list', '=', evt.uri.toString())
          .execute()
        await db
          .insertInto('list')
          .values({
            uri: evt.uri.toString(),
            algoShortname: algoShortnames[evt.record.name],
          })
          .onConflict((oc) => oc
            .column('uri')
            .doUpdateSet((eb) => ({
              algoShortname: eb.ref('excluded.algoShortname'),
            }))
          )
          .execute()
        for (const item of await getAllListItems(evt.uri.toString())) {
          await db
            .insertInto('listitem')
            .values({
              uri: item.uri,
              list: evt.uri.toString(),
              subject: item.subject.did,
            })
            .onConflict((oc) => oc.doNothing())
            .execute()
        }
      }
    } else if (evt.collection === ids.AppBskyGraphListitem && isListitem(evt.record)) {
      const list = await db
        .selectFrom('list')
        .selectAll()
        .where('uri', '=', evt.record.list)
        .executeTakeFirst()
      if (list) {
        await db
          .insertInto('listitem')
          .values({
            uri: evt.uri.toString(),
            list: evt.record.list,
            subject: evt.record.subject,
          })
          .onConflict((oc) => oc.doNothing())
          .execute()
      }
    }
  }

  if (evt.event === 'update') {
    if (evt.collection === ids.AppBskyGraphList && isList(evt.record)) {
      if (evt.record.name in algoShortnames) {
        await db
          .insertInto('list')
          .values({
            uri: evt.uri.toString(),
            algoShortname: algoShortnames[evt.record.name],
          })
          .onConflict((oc) => oc
            .column('uri')
            .doUpdateSet((eb) => ({
              algoShortname: eb.ref('excluded.algoShortname'),
            }))
          )
          .execute()
        for (const item of await getAllListItems(evt.uri.toString())) {
          await db
            .insertInto('listitem')
            .values({
              uri: item.uri,
              list: evt.uri.toString(),
              subject: item.subject.did,
            })
            .onConflict((oc) => oc.doNothing())
            .execute()
        }
      } else if (await db.selectFrom('list').selectAll().where('uri', '=', evt.uri.toString()).executeTakeFirst()) {
        const res = await db
          .selectFrom('list')
          .selectAll()
          .where('uri', '=', evt.uri.toString())
          .executeTakeFirst()
        if (res) {
          await db
            .deleteFrom('list')
            .where('uri', '=', evt.uri.toString())
            .execute()
          const tLDbLocation = await getTLDbLocation(evt.did, res.algoShortname)
          if (fs.existsSync(tLDbLocation)) await fs.promises.rm(tLDbLocation, {recursive: true, force: true})
        }
        await db
          .deleteFrom('listitem')
          .where('list', '=', evt.uri.toString())
          .execute()
      }
    }
  }

  if (evt.event === 'delete') {
    if (evt.collection === ids.AppBskyFeedPost) {
      for (const tLDb of await getTLDbs(db, evt.did)) {
        await tLDb.db
          .deleteFrom('post')
          .where('uri', '=', evt.uri.toString())
          .execute()
        await tLDb.db
          .deleteFrom('repost')
          .where('subject', '=', evt.uri.toString())
          .execute()
      }
    } else if (evt.collection === ids.AppBskyFeedRepost) {
      for (const tLDb of await getTLDbs(db, evt.did)) {
        const res = await tLDb.db
          .selectFrom('repost')
          .selectAll()
          .where('uri', '=', evt.uri.toString())
          .executeTakeFirst()
        if (res) {
          await tLDb.db
            .deleteFrom('repost')
            .where('uri', '=', evt.uri.toString())
            .execute()
          const repost = await tLDb.db
            .selectFrom('repost')
            .selectAll()
            .where('subject', '=', res.subject)
            .orderBy('indexedAt', 'desc')
            .executeTakeFirst()
          if (repost) {
            await tLDb.db
              .insertInto('post')
              .values({
                uri: res.subject,
                repost: repost.uri,
                cursor: repost.indexedAt,
                indexedAt: repost.indexedAt,
              })
              .onConflict((oc) => oc
                .column('uri')
                .doUpdateSet((eb) => ({
                  repost: eb.ref('excluded.repost'),
                  cursor: eb.ref('excluded.cursor'),
                }))
              )
              .execute()
          } else {
            const item = await db
              .selectFrom('listitem')
              .selectAll()
              .where('list', '=', tLDb.list)
              .where('subject', '=', new AtUri(res.subject).host)
              .executeTakeFirst()
            if (item) {
              const post = await tLDb.db
                .selectFrom('post')
                .selectAll()
                .where('uri', '=', res.subject)
                .executeTakeFirst()
              const indexedAt = post ? post.indexedAt : (await getPost(agent, new AtUri(res.subject))).value.indexedAt as string
              await tLDb.db
                .insertInto('post')
                .values({
                  uri: res.subject,
                  cursor: indexedAt,
                  indexedAt,
                })
                .onConflict((oc) => oc
                  .column('uri')
                  .doUpdateSet((eb) => ({
                    repost: eb.ref('excluded.repost'),
                    cursor: eb.ref('excluded.cursor'),
                  }))
                )
                .execute()
            } else {
              await tLDb.db
                .deleteFrom('post')
                .where('uri', '=', res.subject)
                .execute()
            }
          }
        }
      }
    } else if (evt.collection === ids.AppBskyGraphList) {
      const res = await db
        .selectFrom('list')
        .selectAll()
        .where('uri', '=', evt.uri.toString())
        .executeTakeFirst()
      if (res) {
        await db
          .deleteFrom('list')
          .where('uri', '=', evt.uri.toString())
          .execute()
        const tLDbLocation = await getTLDbLocation(evt.did, res.algoShortname)
        if (fs.existsSync(tLDbLocation)) await fs.promises.rm(tLDbLocation, {recursive: true, force: true})
      }
      await db
        .deleteFrom('listitem')
        .where('list', '=', evt.uri.toString())
        .execute()
    } else if (evt.collection === ids.AppBskyGraphListitem) {
      await db
        .deleteFrom('listitem')
        .where('uri', '=', evt.uri.toString())
        .execute()
    }
  }

  if (evt.event === 'account') {
    if (evt.status === 'deleted') {
      for (const tLDb of await getTLDbs(db, evt.did)) {
        await tLDb.db
          .deleteFrom('post')
          .where('uri', 'like', `at://${evt.did}/%`)
          .execute()
        await tLDb.db
          .deleteFrom('repost')
          .where('uri', 'like', `at://${evt.did}/%`)
          .execute()
      }
      await db
        .deleteFrom('list')
        .where('uri', 'like', `at://${evt.did}/%`)
        .execute()
      await db
        .deleteFrom('listitem')
        .where((eb) => eb.or([
          eb('uri', 'like', `at://${evt.did}/%`),
          eb('list', 'like', `at://${evt.did}/%`),
          eb('subject', '=', evt.did),
        ]))
        .execute()
      const repoLocation = await getRepoLocation(evt.did)
      if (fs.existsSync(repoLocation)) await fs.promises.rm(repoLocation, {recursive: true, force: true})
    }
  }
}

const getPost = async (agent: AtpAgent, uri: AtUri): Promise<{uri: string, cid: string, value: PostRecord}> => {
  try {
    return await agent.getPost({repo: uri.host, rkey: uri.rkey})
  } catch {
    return await getPost(agent, uri)
  }
}

export const getAllListItems = async (list: string, items: ListItemView[] = [], cursor?: string): Promise<ListItemView[]> => {
  try {
    const res = await agent.app.bsky.graph.getList({
      list,
      cursor,
      limit: 100,
    })
    if (!res.success) throw new Error()
    items.push(...res.data.items)
    if (res.data.cursor) await getAllListItems(list, items, res.data.cursor)
  } catch {
    await getAllListItems(list, items, cursor)
  }
  return items
}

export const isImages = (obj: unknown): obj is Images => {
  return validate(obj, ids.AppBskyEmbedImages)
}

export const isRecordWithMedia = (obj: unknown): obj is RecordWithMedia => {
  return validate(obj, ids.AppBskyEmbedRecordWithMedia)
}

export const isVideo = (obj: unknown): obj is Video => {
  return validate(obj, ids.AppBskyEmbedVideo)
}

export const isPost = (obj: unknown): obj is PostRecord => {
  return isType(obj, ids.AppBskyFeedPost)
}

export const isRepost = (obj: unknown): obj is RepostRecord => {
  return isType(obj, ids.AppBskyFeedRepost)
}

export const isList = (obj: unknown): obj is ListRecord => {
  return isType(obj, ids.AppBskyGraphList)
}

export const isListitem = (obj: unknown): obj is ListitemRecord => {
  return isType(obj, ids.AppBskyGraphListitem)
}

const validate = (obj: unknown, nsid: string) => {
  try {
    const result = lexicons.validate(nsid, fixBlobRefs(obj))
    return result.success
  } catch (err) {
    return false
  }
}

const isType = (obj: unknown, nsid: string) => {
  try {
    lexicons.assertValidRecord(nsid, fixBlobRefs(obj))
    return true
  } catch (err) {
    return false
  }
}

// @TODO right now record validation fails on BlobRefs
// simply because multiple packages have their own copy
// of the BlobRef class, causing instanceof checks to fail.
// This is a temporary solution.
const fixBlobRefs = (obj: unknown): unknown => {
  if (Array.isArray(obj)) {
    return obj.map(fixBlobRefs)
  }
  if (obj && typeof obj === 'object') {
    if (obj.constructor.name === 'BlobRef') {
      const blob = obj as BlobRef
      return new BlobRef(blob.ref, blob.mimeType, blob.size, blob.original)
    }
    if ('$type' in obj && obj.$type === 'blob') {
      if ('ref' in obj && obj.ref && typeof obj.ref === 'object' && '$link' in obj.ref && typeof obj.ref.$link === 'string') {
        obj.ref = CID.parse(obj.ref.$link)
      }
      const json = obj as JsonBlobRef
      return BlobRef.fromJsonRef(json)
    }
    return Object.entries(obj).reduce((acc, [key, val]) => {
      return Object.assign(acc, { [key]: fixBlobRefs(val) })
    }, {} as Record<string, unknown>)
  }
  return obj
}
