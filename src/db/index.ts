import SqliteDb from 'better-sqlite3'
import fs from 'fs'
import { Kysely, Migrator, SqliteDialect } from 'kysely'
import path from 'path'
import { AtUri } from '@atproto/syntax'
import * as crypto from '@atproto/crypto'
import { mainMigrationProvider, tLMigrationProvider } from './migrations'
import type { MainDatabaseSchema, TLDatabaseSchema } from './schema'
import { env } from '../util/config'

export const createMainDb = async (): Promise<MainDatabase> => {
  if (!fs.existsSync(env.FEEDGEN_DATA_DIRECTORY)) {
    fs.mkdirSync(env.FEEDGEN_DATA_DIRECTORY, {recursive: true})
  }
  const db = new Kysely<MainDatabaseSchema>({
    dialect: new SqliteDialect({
      database: new SqliteDb(path.join(env.FEEDGEN_DATA_DIRECTORY, 'main.sqlite')),
    }),
  })
  const migrator = new Migrator({ db, provider: mainMigrationProvider })
  const { error } = await migrator.migrateToLatest()
  if (error) throw error
  return db
}

export const createTLDb = async (did: string, algoShortname: string): Promise<TLDatabase | undefined> => {
  try {
    const location = await getTLDbLocation(did, algoShortname)
    const dir = path.dirname(location)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {recursive: true})
    }
    const db = new Kysely<TLDatabaseSchema>({
      dialect: new SqliteDialect({
        database: new SqliteDb(location),
      }),
    })
    const migrator = new Migrator({ db, provider: tLMigrationProvider })
    const { error } = await migrator.migrateToLatest()
    if (error) throw error
    return db
  } catch {
    return undefined
  }
}

export const getRepoLocation = async (did: string): Promise<string> => {
  const didHash = await crypto.sha256Hex(did)
  return path.join(env.FEEDGEN_DATA_DIRECTORY, 'actors', didHash.slice(0, 2), did)
}

export const getTLDbLocation = async (did: string, algoShortname: string): Promise<string> => {
  return path.join(await getRepoLocation(did), 'lists', algoShortname, `timeline.sqlite`)
}

export const getTLDbs = async (db: MainDatabase, did: string): Promise<{list: string, algoShortname: string, db: TLDatabase}[]> => {
  const tLDbs : {list: string, algoShortname: string, db: TLDatabase}[] = []
  const listitems = await db
    .selectFrom('listitem')
    .selectAll()
    .where('subject', '=', did)
    .execute()
  for (const listitem of listitems) {
    const listUri = new AtUri(listitem.list)
    const list = await db
      .selectFrom('list')
      .selectAll()
      .where('uri', '=', listitem.list)
      .executeTakeFirst()
    if (list) {
      const tLDb = await createTLDb(listUri.host, list.algoShortname)
      if (tLDb) tLDbs.push({list: listUri.toString(), algoShortname: list.algoShortname, db: tLDb})
    } else {
      await db
        .deleteFrom('listitem')
        .where('list', '=', listitem.list)
        .execute()
    }
  }
  return tLDbs
}

export type MainDatabase = Kysely<MainDatabaseSchema>
export type TLDatabase = Kysely<TLDatabaseSchema>
