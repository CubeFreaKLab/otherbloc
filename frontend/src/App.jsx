import { Navigate, Route, Routes } from 'react-router-dom'
import RoutePlaceholder from './pages/RoutePlaceholder'

const routes = [
  ['/', 'Home'],
  ['/explore', 'Explore'],
  ['/article/:slug', 'Article'],
  ['/login', 'Login'],
  ['/register', 'Register'],
  ['/profile/:id?', 'Profile'],
]

export default function App() {
  return (
    <Routes>
      {routes.map(([path, title]) => (
        <Route key={path} path={path} element={<RoutePlaceholder title={title} />} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
