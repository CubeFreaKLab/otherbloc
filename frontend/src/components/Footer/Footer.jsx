import Link from '../MotionLink'
import { useSession } from '../../hooks/useSession'
import './Footer.css'

const groups = [
  { title: 'Descubrir', links: [['Todas las publicaciones', '/explore'], ['Cultura', '/explore?category=cultura'], ['Ciudad', '/explore?category=ciudad']] },
  { title: 'Leer', links: [['Tecnología', '/explore?category=tecnologia'], ['Escritura', '/explore?category=escritura'], ['Guías', '/explore?type=Gu%C3%ADa']] },
]
export default function Footer() {
  const { user } = useSession()
  const personal = user ? { title: 'Tu espacio', links: [
    ['Mi cuenta', '/account'], ['Publicaciones guardadas', '/account/saved'], ['Autores que sigues', '/account/following'],
    ...(['author', 'admin'].includes(user.role) ? [['Mis publicaciones', '/author']] : []),
    ...(user.role === 'admin' ? [['Revisar publicaciones', '/admin/publications'], ['Administrar usuarios', '/admin/users']] : []),
  ] } : { title: 'Participar', links: [['Iniciar sesión', '/login'], ['Crear una cuenta', '/register']] }
  return (
    <footer className="site-footer">
      <div className="site-footer__grid page-width">
        <div className="site-footer__identity">
          <Link to="/"><img className="brand-logo" src="/brand/otherbloc-logo-black.svg" alt="otherbloc, inicio" /></Link>
          <p>Un espacio para leer con tiempo y compartir otras miradas.</p>
          <small>© 2026 otherbloc</small>
        </div>
        {[...groups, personal].map((group) => <nav className="site-footer__group" aria-label={group.title} key={group.title}>
          <h2>{group.title}</h2>
          {group.links.map(([label, href]) => <Link key={label} to={href}>{label}</Link>)}
        </nav>)}
      </div>
    </footer>
  )
}
