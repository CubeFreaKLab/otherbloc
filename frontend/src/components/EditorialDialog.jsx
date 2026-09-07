import { useLayoutEffect, useRef, useState } from 'react'

export default function EditorialDialog({ open, children, ...props }) {
  const dialog = useRef(null)
  const [content, setContent] = useState(open ? children : null)
  if (open && content !== children) setContent(children)
  useLayoutEffect(() => {
    const node = dialog.current
    if (open) { node.showModal(); return }
    node.close()
    let canceled = false
    // Native close restores focus immediately; only the outgoing visual is retained.
    Promise.allSettled(node.getAnimations().map((animation) => animation.finished)).then(() => { if (!canceled) setContent(null) })
    return () => { canceled = true }
  }, [open])
  return <dialog ref={dialog} className="editorial-dialog" inert={!open} {...props}>{open ? children : content}</dialog>
}
