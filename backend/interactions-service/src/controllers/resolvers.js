import { getServiceStatus } from '../services/getServiceStatus.js'
import { fail, parse, requireIdentity } from '../lib/errors.js'
import { commentSchema, idSchema, userIdSchema } from '../models/interaction.js'

const owner = (context, userId) => requireIdentity(context.identity, userId)
const personalization = (context, userId) => { if (userId != null) owner(context, userId) }
const stats = (context, id) => context.memo('publication-stats:' + id, () => context.service.publicationStats(id))
async function published(context, id) {
  const result = await context.domains.publication(parse(idSchema, id))
  if (!result) fail('NOT_FOUND', 'No encontramos esta publicación pública.')
  return result
}
const ownState = (context, method, id) => context.memo(method + ':' + id, () => context.service[method](context.identity, id))

export const resolvers = {
  Query: {
    serviceStatus: () => getServiceStatus(),
    publication(_source, { id, userId }, context) { personalization(context, userId); return published(context, id) },
    async authorInteractions(_source, { authorId, userId }, context) {
      personalization(context, userId)
      parse(userIdSchema, authorId)
      const author = await context.domains.profile(authorId)
      if (!author || !['author', 'admin'].includes(author.role)) fail('NOT_FOUND', 'No encontramos este perfil de autor.')
      return { author, authorId }
    },
    savedPublications(_source, { userId, ...input }, context) { context.charge(); return context.service.savedPublications(owner(context, userId), input) },
    followingAuthors(_source, { userId, ...input }, context) { context.charge(); return context.service.followingAuthors(owner(context, userId), input) },
  },
  Publication: {
    author: (publication, _args, context) => context.domains.profile(publication.authorId),
    comments: (publication, args, context) => context.memo('comments:' + publication.id + ':' + JSON.stringify(args), () => context.service.comments(publication.id, args)),
    commentCount: async (publication, _args, context) => (await stats(context, publication.id)).commentCount,
    reactions: async (publication, _args, context) => ({ count: (await stats(context, publication.id)).reactionCount, active: await ownState(context, 'reacted', publication.id) }),
    saved: (publication, _args, context) => ownState(context, 'saved', publication.id),
    followingAuthor: (publication, _args, context) => ownState(context, 'following', publication.authorId),
  },
  Comment: {
    author: (comment, _args, context) => context.domains.profile(comment.userId),
    canDelete: (comment, _args, context) => context.identity?.id === comment.userId && !comment.deleted,
  },
  SavedItem: {
    savedAt: (item) => item.updatedAt,
    publication: (item, _args, context) => context.domains.publication(item.publicationId),
  },
  FollowItem: {
    followedAt: (item) => item.updatedAt,
    author: async (item, _args, context) => { const value = await context.domains.profile(item.authorId); return value && ['author', 'admin'].includes(value.role) ? value : null },
  },
  AuthorInteractions: {
    following: (value, _args, context) => ownState(context, 'following', value.authorId),
    followerCount: async (value, _args, context) => (await context.memo('author-stats:' + value.authorId, () => context.service.authorStats(value.authorId))).followerCount,
  },
  Mutation: {
    async addComment(_source, { input, userId }, context) {
      const identity = owner(context, userId), value = parse(commentSchema, input)
      await published(context, value.publicationId); context.charge()
      return context.service.addComment(identity, value)
    },
    deleteComment(_source, { id, userId }, context) { context.charge(); return context.service.deleteComment(owner(context, userId), id) },
    async savePublication(_source, { publicationId, saved, userId }, context) {
      const identity = owner(context, userId); parse(idSchema, publicationId)
      if (saved) await published(context, publicationId)
      context.charge(); return context.service.save(identity, publicationId, saved)
    },
    async reactToPublication(_source, { publicationId, active, userId }, context) {
      const identity = owner(context, userId); parse(idSchema, publicationId)
      if (active) await published(context, publicationId)
      context.charge(); return context.service.react(identity, publicationId, active)
    },
    async followAuthor(_source, { authorId, following, userId }, context) {
      const identity = owner(context, userId); parse(userIdSchema, authorId)
      if (following) {
        const author = await context.domains.profile(authorId)
        if (!author || !['author', 'admin'].includes(author.role)) fail('NOT_FOUND', 'No encontramos este perfil de autor.')
      }
      context.charge(); return context.service.follow(identity, authorId, following)
    },
  },
}
