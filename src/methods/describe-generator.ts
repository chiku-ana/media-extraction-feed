import { AtUri } from '@atproto/syntax'
import { algos } from '../algos'
import { Server } from '../lexicon'
import { ids } from '../lexicon/lexicons'
import { env } from '../util/config'

export default function (server: Server) {
  server.app.bsky.feed.describeFeedGenerator(async () => {
    const feeds = Object.keys(algos).map((shortname) => ({
      uri: AtUri.make(
        env.FEEDGEN_PUBLISHER_DID,
        ids.AppBskyFeedGenerator,
        shortname,
      ).toString(),
    }))
    return {
      encoding: 'application/json',
      body: {
        did: env.FEEDGEN_SERVICE_DID,
        feeds,
      },
    }
  })
}
