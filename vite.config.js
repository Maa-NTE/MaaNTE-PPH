import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const LAYERS_FILE = fileURLToPath(new URL('./src/data/layers.js', import.meta.url))
const MAPS_DIR = fileURLToPath(new URL('./public/maps', import.meta.url))
const MAP_TILES_MANIFEST = fileURLToPath(new URL('./public/map-tiles/manifest.json', import.meta.url))

function computeMapAssetVersion() {
  try {
    if (fs.existsSync(MAP_TILES_MANIFEST)) {
      const manifest = JSON.parse(fs.readFileSync(MAP_TILES_MANIFEST, 'utf8'))
      if (manifest?.version) return String(manifest.version)
    }

    const files = fs.readdirSync(MAPS_DIR, { withFileTypes: true })
    const signature = files
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const stat = fs.statSync(new URL(`./public/maps/${entry.name}`, import.meta.url))
        return `${entry.name}:${stat.size}:${Math.trunc(stat.mtimeMs)}`
      })
      .sort()
      .join('|')
    return signature
      ? crypto.createHash('sha1').update(signature).digest('hex').slice(0, 12)
      : String(Date.now())
  } catch {
    return String(Date.now())
  }
}

const MAP_ASSET_VERSION = computeMapAssetVersion()

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function sendJson(response, payload, statusCode = 200) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function formatGeofence(geofence) {
  if (!geofence?.enabled) {
    return `    geofence: {
      enabled: false,
    }`
  }
  const points = Array.isArray(geofence.points)
    ? geofence.points.map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
    : []
  if (points.length < 3
    || !points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    || ![geofence.zMin, geofence.zMax].every((value) => Number.isFinite(Number(value)))) {
    throw new Error('Invalid geofence values')
  }
  const pointLines = points
    .map((point) => `        { x: ${point.x}, y: ${point.y} },`)
    .join('\n')
  return `    geofence: {
      enabled: true,
      points: [
${pointLines}
      ],
      zMin: ${Number(geofence.zMin)},
      zMax: ${Number(geofence.zMax)},
    }`
}

function formatCoordinateMapping(mapping) {
  const points = Array.isArray(mapping?.points)
    ? mapping.points.map((point) => ({
        raw: [Number(point?.raw?.[0]), Number(point?.raw?.[1])],
        map: [Number(point?.map?.[0]), Number(point?.map?.[1])],
      }))
    : []
  if (points.length !== 3
    || !points.every((point) => [...point.raw, ...point.map].every(Number.isFinite))) {
    throw new Error('Invalid coordinate mapping')
  }

  const pointLines = points
    .map((point) => `        { raw: [${point.raw[0]}, ${point.raw[1]}], map: [${point.map[0]}, ${point.map[1]}] },`)
    .join('\n')
  const calibratedAt = mapping.calibratedAt
    ? `\n      calibratedAt: '${String(mapping.calibratedAt).replaceAll("'", "\\'")}',`
    : ''

  return `    coordinateMapping: {
      version: 1,
      calibrated: ${mapping.calibrated === true},${calibratedAt}
      points: [
${pointLines}
      ],
    }`
}

function normalizeCoordinateTransform(transform) {
  const allowedPlanes = new Set(['xoy', 'yoz', 'xoz'])
  const allowedMirrorPlanes = new Set(['xoy', 'yoz', 'xoz'])
  const plane = String(transform?.plane || 'xoy').toLowerCase()
  if (!allowedPlanes.has(plane)) throw new Error('Invalid coordinate plane')

  const readRotation = (axis) => Number(transform?.rotationDegrees?.[axis]) || 0
  const readBoolean = (value) => value === true
  const mirrorPlanes = Array.isArray(transform?.mirrorPlanes)
    ? transform.mirrorPlanes
      .map((value) => String(value).toLowerCase())
      .filter((value, index, values) => allowedMirrorPlanes.has(value) && values.indexOf(value) === index)
    : []

  return {
    rotationDegrees: {
      x: readRotation('x'),
      y: readRotation('y'),
      z: readRotation('z'),
    },
    plane,
    mirrorPlanes,
    flipAxes: {
      x: readBoolean(transform?.flipAxes?.x),
      y: readBoolean(transform?.flipAxes?.y),
      z: readBoolean(transform?.flipAxes?.z),
    },
    offset: {
      x: Number(transform?.offset?.x) || 0,
      y: Number(transform?.offset?.y) || 0,
      z: Number(transform?.offset?.z) || 0,
    },
  }
}

function formatCoordinateTransform(transform) {
  const normalized = normalizeCoordinateTransform(transform)
  const optionalMirror = normalized.mirrorPlanes.length
    ? `\n      mirrorPlanes: [${normalized.mirrorPlanes.map((plane) => `'${plane}'`).join(', ')}],`
    : ''
  const flippedAxes = Object.entries(normalized.flipAxes)
    .filter(([, enabled]) => enabled)
    .map(([axis]) => `${axis}: true`)
  const optionalFlipAxes = flippedAxes.length
    ? `\n      flipAxes: { ${flippedAxes.join(', ')} },`
    : ''
  const offsets = Object.entries(normalized.offset)
    .filter(([, value]) => value !== 0)
    .map(([axis, value]) => `${axis}: ${value}`)
  const optionalOffset = offsets.length
    ? `\n      offset: { ${offsets.join(', ')} },`
    : ''

  return `    coordinateTransform: {
      rotationDegrees: { x: ${normalized.rotationDegrees.x}, y: ${normalized.rotationDegrees.y}, z: ${normalized.rotationDegrees.z} },
      plane: '${normalized.plane}',${optionalMirror}${optionalFlipAxes}${optionalOffset}
    }`
}

function formatComposite(composite) {
  const escapeText = (value) => String(value || '').replaceAll("'", "\\'")
  const items = Array.isArray(composite?.items)
    ? composite.items.map((item) => ({
        layerId: escapeText(item?.layerId),
        x: Number(item?.x) || 0,
        y: Number(item?.y) || 0,
      }))
    : []
  if (!items.length || items.some((item) => !item.layerId)) throw new Error('Invalid composite items')
  const markers = Array.isArray(composite?.markers)
    ? composite.markers.map((marker) => ({
        id: escapeText(marker?.id),
        label: escapeText(marker?.label),
        type: ['portal', 'extraction', 'special-room'].includes(marker?.type) ? marker.type : 'portal',
        layerId: escapeText(marker?.layerId),
        x: Number(marker?.x) || 0,
        y: Number(marker?.y) || 0,
      }))
    : []
  if (markers.some((marker) => !marker.id || !marker.layerId)) throw new Error('Invalid composite markers')
  const markerIds = new Set(markers.map((marker) => marker.id))
  const edges = Array.isArray(composite?.edges)
    ? composite.edges.map((edge) => ({
        from: escapeText(edge?.from),
        to: escapeText(edge?.to),
        bidirectional: edge?.bidirectional === true,
        points: Array.isArray(edge?.points)
          ? edge.points.map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
          : [],
      }))
    : []
  if (edges.some((edge) =>
    !markerIds.has(edge.from)
    || !markerIds.has(edge.to)
    || edge.from === edge.to
    || edge.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y)))) {
    throw new Error('Invalid composite edges')
  }
  const itemLines = items
    .map((item) => `        { layerId: '${item.layerId}', x: ${item.x}, y: ${item.y} },`)
    .join('\n')
  const markerBlock = markers.length
    ? `\n      markers: [
${markers
  .map((marker) => `        { id: '${marker.id}', label: '${marker.label}', type: '${marker.type}', layerId: '${marker.layerId}', x: ${marker.x}, y: ${marker.y} },`)
  .join('\n')}
      ],`
    : ''
  const edgeBlock = edges.length
    ? `\n      edges: [
${edges
  .map((edge) => {
    const points = edge.points.length
      ? `, points: [${edge.points.map((point) => `{ x: ${point.x}, y: ${point.y} }`).join(', ')}]`
      : ''
    const bidirectional = edge.bidirectional ? ', bidirectional: true' : ''
    return `        { from: '${edge.from}', to: '${edge.to}'${bidirectional}${points} },`
  })
  .join('\n')}
      ],`
    : ''
  return `    composite: {
      items: [
${itemLines}
      ],${markerBlock}${edgeBlock}
    }`
}

function getLayerSourceRange(source, layerId) {
  const layerStart = source.indexOf(`id: '${layerId}'`)
  if (layerStart < 0) throw new Error(`Unknown layer: ${layerId}`)
  const nextLayer = source.indexOf("\n  {\n    id: '", layerStart + 1)
  const layerEnd = nextLayer < 0 ? source.indexOf('\n  },\n]', layerStart) : nextLayer
  if (layerEnd < 0) throw new Error(`Cannot locate layer: ${layerId}`)
  return { layerStart, layerEnd }
}

function updateLayerComposite(layerId, composite) {
  const source = fs.readFileSync(LAYERS_FILE, 'utf8')
  const { layerStart, layerEnd } = getLayerSourceRange(source, layerId)
  const layerSource = source.slice(layerStart, layerEnd)
  const compositePattern = /    composite:\s*\{[\s\S]*?\n    \},(?=\n    coordinateTransform:|\n    navigation:)/
  if (!compositePattern.test(layerSource)) throw new Error(`Layer ${layerId} has no composite block`)
  const updatedLayer = layerSource.replace(compositePattern, `${formatComposite(composite)},`)
  fs.writeFileSync(
    LAYERS_FILE,
    `${source.slice(0, layerStart)}${updatedLayer}${source.slice(layerEnd)}`,
    'utf8',
  )
}

function updateLayerCoordinateTransform(layerId, transform) {
  const source = fs.readFileSync(LAYERS_FILE, 'utf8')
  const { layerStart, layerEnd } = getLayerSourceRange(source, layerId)
  const layerSource = source.slice(layerStart, layerEnd)
  const transformPattern = /    coordinateTransform:\s*(?:\{[\s\S]*?\n    \}|[A-Z0-9_]+),/
  const formatted = `${formatCoordinateTransform(transform)},`
  let updatedLayer

  if (transformPattern.test(layerSource)) {
    updatedLayer = layerSource.replace(transformPattern, formatted)
  } else {
    const navigationPattern = /    navigation:/
    if (!navigationPattern.test(layerSource)) throw new Error(`Layer ${layerId} has no navigation block`)
    updatedLayer = layerSource.replace(navigationPattern, `${formatted}\n    navigation:`)
  }

  fs.writeFileSync(
    LAYERS_FILE,
    `${source.slice(0, layerStart)}${updatedLayer}${source.slice(layerEnd)}`,
    'utf8',
  )
}

function updateLayerGeofence(layerId, geofence) {
  const source = fs.readFileSync(LAYERS_FILE, 'utf8')
  const { layerStart, layerEnd } = getLayerSourceRange(source, layerId)
  const layerSource = source.slice(layerStart, layerEnd)
  const geofencePattern = /    geofence:\s*\{[\s\S]*?\n    \},(?=\n    coordinateMapping:)/
  if (!geofencePattern.test(layerSource)) throw new Error(`Layer ${layerId} has no geofence block`)
  const updatedLayer = layerSource.replace(geofencePattern, `${formatGeofence(geofence)},`)
  fs.writeFileSync(
    LAYERS_FILE,
    `${source.slice(0, layerStart)}${updatedLayer}${source.slice(layerEnd)}`,
    'utf8',
  )
}

function updateLayerCoordinateMapping(layerId, mapping) {
  const source = fs.readFileSync(LAYERS_FILE, 'utf8')
  const { layerStart, layerEnd } = getLayerSourceRange(source, layerId)
  const layerSource = source.slice(layerStart, layerEnd)
  // Do not require a following layer terminator: the final MAP_LAYERS item
  // ends immediately before the array closing bracket.
  const mappingPattern = /    coordinateMapping:\s*\{[\s\S]*?\n    \},/
  if (!mappingPattern.test(layerSource)) {
    throw new Error(`Layer ${layerId} has no coordinateMapping block`)
  }
  const updatedLayer = layerSource.replace(
    mappingPattern,
    `${formatCoordinateMapping(mapping)},`,
  )
  fs.writeFileSync(
    LAYERS_FILE,
    `${source.slice(0, layerStart)}${updatedLayer}${source.slice(layerEnd)}`,
    'utf8',
  )
}

function localLayerEditorPlugin() {
  return {
    name: 'local-layer-editor',
    configureServer(server) {
      server.middlewares.use('/api/layer-geofence', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, { error: 'Method not allowed' }, 405)
          return
        }
        try {
          const { layerId, geofence } = JSON.parse(await readBody(request))
          updateLayerGeofence(String(layerId || ''), geofence)
          sendJson(response, { ok: true })
        } catch (error) {
          sendJson(response, { error: error.message }, 400)
        }
      })
      server.middlewares.use('/api/layer-calibration', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, { error: 'Method not allowed' }, 405)
          return
        }
        try {
          const { layerId, coordinateMapping } = JSON.parse(await readBody(request))
          updateLayerCoordinateMapping(String(layerId || ''), coordinateMapping)
          sendJson(response, { ok: true })
        } catch (error) {
          sendJson(response, { error: error.message }, 400)
        }
      })
      server.middlewares.use('/api/layer-transform', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, { error: 'Method not allowed' }, 405)
          return
        }
        try {
          const { layerId, coordinateTransform } = JSON.parse(await readBody(request))
          updateLayerCoordinateTransform(String(layerId || ''), coordinateTransform)
          sendJson(response, { ok: true })
        } catch (error) {
          sendJson(response, { error: error.message }, 400)
        }
      })
      server.middlewares.use('/api/layer-composite', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, { error: 'Method not allowed' }, 405)
          return
        }
        try {
          const { layerId, composite } = JSON.parse(await readBody(request))
          updateLayerComposite(String(layerId || ''), composite)
          sendJson(response, { ok: true })
        } catch (error) {
          sendJson(response, { error: error.message }, 400)
        }
      })
    },
  }
}

export default defineConfig({
  base: './',
  define: {
    __MAP_ASSET_VERSION__: JSON.stringify(MAP_ASSET_VERSION),
  },
  plugins: [vue(), localLayerEditorPlugin()],
  server: {
    watch: {
      ignored: [LAYERS_FILE],
    },
  },
})
