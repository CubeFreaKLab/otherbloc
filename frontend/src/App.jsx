import { Navigate, Route, Routes } from 'react-router-dom'
import Footer from './components/Footer/Footer'
import Header from './components/Header/Header'
import ArticlePage from './pages/ArticlePage'
import ExplorePage from './pages/ExplorePage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import './styles/layout.css'
import './styles/pages.css'

export default function App() {
  return (
    <div className="site-shell">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/article/:slug" element={<ArticlePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile/:id?" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </div>
  )
}
