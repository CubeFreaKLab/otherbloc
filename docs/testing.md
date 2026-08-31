# Testing

The foundation uses Node's built-in test runner for repository contracts and backend integration checks. The frontend is verified through a production build and targeted browser inspection.

## Full local verification

Run both commands from the repository root:

```bash
npm test
npm run build
```

`npm test` first checks the repository layout, independent service entry points, assigned ports, and frontend-to-gateway boundaries. It then runs each backend workspace's tests against an ephemeral local server. The Interactions suite also executes the initial GraphQL operation.

`npm run build` compiles the React application with Vite. This catches module resolution, asset, JSX, and production bundling failures.

## Continuous integration

The Foundation CI workflow installs dependencies from the lockfile, runs the complete test command, and builds the frontend on pushes and pull requests. It does not deploy applications or require credentials.

## Test boundaries

The current suites confirm only the initial architecture and operational contracts. Domain rules, authentication, persistence, security policies, gateway forwarding, and browser automation belong with the milestones that introduce those behaviors.
