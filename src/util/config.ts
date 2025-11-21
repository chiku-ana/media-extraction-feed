import dotenv from 'dotenv'
import { cleanEnv, host, num, port, str, testOnly, url } from 'envalid'
import { DidResolver } from '@atproto/identity'
import { type MainDatabase } from '../db'
import { type Logger } from './logger'

export type AppContext = {
  db: MainDatabase
  didResolver: DidResolver
  logger: Logger
}

dotenv.config()

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    devDefault: testOnly('test'),
    choices: ['development', 'test', 'production'],
  }),
  FEEDGEN_PORT: port({
    devDefault: testOnly(3000),
  }),
  FEEDGEN_LISTENHOST: host({
    devDefault: testOnly('localhost'),
  }),
  FEEDGEN_DATA_DIRECTORY: str({
    devDefault: './data',
  }),
  FEEDGEN_SUBSCRIPTION_MODE: str({
    devDefault: testOnly('Firehose'),
    choices: ['Firehose', 'Jetstream', 'Turbostream'],
  }),
  FEEDGEN_SUBSCRIPTION_FIREHOSE_ENDPOINT: url({
    default: 'wss://bsky.network',
  }),
  FEEDGEN_SUBSCRIPTION_JETSTREAM_ENDPOINT: url({
    default: 'wss://jetstream1.us-east.bsky.network',
  }),
  FEEDGEN_SUBSCRIPTION_TURBOSTREAM_ENDPOINT: url({
    default: 'wss://api.graze.social',
  }),
  FEEDGEN_HOSTNAME: host({
    devDefault: testOnly('example.com'),
  }),
  FEEDGEN_PUBLISHER_DID: str({
    devDefault: testOnly('did:example:alice')
  }),
  FEEDGEN_SERVICE_DID: str({
    default: `did:web:${process.env.FEEDGEN_HOSTNAME ? process.env.FEEDGEN_HOSTNAME : 'example.com'}`,
  }),
  FEEDGEN_SUBSCRIPTION_RECONNECT_DELAY: num({
    default: 3000
  }),
})
