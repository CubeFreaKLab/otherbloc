import { gql } from '@apollo/client'
import { queryInteractions, mutateInteractions } from './apolloClient'
import { publicationToArticle } from './publications'

const user = gql`fragment InteractionUser on PublicUser { id name biography role avatarUrl demo }`
const comment = gql`fragment CommentFields on Comment { id publicationId userId text createdAt deleted canDelete author { ...InteractionUser } } ${user}`
const summary = gql`fragment PublicationSummary on Publication { id slug title summary authorId type category tags status version demo image imageAlt coverWidth coverHeight publishedAt date readingMinutes author { ...InteractionUser } } ${user}`
const publicationQuery = gql`query ReadingPublication($id: ID!) { publication(id: $id) {
  ...PublicationSummary
  blocks { id type text formatted { text bold italic href } formattedItems { runs { text bold italic href } } level items ordered attribution assetId alt caption url }
  comments { items { ...CommentFields } nextCursor } commentCount reactions { active count } saved followingAuthor
} } ${summary} ${comment}`
const commentsQuery = gql`query PublicationComments($id: ID!, $cursor: String) { publication(id: $id) { id commentCount comments(cursor: $cursor) { items { ...CommentFields } nextCursor } } } ${comment}`
const authorQuery = gql`query AuthorFollowing($id: ID!) { authorInteractions(authorId: $id) { author { ...InteractionUser } following followerCount } } ${user}`
const savedQuery = gql`query SavedReading($cursor: String) { savedPublications(cursor: $cursor) { items { id publicationId savedAt publication { ...PublicationSummary } } nextCursor } } ${summary}`
const followsQuery = gql`query FollowedAuthors($cursor: String) { followingAuthors(cursor: $cursor) { items { id authorId followedAt author { ...InteractionUser } } nextCursor } } ${user}`
const saveMutation = gql`mutation SaveReading($id: ID!, $active: Boolean!) { savePublication(publicationId: $id, saved: $active) { active } }`
const reactionMutation = gql`mutation ReactToReading($id: ID!, $active: Boolean!) { reactToPublication(publicationId: $id, active: $active) { active } }`
const followMutation = gql`mutation FollowWriter($id: ID!, $active: Boolean!) { followAuthor(authorId: $id, following: $active) { active } }`
const commentMutation = gql`mutation WriteComment($input: AddCommentInput!) { addComment(input: $input) { ...CommentFields } } ${comment}`
const deleteMutation = gql`mutation DeleteOwnComment($id: ID!) { deleteComment(id: $id) }`
const engagementQuery = gql`query ReadingEngagement($id: ID!) { publication(id: $id) { id commentCount reactions { active count } saved followingAuthor } }`
const requestKey = (path) => new URL(path, 'https://otherbloc.invalid')

export async function loadInteractionPublication(path, options) {
  const id = decodeURIComponent(requestKey(path).pathname.split('/').pop())
  const { publication } = await queryInteractions(publicationQuery, { id }, options)
  return { publication: publicationToArticle(publication, publication.author) }
}
export async function loadComments(id, cursor, options) {
  const { publication } = await queryInteractions(commentsQuery, { id, cursor }, options)
  return { ...publication.comments, total: publication.commentCount }
}
export const loadEngagement = async (id) => (await queryInteractions(engagementQuery, { id })).publication
export async function loadAuthorInteractions(path, options) {
  const id = decodeURIComponent(requestKey(path).pathname.split('/').pop())
  return (await queryInteractions(authorQuery, { id }, options)).authorInteractions
}
export async function loadSavedPublications(path, options) {
  const cursor = requestKey(path).searchParams.get('cursor')
  const result = (await queryInteractions(savedQuery, { cursor }, options)).savedPublications
  return { ...result, items: result.items.map((item) => ({ ...item, publication: item.publication ? publicationToArticle(item.publication, item.publication.author) : null })) }
}
export async function loadFollowingAuthors(path, options) {
  const cursor = requestKey(path).searchParams.get('cursor')
  return (await queryInteractions(followsQuery, { cursor }, options)).followingAuthors
}
export const saveReading = async (id, active) => (await mutateInteractions(saveMutation, { id, active })).savePublication.active
export const reactToReading = async (id, active) => (await mutateInteractions(reactionMutation, { id, active })).reactToPublication.active
export const followWriter = async (id, active) => (await mutateInteractions(followMutation, { id, active })).followAuthor.active
export const writeComment = async (input) => (await mutateInteractions(commentMutation, { input })).addComment
export const deleteOwnComment = async (id) => (await mutateInteractions(deleteMutation, { id })).deleteComment
