export function boliviaDate(now) {
  const date = new Date(now)
  return {
    text: new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', day: 'numeric', month: 'long', year: 'numeric' }).format(date),
    iso: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date),
  }
}

export function weatherCondition(code, day) {
  if (code === 0) return { icon: day ? 'sun' : 'moon', text: 'Despejado' }
  if (code === 1 || code === 2) return { icon: day ? 'cloudSun' : 'cloudMoon', text: 'Parcialmente nublado' }
  if (code === 3) return { icon: 'cloud', text: 'Nublado' }
  if ([45, 48].includes(code)) return { icon: 'fog', text: 'Niebla' }
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: 'rain', text: 'Llovizna' }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: 'rain', text: 'Lluvia' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: 'snow', text: 'Nieve' }
  if ([95, 96, 99].includes(code)) return { icon: 'storm', text: 'Tormenta' }
  return { icon: 'cloud', text: 'Condición no disponible' }
}

export function availableBulletins(data, now) {
  return ['weather', 'crypto', 'headlines'].filter((key) => data?.[key]?.expiresAt > now && data[key].items?.length).map((key) => ({ key, ...data[key] }))
}
