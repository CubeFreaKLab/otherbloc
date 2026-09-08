import { Plus } from '@phosphor-icons/react'
import Link from '../MotionLink'
import { useSession } from '../../hooks/useSession'

export default function WriteAccess({ onClick }) {
  const { user } = useSession()
  if (!user) return null
  return <Link className="write-access" to="/author/new" aria-label="Escribir una nota" title="Escribir una nota" onClick={onClick}><Plus size={21} aria-hidden="true" /></Link>
}
