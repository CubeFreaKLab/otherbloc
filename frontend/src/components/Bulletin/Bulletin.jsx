import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CaretRight, Cloud, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Info, Moon, Pause, Play, Sun } from '@phosphor-icons/react'
import Link from '../MotionLink'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { loadBulletin } from '../../services/bulletin'
import { availableBulletins, boliviaDate, weatherCondition } from '../../utils/bulletin'
import './Bulletin.css'

const labels = { weather: 'Clima · Bolivia', crypto: 'Cripto · USD', headlines: 'En otherbloc' }
const icons = { sun: Sun, moon: Moon, cloudSun: CloudSun, cloudMoon: CloudMoon, cloud: Cloud, fog: CloudFog, rain: CloudRain, snow: CloudSnow, storm: CloudLightning }
const money = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const time = (value) => new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(value)

function Items({ group, repeat = false }) {
  return group.items.map((item, index) => {
    if (group.key === 'headlines') return <Link key={item.id} className="bulletin__item bulletin__headline" to={'/article/' + item.slug} tabIndex={repeat ? -1 : undefined} onMouseDown={repeat ? (event) => event.preventDefault() : undefined}>{item.title}<CaretRight size={12} aria-hidden="true" /></Link>
    if (group.key === 'crypto') return <span key={item.symbol} className="bulletin__item" title={item.name + ' · Último precio en Kraken · Consultado ' + time(group.fetchedAt)}><strong>{item.symbol}</strong><span>{money.format(item.price)}</span></span>
    const condition = weatherCondition(item.code, item.day), Icon = icons[condition.icon]
    return <span key={index} className="bulletin__item" title={condition.text + ' · ' + time(item.observedAt)}><Icon size={17} aria-hidden="true" /><span className="visually-hidden">{condition.text}: </span><span>{item.city}</span><strong>{Math.round(item.temperature)}°</strong></span>
  })
}

function Row({ group, previous = false, onComplete, onExit }) {
  const viewport = useRef(null), track = useRef(null), items = useRef(null)
  useLayoutEffect(() => {
    const measure = () => {
      track.current.style.setProperty('--viewport-width', viewport.current.clientWidth + 'px')
      const width = items.current.scrollWidth
      track.current.style.setProperty('--travel', -width + 'px')
      track.current.style.setProperty('--travel-time', Math.max(14, width / 40 + 4) + 's')
    }
    const observer = new ResizeObserver(measure)
    observer.observe(viewport.current); observer.observe(items.current)
    measure()
    return () => observer.disconnect()
  }, [group])
  return <div className={'bulletin__row' + (previous ? ' bulletin__row--out' : '')} aria-hidden={previous || undefined} inert={previous} onAnimationEnd={(event) => {
    if (event.animationName === 'bulletin-out') onExit?.()
  }}>
    <span className="bulletin__label">{labels[group.key]}</span>
    <div className="bulletin__viewport" ref={viewport} tabIndex={previous ? undefined : 0} role="group" aria-label={labels[group.key] + '. Usa las flechas para recorrer los datos.'}>
      <div className="bulletin__track" ref={track} onAnimationEnd={(event) => { if (event.animationName === 'bulletin-travel') onComplete?.() }}>
        <div className="bulletin__items" ref={items}><Items group={group} /></div>
        <div className="bulletin__items bulletin__repeat" aria-hidden="true"><Items group={group} repeat /></div>
      </div>
    </div>
  </div>
}

export default function Bulletin() {
  const [data, setData] = useState(null), [now, setNow] = useState(Date.now)
  const [frame, setFrame] = useState({ key: null, previous: null, sequence: 0 })
  const [paused, setPaused] = useState(false), [focused, setFocused] = useState(false), [visible, setVisible] = useState(true)
  const [hovered, setHovered] = useState(false), [sourcesOpen, setSourcesOpen] = useState(false)
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const ref = useRef(null)
  useEffect(() => {
    let alive = true, pending = false
    const refresh = async () => {
      if (document.hidden || pending) return
      setNow(Date.now()); pending = true
      try { const result = await loadBulletin(); if (alive) setData(result) }
      catch { if (alive) setData(null) }
      finally { pending = false }
    }
    refresh()
    const timer = setInterval(refresh, 30000)
    document.addEventListener('visibilitychange', refresh)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(ref.current)
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); observer.disconnect() }
  }, [])
  const groups = availableBulletins(data, now)
  const current = groups.find((group) => group.key === frame.key) ?? groups[0]
  const next = () => {
    const index = groups.findIndex((group) => group.key === current?.key)
    setFrame({ key: groups[(index + 1) % groups.length]?.key, previous: reduced || !current ? null : current, sequence: frame.sequence + 1 })
  }
  const date = boliviaDate(now)
  return <aside ref={ref} className="bulletin" aria-label="Hoy en otherbloc" data-paused={paused || focused || hovered || !visible || reduced || sourcesOpen} data-manual={paused || focused || reduced}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true) }} onPointerLeave={() => setHovered(false)}
    onFocusCapture={(event) => { setFocused(true); const target = event.target; if (target.closest('.bulletin__viewport')) requestAnimationFrame(() => target.scrollIntoView({ block: 'nearest', inline: 'nearest' })) }}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <div className="bulletin__inner page-width">
      <time className="bulletin__date" dateTime={date.iso}>{date.text}</time>
      {current && <>
        <div className="bulletin__stage" data-section={current.key}>
          {frame.previous && <Row group={frame.previous} previous onExit={() => setFrame((value) => ({ ...value, previous: null }))} />}
          <Row key={current.key + frame.sequence} group={current} onComplete={next} />
        </div>
        <div className="bulletin__controls">
          {!reduced && <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Reanudar la franja informativa' : 'Pausar la franja informativa'} aria-pressed={paused}>{paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}</button>}
          {groups.length > 1 && <button type="button" onClick={next} aria-label="Ver siguiente sección informativa"><CaretRight size={15} aria-hidden="true" /></button>}
          <button type="button" popoverTarget="bulletin-sources" aria-label="Fuentes y actualización de los datos"><Info size={16} aria-hidden="true" /></button>
        </div>
      </>}
    </div>
    <div id="bulletin-sources" className="bulletin__sources" popover="auto" onToggle={(event) => setSourcesOpen(event.newState === 'open')}>
      <h2>Sobre esta franja</h2>
      <p>La fecha corresponde a Bolivia. Solo se muestran fuentes disponibles y datos recientes.</p>
      {groups.some((group) => group.key === 'weather') && <p>Clima: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Estimaciones del modelo meteorológico, temperaturas redondeadas a °C. Consulta: {time(data.weather.fetchedAt)}. Se actualiza cada 15 minutos.</p>}
      {groups.some((group) => group.key === 'crypto') && <p>Criptomonedas: <a href="https://www.kraken.com/prices" target="_blank" rel="noreferrer">Kraken</a>. Último precio de operación en USD en ese mercado, no un promedio global. Consulta: {time(data.crypto.fetchedAt)}. Se actualiza cada 5 minutos; no son cotizaciones en tiempo real.</p>}
      <p>Los titulares enlazan a publicaciones de otherbloc. Puedes pausar la franja o recorrerla manualmente con el teclado.</p>
      <button type="button" popoverTarget="bulletin-sources" popoverTargetAction="hide">Cerrar</button>
    </div>
  </aside>
}
