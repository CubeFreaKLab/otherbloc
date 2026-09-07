export const typeDefs = `#graphql
  type ServiceStatus {
    service: String!
    status: String!
    transport: String!
  }

  type Query {
    serviceStatus: ServiceStatus!
    publication(id: ID!, userId: ID): Publication
    authorInteractions(authorId: ID!, userId: ID): AuthorInteractions!
    savedPublications(userId: ID, limit: Int = 20, cursor: String): SavedConnection!
    followingAuthors(userId: ID, limit: Int = 20, cursor: String): FollowConnection!
  }

  type PublicUser { id: ID!, name: String!, biography: String!, role: String!, avatarUrl: String, demo: Boolean! }
  type PublicationBlock { id: ID!, type: String!, text: String, level: Int, items: [String!], ordered: Boolean, attribution: String, assetId: ID, alt: String, caption: String, url: String }
  type Publication {
    id: ID!, slug: String!, title: String!, summary: String!, authorId: ID!, author: PublicUser
    type: String!, category: String!, tags: [String!]!, status: String!, version: Int!, demo: Boolean!
    image: String, imageAlt: String!, coverWidth: Int, coverHeight: Int, publishedAt: String, date: String, readingMinutes: Int!, blocks: [PublicationBlock!]!
    comments(limit: Int = 20, cursor: String): CommentConnection!
    commentCount: Int!, reactions: ReactionState!, saved: Boolean!, followingAuthor: Boolean!
  }
  type Comment { id: ID!, publicationId: ID!, userId: ID!, author: PublicUser, text: String!, createdAt: String!, deleted: Boolean!, canDelete: Boolean! }
  type CommentConnection { items: [Comment!]!, nextCursor: String }
  type ReactionState { active: Boolean!, count: Int! }
  type RelationState { active: Boolean! }
  type AuthorInteractions { author: PublicUser, following: Boolean!, followerCount: Int! }
  type SavedItem { id: ID!, publicationId: ID!, savedAt: String!, publication: Publication }
  type SavedConnection { items: [SavedItem!]!, nextCursor: String }
  type FollowItem { id: ID!, authorId: ID!, followedAt: String!, author: PublicUser }
  type FollowConnection { items: [FollowItem!]!, nextCursor: String }
  input AddCommentInput { id: ID!, publicationId: ID!, text: String! }
  type Mutation {
    addComment(input: AddCommentInput!, userId: ID): Comment!
    deleteComment(id: ID!, userId: ID): Boolean!
    savePublication(publicationId: ID!, saved: Boolean! = true, userId: ID): RelationState!
    reactToPublication(publicationId: ID!, active: Boolean! = true, userId: ID): RelationState!
    followAuthor(authorId: ID!, following: Boolean! = true, userId: ID): RelationState!
  }
`
