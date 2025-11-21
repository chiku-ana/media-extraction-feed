/*import fs from 'fs'
import { AtpAgent } from '@atproto/api'
import { algoShortnames, getAllRecordLists } from './'
import { getRepoLocation, getTLDbLocation, getTLDbs, type MainDatabase } from '../db'
import { ids } from '../lexicon/lexicons'
import {
  type QueryParams,
  type OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { type AppContext } from '../util/config'

// max 15 chars
export const shortname = 'extract-media-1'

export const listname = 'for Extract Media 1'

const agent = new AtpAgent({service: 'https://public.api.bsky.app'})
export const handler = async (ctx: AppContext, params: QueryParams, requesterDid: string): Promise<AlgoOutput> => {
  if (!params.cursor) {
    const res = await ctx.db
      .selectFrom('list')
      .selectAll()
      .where('uri', 'like', `at://${requesterDid}/app.bsky.graph.list/%`)
      .where('algoShortname', '=', shortname)
      .executeTakeFirst()
  }
  if (!fs.existsSync(await getTLDbLocation(requesterDid, shortname))) {
    const lists = await getAllRecordLists(requesterDid, ids.AppBskyGraphList)
    for (const list of lists) {
      if ('name' in list.value && typeof list.value.name === 'string' && list.value.name in algoShortnames && algoShortnames[list.value.name] === shortname) {
        //dbつくる
        return {feed: [{post: 'at://did:plc:x2tb2kedzdvssswh4umkal6y/app.bsky.feed.post/3m64kmnhkd22l'}]} // さくせいしました
      }
    }
    return {feed: [{post: 'at://did:plc:x2tb2kedzdvssswh4umkal6y/app.bsky.feed.post/3m64kmnhkd22l'}]} // feedの紹介文
  }
  let builder = ctx.db
    .selectFrom('post')
    .selectAll()
    .orderBy('cursor', 'desc')
    .limit(params.limit)

  if (params.cursor) {
    const timeStr = new Date(parseInt(params.cursor, 10)).toISOString()
    builder = builder.where('post.indexedAt', '<', timeStr)
  }
  const res = await builder.execute()

  const feed = res.map((row) => ({
    post: row.uri,
  }))

  let cursor: string | undefined
  const last = res.at(-1)
  if (last) {
    cursor = new Date(last.indexedAt).getTime().toString(10)
  }

  return {
    cursor,
    feed,
  }
}*/
