# Frontend

The frontend is a React application built with Vite. It owns the browser interface and communicates with backend services only through the API Gateway.

## Foundation

- React entry point with strict mode
- Browser routing for home, explore, article, login, registration, and profile views
- Apollo Client configured for the gateway interaction endpoint
- Fetch wrapper configured for gateway REST endpoints
- Locally hosted otherbloc fonts, marks, and editorial imagery
- Vite development and production build commands

## Local use

From the repository root:

```bash
npm install
npm run dev:frontend
```

The Vite development server runs on `http://localhost:5173`.
