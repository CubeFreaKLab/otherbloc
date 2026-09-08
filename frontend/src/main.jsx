import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import HomePage, { loader as homeLoader } from './pages/HomePage'
import ExplorePage, { loader as exploreLoader } from './pages/ExplorePage'
import NotFoundPage from './pages/NotFoundPage'
import './styles/global.css'

const router = createBrowserRouter([{
  element: <App />,
  HydrateFallback: () => <App loading />,
  children: [
    { path: '/', element: <HomePage />, loader: homeLoader },
    { path: '/explore', element: <ExplorePage />, loader: exploreLoader },
    { path: '/article/:slug', lazy: async () => { const article = await import('./pages/ArticlePage'); return { Component: article.default, loader: article.loader } } },
    { path: '/profile/:id?', lazy: async () => { const profile = await import('./pages/ProfilePage'); return { Component: profile.default, loader: profile.loader } } },
    { path: '/login', lazy: async () => ({ Component: (await import('./pages/LoginPage')).default }) },
    { path: '/register', lazy: async () => ({ Component: (await import('./pages/RegisterPage')).default }) },
    { path: '/account', lazy: async () => ({ Component: (await import('./pages/AccountPage')).default }) },
    { path: '/account/saved', lazy: async () => ({ Component: (await import('./pages/LibraryPage')).SavedPublicationsPage }) },
    { path: '/account/following', lazy: async () => ({ Component: (await import('./pages/LibraryPage')).FollowingAuthorsPage }) },
    { path: '/admin/users', lazy: async () => ({ Component: (await import('./pages/AdminUsersPage')).default }) },
    { path: '/admin/publications', lazy: async () => ({ Component: (await import('./pages/AdminPublicationsPage')).default }) },
    { path: '/admin/publications/:id', lazy: async () => ({ Component: (await import('./pages/PublicationReviewPage')).default }) },
    { path: '/author', lazy: async () => ({ Component: (await import('./pages/AuthorPage')).default }) },
    { path: '/author/new', lazy: async () => ({ Component: (await import('./pages/NewPublicationPage')).default }) },
    { path: '/author/publications/:id', lazy: async () => ({ Component: (await import('./pages/PublicationEditorPage')).default }) },
    { path: '*', element: <NotFoundPage /> },
  ],
}])

createRoot(document.getElementById('root')).render(
  <StrictMode><RouterProvider router={router} /></StrictMode>,
)
