import Link from '../MotionLink'
import { useSession } from '../../hooks/useSession'
import { gatewayMediaUrl } from '../../services/gatewayClient'

export default function AccountAvatar({ onClick }) {
  const { user } = useSession()
  const label = user ? 'Mi cuenta' : 'Iniciar sesión'
  return <Link className="account-access" to={user ? '/account' : '/login'} aria-label={label} title={label} onClick={onClick}>
    {user?.avatarUrl && <img key={user.avatarUrl} src={gatewayMediaUrl(user.avatarUrl)} alt="" width="36" height="36" />}
    <span className="account-access__help" aria-hidden="true">{label}</span>
  </Link>
}
