export const typeDefs = `#graphql
  type ServiceStatus {
    service: String!
    status: String!
    transport: String!
  }

  type Query {
    serviceStatus: ServiceStatus!
  }
`
