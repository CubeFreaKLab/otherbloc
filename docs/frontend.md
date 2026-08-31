# Frontend

The frontend is a React application built with Vite. It owns the browser interface and communicates with backend services only through the API Gateway.

## Foundation

- React entry point with strict mode
- Browser routing for home, explore, article, login, registration, and profile views
- Apollo Client configured for the gateway interaction endpoint
- Fetch wrapper configured for gateway REST endpoints
- Locally hosted otherbloc fonts, marks, and editorial imagery
- Vite development and production build commands

## Application structure

The browser router defines the initial product surfaces:

- `/` for the publication home page
- `/explore` for topic discovery and filtering
- `/article/:slug` for long-form reading
- `/login` and `/register` for authentication entry points
- `/profile/:id?` for author and reader profiles

Shared interface modules live in `src/components`. Page composition lives in `src/pages`, gateway clients in `src/services`, visual tokens in `src/styles`, and formatting helpers in `src/utils`.

## Service boundary

REST requests use `gatewayClient` with `VITE_API_URL`. GraphQL requests use Apollo Client with `VITE_GRAPHQL_URL`. Both URLs target the API Gateway. The frontend does not address a microservice directly.

## Visual verification

The home, explore, article, login, and responsive navigation views were inspected in the local browser. Desktop and 390-pixel mobile layouts render without console warnings or errors. The Vite production build completes successfully.

## Local use

From the repository root:

```bash
npm install
npm run dev:frontend
```

The Vite development server runs on `http://localhost:5173`.
