import { Kysely, type Migration, type MigrationProvider } from 'kysely'

const mainMigrations: Record<string, Migration> = {}

export const mainMigrationProvider: MigrationProvider = {
  async getMigrations() {
    return mainMigrations
  },
}

mainMigrations['001'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('list')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('algoShortname', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('listitem')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('list', 'varchar', (col) => col.notNull())
      .addColumn('subject', 'varchar', (col) => col.notNull())
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('list').execute()
    await db.schema.dropTable('listitem').execute()
  },
}

const tLMigrations: Record<string, Migration> = {}

export const tLMigrationProvider: MigrationProvider = {
  async getMigrations() {
    return tLMigrations
  },
}

tLMigrations['001'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('post')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('repost', 'varchar')
      .addColumn('cursor', 'varchar', (col) => col.notNull())
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('repost')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('subject', 'varchar', (col) => col.notNull())
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('post').execute()
    await db.schema.dropTable('repost').execute()
  },
}
