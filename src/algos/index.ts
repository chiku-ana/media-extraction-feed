import { AtpAgent } from '@atproto/api'
import { IdResolver } from '@atproto/identity'
import {
  type QueryParams,
  type OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { type AppContext } from '../util/config'
import * as extractMedia1 from './extract-media-1'
import * as extractMedia2 from './extract-media-2'
import * as extractMedia3 from './extract-media-3'

type AlgoHandler = (ctx: AppContext, params: QueryParams, requesterDid: string) => Promise<AlgoOutput>

export const algos: Record<string, AlgoHandler> = {
  [extractMedia1.shortname]: extractMedia1.handler,
  [extractMedia2.shortname]: extractMedia2.handler,
  [extractMedia3.shortname]: extractMedia3.handler,
}

export const algoShortnames: Record<string, string> = {
  [extractMedia1.listname]: extractMedia1.shortname,
  [extractMedia2.listname]: extractMedia2.shortname,
  [extractMedia3.listname]: extractMedia3.shortname,
}

type RecordType = {
  $type?: 'com.atproto.repo.listRecords#record'
  uri: string
  cid: string
  value: { [_ in string]: unknown }
}

const idResolver = new IdResolver()

export const getAllRecordLists = async (repo: string, collection: string, records: RecordType[] = [], agent?: AtpAgent, cursor?: string): Promise<RecordType[]> => {
  try {
    if (!agent) {
      const didDoc = await idResolver.did.resolve(repo)
      if (!didDoc?.service) {
        return records
      }
      agent = new AtpAgent({service: didDoc.service[0].serviceEndpoint as string})
    }
    const res = await agent.com.atproto.repo.listRecords({
      repo,
      collection,
      cursor,
      limit: 100,
    })
    if (!res.success) throw new Error()
    records.push(...res.data.records)
    if (res.data.cursor) await getAllRecordLists(repo, collection, records, agent, res.data.cursor)
  } catch {
    await getAllRecordLists(repo, collection, records, agent, cursor)
  }
  return records
}
