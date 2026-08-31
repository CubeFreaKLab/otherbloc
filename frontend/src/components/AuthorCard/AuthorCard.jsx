import { ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import './AuthorCard.css'

export default function AuthorCard({ compact = false }) {
  return (
    <section className={`author-card${compact ? ' author-card--compact' : ''}`}>
      <div className="author-card__monogram" aria-hidden="true">JC</div>
      <div>
        <span className="author-card__role">Author</span>
        <h2>Jorge Choque</h2>
        {!compact && (
          <p>
            Jorge writes about software architecture, editorial systems, and the choices that shape digital work.
          </p>
        )}
        <Link className="text-link" to="/profile/jorge-choque">
          View profile <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>
    </section>
  )
}
