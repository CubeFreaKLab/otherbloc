import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'
import { apiUrl } from './gatewayClient'

const graphqlUrl =
  import.meta.env.VITE_GRAPHQL_URL || apiUrl + '/interactions'

export const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: graphqlUrl }),
  cache: new InMemoryCache(),
})
