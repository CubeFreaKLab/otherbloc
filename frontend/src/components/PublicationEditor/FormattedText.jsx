import { safeLink } from '../../services/writingDocument'

export default function FormattedText({ text, runs }) {
  if (!text && (!runs || !runs.length)) return <br />
  if (!runs) return text
  return runs.map((run, index) => {
    let content = run.text
    if (run.bold) content = <strong>{content}</strong>
    if (run.italic) content = <em>{content}</em>
    if (safeLink(run.href)) content = <a href={run.href} rel="noopener noreferrer">{content}</a>
    return <span key={index}>{content}</span>
  })
}
