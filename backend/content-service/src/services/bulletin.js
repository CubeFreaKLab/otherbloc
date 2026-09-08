// City centres, not the user's location. Providers receive no account data.
export const cities = [
  ['La Paz', -16.5, -68.15], ['Sucre', -19.0333, -65.2627],
  ['Santa Cruz', -17.7863, -63.1812], ['Cochabamba', -17.3895, -66.1568],
  ['Oruro', -17.9833, -67.15], ['Potosí', -19.5836, -65.7531],
  ['Tarija', -21.5355, -64.7296], ['Trinidad', -14.8333, -64.9], ['Cobija', -11.0267, -68.7692],
]
const coins = [['BTC', 'Bitcoin', 'XXBTZUSD'], ['ETH', 'Ethereum', 'XETHZUSD'], ['SOL', 'Solana', 'SOLUSD'], ['XRP', 'XRP', 'XXRPZUSD'], ['ADA', 'Cardano', 'ADAUSD']]
const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast')
weatherUrl.search = new URLSearchParams({ latitude: cities.map((city) => city[1]).join(','), longitude: cities.map((city) => city[2]).join(','), current: 'temperature_2m,weather_code,is_day', timeformat: 'unixtime' }).toString()

function cached(load, ttl, now) {
  let value = null, expires = 0, retryAt = 0, flight
  return async () => {
    if (now() < expires) return value
    if (flight) return flight
    if (now() < retryAt) return null
    flight = Promise.resolve().then(load).then((items) => {
      if (!items.length) throw new Error('empty_bulletin')
      const fetchedAt = now()
      value = { items, fetchedAt, expiresAt: fetchedAt + ttl }
      expires = value.expiresAt
      return value
    }).catch(() => {
      // Never present expired data as current, or retry on every visitor request.
      value = null; expires = 0; retryAt = now() + 60000
      return null
    }).finally(() => { flight = null })
    return flight
  }
}

export function createBulletin({ fetchImpl = fetch, now = Date.now, listPublic, external = true }) {
  const json = async (url) => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(4500), redirect: 'error', headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('bulletin_provider_unavailable')
    return response.json()
  }
  const weather = cached(async () => {
    const data = await json(weatherUrl.href)
    if (!Array.isArray(data) || data.length !== cities.length) throw new Error('invalid_weather')
    return data.flatMap(({ current }, index) => {
      if (!Number.isFinite(current?.temperature_2m) || !Number.isInteger(current.weather_code) || ![0, 1].includes(current.is_day) || !Number.isFinite(current.time) || Math.abs(now() - current.time * 1000) > 3600000) return []
      return [{ city: cities[index][0], temperature: current.temperature_2m, code: current.weather_code, day: current.is_day === 1, observedAt: current.time * 1000 }]
    })
  }, 900000, now)
  const crypto = cached(async () => {
    const data = await json('https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,SOLUSD,XRPUSD,ADAUSD')
    if (!Array.isArray(data.error) || data.error.length) throw new Error('invalid_prices')
    return coins.flatMap(([symbol, name, key]) => {
      const price = Number(data.result?.[key]?.c?.[0])
      return Number.isFinite(price) && price > 0 ? [{ symbol, name, price, currency: 'USD' }] : []
    })
  }, 300000, now)
  const headlines = cached(async () => (await listPublic({ limit: 4 })).items.map(({ id, slug, title }) => ({ id, slug, title })), 60000, now)
  return async () => {
    const [weatherData, cryptoData, headlineData] = await Promise.all([external ? weather() : null, external ? crypto() : null, headlines()])
    return { weather: weatherData, crypto: cryptoData, headlines: headlineData }
  }
}
