import { ArrowRight } from '@phosphor-icons/react'
import Link from '../MotionLink'
import './AuthorCard.css'
import { gatewayMediaUrl } from '../../services/gatewayClient'

export default function AuthorCard({ author, compact = false }) {
  if (!author) return null
  const initials = author.name.split(' ').map((part) => part[0]).slice(0, 2).join('')
  return (
    <section className={'author-card' + (compact ? ' author-card--compact' : '')}>
      {author.avatarUrl ? <img className="author-card__monogram" src={gatewayMediaUrl(author.avatarUrl)} width="72" height="72" alt={'Avatar de ' + author.name} /> : <div className="author-card__monogram" aria-hidden="true">{initials}</div>}
      <div>
        <span className="author-card__role">{author.role === 'reader' ? 'Lector' : author.role === 'admin' ? 'Administración' : 'Autoría'}</span>
        <h2>{author.name}</h2>
        {!compact && <p>{author.biography ?? author.bio}</p>}
        <Link className="text-link" to={'/profile/' + author.id}>Ver perfil <ArrowRight aria-hidden="true" size={17} /></Link>
      </div>
    </section>
  )
}
