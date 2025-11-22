import fs from 'fs'
import { algoShortnames, getAllRecordLists } from './'
import { createTLDb, getTLDbLocation } from '../db'
import { ids } from '../lexicon/lexicons'
import {
  type QueryParams,
  type OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { getAllListItems } from '../subscription'
import { type AppContext } from '../util/config'

// max 15 chars
export const shortname = 'extract-media-1'

export const listname = 'for MEF 1'

export const handler = async (ctx: AppContext, params: QueryParams, requesterDid: string): Promise<AlgoOutput> => {
  const search = await ctx.db
    .selectFrom('list')
    .selectAll()
    .where('uri', 'like', `at://${requesterDid}/app.bsky.graph.list/%`)
    .where('algoShortname', '=', shortname)
    .executeTakeFirst()
  if (!search) {
    if (params.cursor) {
      return {feed: []}
    } else {
      const tLDbLocation = await getTLDbLocation(requesterDid, shortname)
      if (fs.existsSync(tLDbLocation)) await fs.promises.rm(tLDbLocation, {recursive: true, force: true})
      const lists = await getAllRecordLists(requesterDid, ids.AppBskyGraphList)
      for (const list of lists) {
        if ('name' in list.value && typeof list.value.name === 'string' && list.value.name in algoShortnames && algoShortnames[list.value.name] === shortname) {
          await ctx.db
            .insertInto('list')
            .values({
              uri: list.uri,
              algoShortname: shortname,
            })
            .onConflict((oc) => oc
              .column('uri')
              .doUpdateSet((eb) => ({
                algoShortname: eb.ref('excluded.algoShortname'),
              }))
            )
            .execute()
          for (const item of await getAllListItems(list.uri)) {
            await ctx.db
              .insertInto('listitem')
              .values({
                uri: item.uri,
                list: list.uri,
                subject: item.subject.did,
              })
              .onConflict((oc) => oc.doNothing())
              .execute()
          }
          return {feed: [{post: 'at://did:plc:rmpcdvowarn4rcz4slzl76k2/app.bsky.feed.post/3m67yev6u7c2q'}]} // さくせいしました
        }
      }
      return {feed: [{post: 'at://did:plc:rmpcdvowarn4rcz4slzl76k2/app.bsky.feed.post/3m67zkeeib22q'}]} // feedの紹介文
    }
  }

  const tLDb = await createTLDb(requesterDid, shortname)
  if (!tLDb) {
    if (params.cursor) {
      return {feed: []}
    } else {
      return {feed: [{post: 'at://did:plc:rmpcdvowarn4rcz4slzl76k2/app.bsky.feed.post/3m67ygh56os2q'}]} // db読み込みエラー
    }
  }
  let builder = tLDb
    .selectFrom('post')
    .selectAll()
    .orderBy('cursor', 'desc')
    .limit(params.limit)

  if (params.cursor) {
    const timeStr = new Date(parseInt(params.cursor, 10)).toISOString()
    builder = builder.where('post.cursor', '<', timeStr)
  }
  const res = await builder.execute()

  const feed = res.map((row) => ({
    post: row.uri,
  }))

  let cursor: string | undefined
  const last = res.at(-1)
  if (last) {
    cursor = new Date(last.cursor).getTime().toString(10)
  }

  return {
    cursor,
    feed,
  }
}
