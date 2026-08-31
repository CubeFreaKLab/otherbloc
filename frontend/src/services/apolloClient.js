import { ApolloClient, InMemoryCache } from '@apollo/client'

const graphqlUrl =
  import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:3000/api/interactions'

export const apolloClient = new ApolloClient({
  uri: graphqlUrl,
  cache: new InMemoryCache(),
})
