export type MainDatabaseSchema = {
  list: List
  listitem: Listitem
}

export type List = {
  uri: string
  algoShortname: string
}

export type Listitem = {
  uri: string
  list: string
  subject: string
}

export type TLDatabaseSchema = {
  post: Post
  repost: Repost
}

export type Post = {
  uri: string
  repost?: string
  cursor: string
  indexedAt: string
}

export type Repost = {
  uri: string
  subject: string
  indexedAt: string
}
