export const DEFAULT_NAVIGATION_WEBSOCKET_URL =
  import.meta.env.VITE_MAANTE_NAVI_WEBSOCKET_URL || 'ws://127.0.0.1:14514'

export function parseNavigationWebSocketUrl(url = DEFAULT_NAVIGATION_WEBSOCKET_URL) {
  try {
    const parsed = new URL(url)
    return {
      protocol: parsed.protocol === 'wss:' ? 'wss' : 'ws',
      host: parsed.hostname || '127.0.0.1',
      port: parsed.port || '14514',
    }
  } catch {
    return { protocol: 'ws', host: '127.0.0.1', port: '14514' }
  }
}

export function normalizeNavigationPort(value) {
  const port = Number(value)
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? String(port) : '14514'
}
