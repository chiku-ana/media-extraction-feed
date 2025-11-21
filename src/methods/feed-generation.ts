import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { algos } from '../algos'
import { validateAuth } from '../auth'
import { Server } from '../lexicon'
import { ids } from '../lexicon/lexicons'
import { type AppContext, env } from '../util/config'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req }) => {
    const feedUri = new AtUri(params.feed)
    const algo = algos[feedUri.rkey]
    if (
      feedUri.hostname !== env.FEEDGEN_PUBLISHER_DID ||
      feedUri.collection !== ids.AppBskyFeedGenerator ||
      !algo
    ) {
      throw new InvalidRequestError(
        'Unsupported algorithm',
        'UnsupportedAlgorithm',
      )
    }
    
    const requesterDid = await validateAuth(
      req,
      env.FEEDGEN_SERVICE_DID,
      ctx.didResolver,
    )

    const body = await algo(ctx, params, requesterDid)
    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
