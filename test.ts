import { AtpAgent } from '@atproto/api'
import { getAllRecordLists } from './src/algos'
import { createTLDb } from './src/db'

const run = async () => {
  const did = 'did:plc:x2tb2kedzdvssswh4umkal6y'
  const algoShortname = `extract-media-1`

  console.log('did: ', did)
  console.log('algoShortname: ', algoShortname)
  const db = await createTLDb(did, algoShortname)
  if (db) {
    console.log('done')
  }
  const list = await getAllRecordLists(did, 'app.bsky.graph.list')
  console.log(list)
}

run()
