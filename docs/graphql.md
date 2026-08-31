# GraphQL

GraphQL is limited to the Interactions service. The initial schema exposes one operational query:

```graphql
query ServiceStatus {
  serviceStatus {
    service
    status
    transport
  }
}
```

The endpoint is `POST /graphql` on port 3003 during local development. The request context assigns a request identifier and is prepared for later authentication context. Domain queries and mutations remain deferred.
