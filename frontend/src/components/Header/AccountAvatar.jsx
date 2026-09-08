import Link from '../MotionLink'
import { useSession } from '../../hooks/useSession'
import { gatewayMediaUrl } from '../../services/gatewayClient'
import { initials } from '../../utils/initials'

export default function AccountAvatar({ onClick }) {
  const { user } = useSession()
  if (!user) return <Link className="session-access" to="/login" onClick={onClick}>Iniciar sesión</Link>
  const label = 'Mi cuenta'
  return <Link className="account-access" to="/account" aria-label={label} title={label} onClick={onClick}>
    {user.avatarUrl ? <img key={user.avatarUrl} src={gatewayMediaUrl(user.avatarUrl)} alt="" width="36" height="36" /> : <span className="account-access__initials" aria-hidden="true">{initials(user.name)}</span>}
    <span className="account-access__help" aria-hidden="true">{label}</span>
  </Link>
}
