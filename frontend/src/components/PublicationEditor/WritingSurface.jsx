import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Extension, Node } from '@tiptap/core'
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Plugin } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Blockquote from '@tiptap/extension-blockquote'
import Placeholder from '@tiptap/extension-placeholder'
import Suggestion, { exitSuggestion } from '@tiptap/suggestion'
import { ArrowUUpLeft, ArrowUUpRight, Image, Link as LinkIcon, ListBullets, ListNumbers, Plus, Quotes, TextB, TextH, TextItalic, TextT } from '@phosphor-icons/react'
import { createId } from '../../utils/createId'
import { fromWritingDocument, safeLink, toWritingDocument } from '../../services/writingDocument'
import EditorialDialog from '../EditorialDialog'
import ImageField from './ImageField'

const choices = [
  { id: 'text', label: 'Texto', icon: TextT, run: (chain) => chain.clearNodes().setParagraph() },
  { id: 'heading', label: 'Subtítulo', icon: TextH, run: (chain) => chain.clearNodes().setHeading({ level: 2 }) },
  { id: 'bullet', label: 'Lista con viñetas', icon: ListBullets, run: (chain) => chain.clearNodes().toggleBulletList() },
  { id: 'number', label: 'Lista numerada', icon: ListNumbers, run: (chain) => chain.clearNodes().toggleOrderedList() },
  { id: 'quote', label: 'Cita', icon: Quotes, run: (chain) => chain.clearNodes().toggleBlockquote() },
  { id: 'image', label: 'Imagen', icon: Image, run: (chain) => chain.insertContent([{ type: 'editorImage' }, { type: 'paragraph' }]) },
]
const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const bubbleOptions = { placement: 'top', offset: 10 }

const Identity = Extension.create({
  name: 'writingIdentity',
  addGlobalAttributes() { return [{ types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'editorImage'], attributes: { id: { default: null, rendered: false }, attribution: { default: '', rendered: false } } }] },
  addProseMirrorPlugins() {
    return [new Plugin({ appendTransaction(transactions, _previous, state) {
      if (!transactions.some((transaction) => transaction.docChanged)) return null
      const used = new Set(), transaction = state.tr
      state.doc.forEach((node, position) => {
        let id = node.attrs.id
        if (!id || used.has(id)) { id = createId(); transaction.setNodeMarkup(position, undefined, { ...node.attrs, id }) }
        used.add(id)
      })
      return transaction.docChanged ? transaction.setMeta('addToHistory', false) : null
    } })]
  },
})

function ImageContent({ node, updateAttributes, editor, extension, deleteNode }) {
  const { publicationId, onBusyChange } = extension.options
  const [details, setDetails] = useState(!node.attrs.assetId)
  return <NodeViewWrapper className="writing-image" contentEditable={false}>
    <ImageField publicationId={publicationId} assetId={node.attrs.assetId} alt={node.attrs.alt} label="Imagen" disabled={!editor.isEditable} onBusyChange={onBusyChange} onChange={(assetId) => updateAttributes({ assetId })} />
    <button type="button" className="text-button writing-image__details" aria-expanded={details} onClick={() => setDetails(!details)}>Descripción y pie de imagen</button>
    {details && <div className="writing-image__fields" onKeyDown={(event) => event.stopPropagation()}>
      <label>Descripción de la imagen<input value={node.attrs.alt} maxLength={300} disabled={!editor.isEditable} onChange={(event) => updateAttributes({ alt: event.target.value })} /></label>
      <label>Pie de imagen<input value={node.attrs.caption} maxLength={500} disabled={!editor.isEditable} onChange={(event) => updateAttributes({ caption: event.target.value })} /></label>
      <button type="button" className="text-button" disabled={!editor.isEditable} onClick={deleteNode}>Quitar imagen del texto</button>
    </div>}
  </NodeViewWrapper>
}

const EditorImage = Node.create({
  name: 'editorImage', group: 'block', atom: true, draggable: false,
  addAttributes() { return Object.fromEntries(['assetId', 'alt', 'caption'].map((key) => [key, { default: key === 'assetId' ? null : '', parseHTML: (element) => element.getAttribute('data-' + key.toLowerCase()), renderHTML: (attrs) => ({ ['data-' + key.toLowerCase()]: attrs[key] }) }])) },
  parseHTML() { return [{ tag: 'figure[data-editor-image]' }] },
  renderHTML({ HTMLAttributes }) { return ['figure', { ...HTMLAttributes, 'data-editor-image': '' }] },
  addNodeView() { return ReactNodeViewRenderer(ImageContent) },
})

function QuoteContent({ node, updateAttributes, editor }) {
  return <NodeViewWrapper className="writing-quote"><NodeViewContent as="blockquote" /><details contentEditable={false}><summary>Fuente de la cita</summary><label>Autoría o fuente de la cita<input value={node.attrs.attribution} maxLength={160} disabled={!editor.isEditable} onChange={(event) => updateAttributes({ attribution: event.target.value })} onKeyDown={(event) => event.stopPropagation()} /></label></details></NodeViewWrapper>
}
const WritingQuote = Blockquote.extend({ addNodeView() { return ReactNodeViewRenderer(QuoteContent) } })

export default function WritingSurface({ blocks, onChange, publicationId, disabled, onBusyChange, revision = 0 }) {
  const latest = useRef({ onChange, onBusyChange }), menuRef = useRef(null), firstFormat = useRef(null), linkReturn = useRef(null), menuReturn = useRef(false)
  const [menu, setMenu] = useState(null), [link, setLink] = useState(null), [linkError, setLinkError] = useState('')
  useLayoutEffect(() => { latest.current = { onChange, onBusyChange } })
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, blockquote: false, code: false, codeBlock: false, strike: false, underline: false, horizontalRule: false, link: { openOnClick: false, autolink: false, defaultProtocol: 'https', isAllowedUri: safeLink } }), WritingQuote,
      Identity, Placeholder.configure({ placeholder: 'Escribe aquí. Usa / para añadir…' }),
      EditorImage.configure({ publicationId, onBusyChange: (value) => latest.current.onBusyChange(value) }),
      Extension.create({
        name: 'writingCommands',
        addProseMirrorPlugins() {
          return [Suggestion({ editor: this.editor, char: '/', allowedPrefixes: [' ', '\n'],
            items: ({ query }) => choices.filter((choice) => normalize(choice.label).includes(normalize(query))),
            command: ({ editor, range, props }) => { props.run(editor.chain().focus().deleteRange(range)).run() },
            render: () => {
              const show = (props) => { const value = { ...props, index: 0 }; menuRef.current = value; setMenu(value) }
              return { onStart: show, onUpdate: show, onExit: () => { menuRef.current = null; setMenu(null) }, onKeyDown: ({ event, view }) => {
                const current = menuRef.current
                if (!current || event.isComposing) return false
                if (event.key === 'Escape') { exitSuggestion(view); return true }
                if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
                  const value = { ...current, index: (current.index + (event.key === 'ArrowDown' ? 1 : -1) + current.items.length) % Math.max(1, current.items.length) }
                  menuRef.current = value; setMenu(value); return true
                }
                if (event.key === 'Enter') { if (current.items[current.index]) current.command(current.items[current.index]); return true }
                return false
              } }
            },
          })]
        },
      }),
    ],
    content: toWritingDocument(blocks), editable: !disabled, shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'writing-prose', role: 'textbox', 'aria-label': 'Texto de la publicación', 'aria-multiline': 'true', spellcheck: 'true' },
      handleKeyDown: (_view, event) => { if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'f') { firstFormat.current?.focus(); return true } return false },
    },
    onUpdate: ({ editor }) => latest.current.onChange(fromWritingDocument(editor.getJSON())),
  })
  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])
  useLayoutEffect(() => {
    if (!menu && editor && menuReturn.current) {
      menuReturn.current = false
      // Restore focus after the search input unmounts, before the next keystroke.
      editor.view.focus()
    }
  }, [menu, editor])
  useLayoutEffect(() => {
    if (!link && editor && linkReturn.current !== null) {
      const position = linkReturn.current; linkReturn.current = null
      editor.commands.setTextSelection(position)
      editor.view.focus()
    }
  }, [link, editor])
  const previousRevision = useRef(revision)
  useEffect(() => {
    if (editor && previousRevision.current !== revision) { editor.commands.setContent(toWritingDocument(blocks), { emitUpdate: false }); previousRevision.current = revision }
  }, [editor, blocks, revision])
  if (!editor) return null
  const rect = menu?.clientRect?.()
  const menuPosition = rect ? { left: Math.max(12, Math.min(rect.left, window.innerWidth - 292)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 340)) } : undefined
  function editLink() { setLinkError(''); setLink({ href: editor.getAttributes('link').href || '', from: editor.state.selection.from, to: editor.state.selection.to }) }
  function openChoices() {
    const position = editor.state.selection.to
    const coordinates = editor.view.coordsAtPos(position)
    setMenu({ manual: true, query: '', items: choices, index: 0, clientRect: () => coordinates, command: (choice) => {
      choice.run(editor.chain().setTextSelection(position)).run()
      menuReturn.current = true; setMenu(null)
    } })
  }
  function closeChoices() { if (menu?.manual) { menuReturn.current = true; setMenu(null) } else { exitSuggestion(editor.view); editor.commands.focus() } }
  function applyLink(event) {
    event.preventDefault()
    const href = link.href.trim()
    if (href && !safeLink(href)) { setLinkError('Usa un enlace completo: https://… o mailto:…'); return }
    const chain = editor.chain().setTextSelection({ from: link.from, to: link.to }).extendMarkRange('link')
    if (href) chain.setLink({ href }).run(); else chain.unsetLink().run()
    linkReturn.current = link.to; setLink(null)
  }
  return <div className="writing-surface">
    <div className="writing-tools" aria-label="Herramientas de escritura">
      <button type="button" title="Añadir al texto" aria-label="Añadir al texto" disabled={disabled} onClick={openChoices}><Plus size={20} aria-hidden="true" /></button>
      <span className="writing-hint">Texto · / para añadir</span>
      <button type="button" title="Deshacer" aria-label="Deshacer" disabled={disabled} onClick={() => editor.chain().focus().undo().run()}><ArrowUUpLeft size={18} aria-hidden="true" /></button>
      <button type="button" title="Rehacer" aria-label="Rehacer" disabled={disabled} onClick={() => editor.chain().focus().redo().run()}><ArrowUUpRight size={18} aria-hidden="true" /></button>
    </div>
    <EditorContent editor={editor} />
    {!disabled && <BubbleMenu editor={editor} options={bubbleOptions}>
      <div className="writing-format" role="toolbar" aria-label="Formato del texto" onMouseDown={(event) => event.preventDefault()}>
        <button ref={firstFormat} type="button" aria-label="Negrita" aria-pressed={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><TextB size={19} /></button>
        <button type="button" aria-label="Cursiva" aria-pressed={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><TextItalic size={19} /></button>
        <button type="button" aria-label="Enlace" aria-pressed={editor.isActive('link')} onClick={editLink}><LinkIcon size={19} /></button>
      </div>
    </BubbleMenu>}
    {menu && <div className="writing-menu" style={menuPosition} onKeyDown={(event) => {
      if (!menu.manual) return
      if (event.key === 'Escape') { event.preventDefault(); closeChoices() }
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setMenu((value) => ({ ...value, index: (value.index + (event.key === 'ArrowDown' ? 1 : -1) + value.items.length) % Math.max(1, value.items.length) })) }
      if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') { event.preventDefault(); if (menu.items[menu.index]) menu.command(menu.items[menu.index]) }
    }}>
      {menu.manual && <input autoFocus aria-label="Buscar opción" value={menu.query} placeholder="Buscar opción" onChange={(event) => { const query = event.target.value; setMenu((value) => ({ ...value, query, index: 0, items: choices.filter((choice) => normalize(choice.label).includes(normalize(query))) })) }} />}
      <p>{menu.query ? 'Resultados' : 'Añadir al texto'}</p>
      <div role="listbox" aria-label="Añadir al texto" aria-activedescendant={menu.items.length ? 'writing-option-' + menu.index : undefined}>
      {menu.items.map((choice, index) => <button id={'writing-option-' + index} key={choice.id} type="button" role="option" aria-selected={index === menu.index} onMouseDown={(event) => event.preventDefault()} onFocus={() => { if (menu.manual) setMenu((value) => ({ ...value, index })) }} onClick={() => menu.command(choice)}><choice.icon size={20} aria-hidden="true" />{choice.label}</button>)}
      {!menu.items.length && <p>No hay opciones para «{menu.query}».</p>}
      </div>
      <button className="writing-menu__close" type="button" onClick={closeChoices}>Cerrar menú <small>Esc</small></button>
    </div>}
    <EditorialDialog open={Boolean(link)} aria-labelledby="writing-link-title" onCancel={() => { linkReturn.current = link?.to ?? null; setLink(null) }}>
      <form onSubmit={applyLink}><h2 id="writing-link-title">Enlace</h2><label className="form-field">Dirección<input autoFocus value={link?.href || ''} onChange={(event) => setLink((value) => ({ ...value, href: event.target.value }))} placeholder="https://" /></label>{linkError && <p role="alert">{linkError}</p>}<div className="form-actions"><button className="primary-button" type="submit">Aplicar enlace</button><button className="text-button" type="button" onClick={() => { linkReturn.current = link.to; setLink(null) }}>Cancelar</button></div></form>
    </EditorialDialog>
  </div>
}
