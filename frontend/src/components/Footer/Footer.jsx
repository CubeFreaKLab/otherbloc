import { Link } from 'react-router-dom'
import './Footer.css'

const groups = [
  { title: 'Explore', links: [['About', '/explore'], ['Authors', '/profile'], ['Topics', '/explore'], ['Archive', '/explore']] },
  { title: 'Info', links: [['Guidelines', '/explore'], ['Privacy', '/explore'], ['Terms', '/explore'], ['Contact', '/explore']] },
  { title: 'Follow', links: [['Instagram', '/'], ['LinkedIn', '/'], ['RSS', '/']] },
]

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__grid page-width">
        <div className="site-footer__identity">
          <img src="/brand/otherbloc-logo-black.svg" alt="otherbloc" />
          <p>Independent publishing for considered ideas.</p>
          <small>© 2026 otherbloc</small>
        </div>
        {groups.map((group) => (
          <div className="site-footer__group" key={group.title}>
            <h2>{group.title}</h2>
            {group.links.map(([label, href]) => (
              <Link key={label} to={href}>{label}</Link>
            ))}
          </div>
        ))}
      </div>
    </footer>
  )
}
