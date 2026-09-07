# GraphQL interactions

Browser endpoint: `POST /api/interactions` on the gateway (3000). It forwards to `POST /graphql` on Interactions (3003). Direct requests to 3003 require the private service key; browsers must never receive that key. REST remains the Users and Content transport. The schema is in `backend/interactions-service/src/schema/typeDefs.js`.

## Reading and personal lists

```graphql
query Reading($id: ID!) {
  publication(id: $id) {
    id title summary
    author { id name biography }
    blocks { id type text level items ordered attribution alt caption url }
    comments(limit: 20) {
      items { id text createdAt author { id name } canDelete }
      nextCursor
    }
    commentCount
    reactions { active count }
    saved
    followingAuthor
  }
}

query MyLibrary($cursor: String) {
  savedPublications(limit: 20, cursor: $cursor) {
    items { id publicationId savedAt publication { id slug title } }
    nextCursor
  }
}
```

`publication(id)` composes only a currently published Content record, the author's public Users profile and Interactions-owned state. Drafts/review/archived records return `NOT_FOUND` even for their author or an administrator. Public comments are ordered oldest first, then ID. The displayed counters are persisted aggregates, not list-length estimates. Anonymous reading is allowed; personalized booleans are false for a visitor. `authorInteractions(authorId)` exposes the public author, total follower count and the current viewer's following state.

`savedPublications` and `followingAuthors` require authentication and return only the caller's relations. Both use update-date descending / ID ascending cursors. Limits default to 20 and accept 1–40. Cursors are bound to the list and account (or publication for comments); they cannot grant access to another scope. A removed/archived saved target has `publication: null`; an unavailable followed author has `author: null`. The relation remains removable. A service outage returns an error, not null or an empty list.

## Mutations

| Operation | Required input | Result |
| --- | --- | --- |
| `addComment(input)` | Client UUID `id`, `publicationId`, trimmed `text` of 1–2,000 characters | Saved comment, public author and `canDelete` |
| `deleteComment(id)` | ID of the caller's comment | `true`, including a retry of an already deleted own comment |
| `savePublication(publicationId, saved)` | Publication ID and desired boolean, default true | `{ active }` |
| `reactToPublication(publicationId, active)` | Publication ID and desired boolean, default true | `{ active }` |
| `followAuthor(authorId, following)` | Author ID and desired boolean, default true | `{ active }` |

The boolean operations set a desired state; they are not ambiguous toggles. Repeating the same request does not duplicate relations or counters. A retried comment must reuse the same UUID, author, publication and text; conflicting reuse fails. There is one reaction kind. Comment removal is author-only, including for administrators; removal hides its text from public results. No comment editing, nesting, arbitrary HTML, chat or notifications are included.

The optional `userId` argument exists only as a consistency check. If supplied, it must equal the authenticated user; omission means the current user. It is never an identity credential. Positive writes validate a public publication or active author through the owning HTTP service. Following oneself is rejected. Negative own relation writes are allowed when a target is no longer public, so personal lists can be cleaned up.

## Security and errors

The context validates the signed access JWT and calls Users' internal session check for current revocation/role/status. Forged, expired or revoked tokens fail; no user ID or role is trusted from browser headers. Context authentication failures use HTTP 401 so the shared browser client can attempt refresh. Resolver errors may use HTTP 200 with a GraphQL `errors` array; clients must check both transport and GraphQL errors.

Codes: `BAD_USER_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `SERVICE_UNAVAILABLE`, `OPERATION_LIMIT`. Internal messages/stack traces are not exposed. Responses are `private, no-store`. The application bounds JSON to 128 KB, expanded selections to 300, root selections to six, depth to ten, page sizes to 40 and logical resource work to 160 units. HTTP batching and automatic persisted queries are disabled; production introspection is disabled. These are safeguards, not a measured throughput claim. Gateway limits also apply.

Apollo Client executes actual queries/mutations through the existing Fetch gateway transport, sharing in-memory JWT and single-flight cookie refresh. Business responses use `no-cache`, query deduplication is disabled, and responses from an obsolete viewer are rejected. This avoids carrying personal state across accounts. No Firebase SDK, service credentials or business localStorage is present in the browser.

See [Apollo authentication](https://www.apollographql.com/docs/apollo-server/security/authentication), [error handling](https://www.apollographql.com/docs/apollo-server/data/errors), [server limits](https://www.apollographql.com/docs/apollo-server/api/apollo-server) and [Interactions ownership](interactions-service.md). Real-cloud deployment and k6 acceptance remain separate pending milestones.
