import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import HomePage from './pages/HomePage'
import ExplorePage from './pages/ExplorePage'
import NotFoundPage from './pages/NotFoundPage'
import './styles/global.css'

const router = createBrowserRouter([{
  element: <App />,
  children: [
    { path: '/', element: <HomePage /> },
    { path: '/explore', element: <ExplorePage /> },
    { path: '/article/:slug', lazy: async () => ({ Component: (await import('./pages/ArticlePage')).default }) },
    { path: '/profile/:id?', lazy: async () => ({ Component: (await import('./pages/ProfilePage')).default }) },
    { path: '/login', lazy: async () => ({ Component: (await import('./pages/LoginPage')).default }) },
    { path: '/register', lazy: async () => ({ Component: (await import('./pages/RegisterPage')).default }) },
    { path: '/account', lazy: async () => ({ Component: (await import('./pages/AccountPage')).default }) },
    { path: '/admin/users', lazy: async () => ({ Component: (await import('./pages/AdminUsersPage')).default }) },
    { path: '*', element: <NotFoundPage /> },
  ],
}])

createRoot(document.getElementById('root')).render(
  <StrictMode><RouterProvider router={router} /></StrictMode>,
)
