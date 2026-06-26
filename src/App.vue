<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'
import { DEFAULT_LAYER_ID, MAP_LAYERS } from './data/layers'
import {
  applyLayerAngleOffset,
  createLayerCoordinateMapper,
  isGamePositionInsideGeofence,
  normalizeLayerGeofence,
  resolveLayerNavigationPosition,
  transformGamePositionToPlane,
} from './utils/coordinates'
import {
  DEFAULT_NAVIGATION_WEBSOCKET_URL,
  normalizeNavigationPort,
  parseNavigationWebSocketUrl,
} from './utils/navigationEndpoint'

const mapElement = ref(null)
const isDevelopment = import.meta.env.DEV
const LOGO_URL = '/images/logo.png'
const MAP_ASSET_VERSION = __MAP_ASSET_VERSION__
const MAP_TILE_SIZE = 256
const MAP_TILE_MIN_ZOOM = -8
const MAP_TILE_MAX_NATIVE_ZOOM = 0
const OVERVIEW_LAYER_ID = 'all-maps-overview'
const activeLayerId = ref(localStorage.getItem('pph-active-layer') || DEFAULT_LAYER_ID)
const activeLayer = computed(() => MAP_LAYERS.find((layer) => layer.id === activeLayerId.value) || MAP_LAYERS[0])
const overviewLayer = computed(() => MAP_LAYERS.find((layer) => layer.id === OVERVIEW_LAYER_ID) || null)
const calibrationOverrides = ref(isDevelopment ? readCalibrationOverrides() : {})
const geofenceOverrides = ref(isDevelopment ? readGeofenceOverrides() : {})
const coordinateTransformOverrides = ref({})
const compositeLayoutOverrides = ref({})
const activeCoordinateMapping = computed(() =>
  calibrationOverrides.value[activeLayer.value.id] || activeLayer.value.coordinateMapping,
)
const activeCoordinateTransform = computed(() => getLayerCoordinateTransform(activeLayer.value))
const effectiveLayer = computed(() => ({
  ...activeLayer.value,
  coordinateMapping: activeCoordinateMapping.value,
  coordinateTransform: activeCoordinateTransform.value,
}))
const mapper = computed(() => createLayerCoordinateMapper(effectiveLayer.value))
const isLayerCalibrated = computed(() => activeCoordinateMapping.value.calibrated === true)
const activeGeofence = computed(() =>
  normalizeLayerGeofence(geofenceOverrides.value[activeLayer.value.id] || activeLayer.value.geofence),
)
const isGeofenceConfigured = computed(() => Boolean(activeGeofence.value))
const isCompositeLayer = computed(() => Array.isArray(activeLayer.value.composite?.items))
const displayLayers = computed(() => [
  ...MAP_LAYERS.filter((layer) => layer.id === OVERVIEW_LAYER_ID),
  ...MAP_LAYERS.filter((layer) => layer.id !== OVERVIEW_LAYER_ID),
])
const overviewDisplayLayers = computed(() => displayLayers.value.filter((layer) => layer.id === OVERVIEW_LAYER_ID))
const areaDisplayLayers = computed(() => displayLayers.value.filter((layer) => layer.id !== OVERVIEW_LAYER_ID))
const areaLayerListOpen = ref(localStorage.getItem('pph-area-layer-list-open') === 'true')
const activeComposite = computed(() =>
  compositeLayoutOverrides.value[activeLayer.value.id] || activeLayer.value.composite || { items: [] },
)
const overviewComposite = computed(() =>
  compositeLayoutOverrides.value[OVERVIEW_LAYER_ID] || overviewLayer.value?.composite || { items: [] },
)
const activeCompositeItems = computed(() =>
  activeComposite.value.items || [],
)
const overviewCompositeItems = computed(() => overviewComposite.value.items || [])
const activeCompositeMarkers = computed(() => overviewComposite.value.markers || [])
const activeCompositeEdges = computed(() => overviewComposite.value.edges || [])
const MARKER_TYPES = [
  { id: 'portal', label: '传送门', shortLabel: '门', color: '#b8fff2' },
  { id: 'extraction', label: '撤离点', shortLabel: '撤', color: '#ff5a5f' },
  { id: 'special-room', label: '特殊房间', shortLabel: '特', color: '#ffd84d' },
]
const HIDDEN_COMPOSITE_MARKER_TYPES_STORAGE_KEY = 'pph-hidden-composite-marker-types'
const HIDDEN_COMPOSITE_MARKER_IDS_STORAGE_KEY = 'pph-hidden-composite-marker-ids'
const SHOWN_COMPOSITE_MARKER_IDS_STORAGE_KEY = 'pph-shown-composite-marker-ids'
const COMPOSITE_MARKER_ICON_SIZE = { width: 54, height: 38 }
const COMPOSITE_EDGE_ARROW_TIP_OFFSET = 11
const COMPOSITE_EDGE_ARROW_LENGTH = 24
const COMPOSITE_EDGE_ARROW_WIDTH = 18
const COMPOSITE_EDGE_CHEVRON_SIZE = 8
const COMPOSITE_EDGE_CHEVRON_MIN_LENGTH = 86
const markerTypeIds = new Set(MARKER_TYPES.map((type) => type.id))
const hiddenCompositeMarkerTypes = ref(readCompositeMarkerVisibility(HIDDEN_COMPOSITE_MARKER_TYPES_STORAGE_KEY))
const hiddenCompositeMarkerIds = ref(readCompositeMarkerVisibility(HIDDEN_COMPOSITE_MARKER_IDS_STORAGE_KEY))
const shownCompositeMarkerIds = ref(readCompositeMarkerVisibility(SHOWN_COMPOSITE_MARKER_IDS_STORAGE_KEY))
const activeGeofenceStatus = computed(() => {
  if (!activeGeofence.value) return 'OFF'
  return isGamePositionInsideGeofence(
    latestGamePosition.value,
    activeGeofence.value,
    activeCoordinateTransform.value,
  ) ? 'INSIDE' : 'OUTSIDE'
})
const ROUTES_STORAGE_KEY = 'pph-routes'
const pointer = ref({ pixelX: 0, pixelY: 0, x: 0, y: 0 })
const sidebarOpen = ref(true)
const routePanelOpen = ref(false)
const routeEditMode = ref(false)
const routeStatus = ref(null)
const routes = ref(readStoredRoutes())
const activeRouteId = ref(routes.value[0]?.id || null)
const activeRoute = computed(() => routes.value.find((route) => route.id === activeRouteId.value) || null)
const isAddingSegment = ref(false)
const editingSegmentId = ref(null)
const editingSegment = computed(() => activeRoute.value?.segments.find((segment) => segment.id === editingSegmentId.value) || null)
const segmentPoints = ref([])
const routeImportInput = ref(null)
const calibrationMode = ref(false)
const calibrationPoints = ref([])
const geofenceMode = ref(false)
const geofenceCorners = ref([])
const geofenceForm = ref({ zMin: '', zMax: '' })
const transformForm = ref(createTransformForm())
const compositeItemDragMode = ref(false)
const compositeMarkerMode = ref(false)
const compositeConnectionMode = ref(false)
const markerVisibilityPickMode = ref(false)
const compositeConnectionDirection = ref(
  localStorage.getItem('pph-composite-connection-direction') === 'two-way' ? 'two-way' : 'one-way',
)
const pendingConnectionMarkerId = ref('')
const compositeMarkerType = ref('portal')
const compositeConnection = ref({ from: '', to: '' })
const markerLabelDrafts = ref({})
const scopedCompositeMarkers = computed(() =>
  isCompositeLayer.value
    ? activeCompositeMarkers.value
    : activeCompositeMarkers.value.filter((marker) => marker.layerId === activeLayer.value.id),
)
const visibleCompositeMarkers = computed(() =>
  scopedCompositeMarkers.value.filter((marker) => !isCompositeMarkerHidden(marker)),
)
const hiddenCompositeMarkerCount = computed(() =>
  scopedCompositeMarkers.value.length - visibleCompositeMarkers.value.length,
)
const compositePortalMarkers = computed(() =>
  visibleCompositeMarkers.value.filter((marker) => getCompositeMarkerType(marker).id === 'portal'),
)
const latestGamePosition = ref(null)
const realtimeEnabled = ref(localStorage.getItem('pph-realtime-enabled') === 'true')
const followEnabled = ref(localStorage.getItem('pph-follow-enabled') !== 'false')
const endpointDefaults = parseNavigationWebSocketUrl(
  localStorage.getItem('pph-websocket-url') || DEFAULT_NAVIGATION_WEBSOCKET_URL,
)
const navigationProtocol = ref(endpointDefaults.protocol)
const navigationHost = ref(endpointDefaults.host)
const navigationPort = ref(endpointDefaults.port)
const connection = ref('disconnected')
const statusMessage = ref('')
const navigationPosition = ref(null)
const navigationAngle = ref(null)
const navigationAngleConfidence = ref(0)
const navigationAngleLayerId = ref(null)
const navigationCoordinateSource = ref('none')
const navigationTimestamp = ref(null)
const manualLayerView = ref(false)
const navigationAngleLayer = computed(() => {
  if (!isCompositeLayer.value || !navigationAngleLayerId.value) return activeLayer.value
  return getLayerById(navigationAngleLayerId.value) || activeLayer.value
})
const navigationAngleOffset = computed(() => Number(navigationAngleLayer.value.navigation?.angleOffset) || 0)
const correctedNavigationAngle = computed(() =>
  applyLayerAngleOffset(navigationAngle.value, navigationAngleOffset.value),
)

const navigationUrl = computed(() =>
  `${navigationProtocol.value === 'wss' ? 'wss' : 'ws'}://${navigationHost.value.trim() || '127.0.0.1'}:${normalizeNavigationPort(navigationPort.value)}`,
)
const connectionLabel = computed(() => {
  if (!realtimeEnabled.value) return 'OFF'
  return {
    connecting: 'CONNECTING',
    connected: 'CONNECTED',
    disconnected: 'OFFLINE',
  }[connection.value]
})
const canSendRoute = computed(() =>
  connection.value === 'connected'
  && Boolean(activeRoute.value)
  && activeRoute.value.segments.some((segment) => !segment.isHidden && getSegmentPoints(segment).some(isRoutePointOnActiveLayer)),
)
const hudGamePosition = computed(() => latestGamePosition.value || {
  x: pointer.value.x,
  y: pointer.value.y,
  z: null,
})
const activePlaneAxes = computed(() => ({
  xoy: ['X', 'Y'],
  yoz: ['Y', 'Z'],
  xoz: ['X', 'Z'],
})[activeCoordinateTransform.value?.plane] || ['X', 'Y'])
const latestPlanePosition = computed(() =>
  transformGamePositionToPlane(latestGamePosition.value, activeCoordinateTransform.value),
)

let map
let imageTileLayer
let compositeImageLayer
let compositeMarkerLayer
let routeLayer
let calibrationLayer
let geofenceLayer
let navigationMarker
let socket
let reconnectTimer
let stopped = false
let navigationUsesGameCoordinates = false
let navigationArrowImage = null
let navigationDisplayAngle = null
let transformPersistTimer = null
let compositePersistTimer = null
let suppressTransformPersist = false
let annotationBaseZoom = null
let mapImageRenderToken = 0
let compositeAnnotationFrame = null
const mapTileImageCache = new Map()

function createTransformForm(value = {}) {
  const mirrorPlanes = Array.isArray(value?.mirrorPlanes) ? value.mirrorPlanes : []
  return {
    plane: ['xoy', 'yoz', 'xoz'].includes(value?.plane) ? value.plane : 'xoy',
    rotationX: Number(value?.rotationDegrees?.x ?? value?.rotateXDegrees) || 0,
    rotationY: Number(value?.rotationDegrees?.y ?? value?.rotateYDegrees) || 0,
    rotationZ: Number(value?.rotationDegrees?.z ?? value?.rotateZDegrees) || 0,
    mirrorXoy: mirrorPlanes.includes('xoy') || mirrorPlanes.includes('xy'),
    mirrorYoz: mirrorPlanes.includes('yoz') || mirrorPlanes.includes('yz'),
    mirrorXoz: mirrorPlanes.includes('xoz') || mirrorPlanes.includes('xz'),
    flipX: value?.flipAxes?.x === true,
    flipY: value?.flipAxes?.y === true,
    flipZ: value?.flipAxes?.z === true,
    offsetX: Number(value?.offset?.x) || 0,
    offsetY: Number(value?.offset?.y) || 0,
    offsetZ: Number(value?.offset?.z) || 0,
  }
}

function transformFormToConfig(form = transformForm.value) {
  const mirrorPlanes = [
    form.mirrorXoy ? 'xoy' : null,
    form.mirrorYoz ? 'yoz' : null,
    form.mirrorXoz ? 'xoz' : null,
  ].filter(Boolean)
  return {
    rotationDegrees: {
      x: Number(form.rotationX) || 0,
      y: Number(form.rotationY) || 0,
      z: Number(form.rotationZ) || 0,
    },
    plane: ['xoy', 'yoz', 'xoz'].includes(form.plane) ? form.plane : 'xoy',
    mirrorPlanes,
    flipAxes: {
      x: form.flipX === true,
      y: form.flipY === true,
      z: form.flipZ === true,
    },
    offset: {
      x: Number(form.offsetX) || 0,
      y: Number(form.offsetY) || 0,
      z: Number(form.offsetZ) || 0,
    },
  }
}

function readCalibrationOverrides() {
  try {
    const value = JSON.parse(localStorage.getItem('pph-layer-calibrations') || '{}')
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

function readGeofenceOverrides() {
  try {
    const value = JSON.parse(localStorage.getItem('pph-layer-geofences') || '{}')
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

function persistCalibrationOverrides() {
  if (!isDevelopment) return
  localStorage.setItem('pph-layer-calibrations', JSON.stringify(calibrationOverrides.value))
}

async function persistLayerCalibration(layerId, coordinateMapping) {
  const response = await fetch('/api/layer-calibration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layerId, coordinateMapping }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || '无法写回 layers.js')
  }
}

function persistGeofenceOverrides() {
  if (!isDevelopment) return
  localStorage.setItem('pph-layer-geofences', JSON.stringify(geofenceOverrides.value))
}

function getLayerCoordinateMapping(layer) {
  return calibrationOverrides.value[layer.id] || layer.coordinateMapping
}

function getLayerCoordinateTransform(layer) {
  return coordinateTransformOverrides.value[layer.id] || layer.coordinateTransform || null
}

function getLayerById(layerId) {
  return MAP_LAYERS.find((layer) => layer.id === layerId) || null
}

function getLayerMapper(layer) {
  return createLayerCoordinateMapper({
    ...layer,
    coordinateMapping: getLayerCoordinateMapping(layer),
    coordinateTransform: getLayerCoordinateTransform(layer),
  })
}

function getLayerGeofence(layer) {
  return normalizeLayerGeofence(geofenceOverrides.value[layer.id] || layer.geofence)
}

function getConfiguredGeofenceLayers() {
  return MAP_LAYERS
    .map((layer) => ({ layer, geofence: getLayerGeofence(layer) }))
    .filter(({ geofence }) => geofence)
}

function findLayerForGamePosition(position) {
  return getConfiguredGeofenceLayers()
    .find(({ layer, geofence }) => isGamePositionInsideGeofence(position, geofence, getLayerCoordinateTransform(layer)))
    ?.layer || null
}

function findCompositeItemForGamePosition(position) {
  if (!position) return null
  return activeCompositeItems.value
    .map((item) => ({ item, layer: getLayerById(item.layerId) }))
    .filter(({ layer }) => layer)
    .find(({ layer }) => {
      const geofence = getLayerGeofence(layer)
      return geofence && isGamePositionInsideGeofence(position, geofence, getLayerCoordinateTransform(layer))
    }) || null
}

function resolveCompositeNavigationPosition(position) {
  const matched = findCompositeItemForGamePosition(position)
  if (!matched) return null
  const childMapper = getLayerMapper(matched.layer)
  const childLocator = childMapper.gameToLocator(position)
  if (!Number.isFinite(childLocator.pixelX) || !Number.isFinite(childLocator.pixelY)) return null
  return {
    layer: matched.layer,
    position: {
      pixelX: Number(matched.item.x || 0)
        + childLocator.pixelX * matched.layer.image.width / matched.layer.locator.sourceWidth,
      pixelY: Number(matched.item.y || 0)
        + childLocator.pixelY * matched.layer.image.height / matched.layer.locator.sourceHeight,
      sourceWidth: activeLayer.value.locator.sourceWidth,
      sourceHeight: activeLayer.value.locator.sourceHeight,
    },
  }
}

function getCompositeConfigWith(items = overviewCompositeItems.value, markers = activeCompositeMarkers.value, edges = activeCompositeEdges.value) {
  return {
    items: items.map((item) => ({ ...item })),
    markers: markers.map((marker) => normalizeCompositeMarker(marker)),
    edges: edges.map((edge) => normalizeCompositeEdge(edge)),
  }
}

function normalizeCompositeEdge(edge) {
  const points = Array.isArray(edge?.points)
    ? edge.points
        .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : []
  return {
    from: edge?.from,
    to: edge?.to,
    bidirectional: edge?.bidirectional === true,
    points,
  }
}

function getCompositeMarkerType(marker) {
  return MARKER_TYPES.find((type) => type.id === marker?.type) || MARKER_TYPES[0]
}

function readCompositeMarkerVisibility(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (Array.isArray(parsed)) {
      return parsed.reduce((result, key) => {
        if (key) result[String(key)] = true
        return result
      }, {})
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).reduce((result, [key, enabled]) => {
        if (key && enabled === true) result[String(key)] = true
        return result
      }, {})
    }
  } catch {
    // Ignore invalid local storage state.
  }
  return {}
}

function persistCompositeMarkerVisibility(storageKey, visibility) {
  const hiddenKeys = Object.entries(visibility || {})
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => key)
  localStorage.setItem(storageKey, JSON.stringify(hiddenKeys))
}

function readStoredRoutes() {
  try {
    const storedRoutes = JSON.parse(localStorage.getItem(ROUTES_STORAGE_KEY) || '[]')
    return normalizeRoutes(Array.isArray(storedRoutes) ? storedRoutes : storedRoutes?.routes)
  } catch {
    return []
  }
}

function persistRoutesLocally() {
  localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(normalizeRoutes(routes.value)))
}

function downloadJson(payload, filename) {
  const blobUrl = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
}

function getCompositeMarkerDisplayGlyph(marker) {
  const markerType = getCompositeMarkerType(marker)
  if (markerType.id === 'portal' || markerType.id === 'special-room') return ''
  return markerType.shortLabel
}

function getCompositeMarkerBadge(markerOrType) {
  const markerType = markerTypeIds.has(markerOrType?.id)
    ? markerOrType
    : getCompositeMarkerType(markerOrType)
  return markerType.shortLabel || markerType.label.slice(0, 1)
}

function isCompositeMarkerTypeHidden(type) {
  return hiddenCompositeMarkerTypes.value[type] === true
}

function isCompositeMarkerIdHidden(markerId) {
  return hiddenCompositeMarkerIds.value[markerId] === true
}

function isCompositeMarkerIdShown(markerId) {
  return shownCompositeMarkerIds.value[markerId] === true
}

function isCompositeMarkerHidden(marker) {
  if (!marker) return true
  if (isCompositeMarkerIdHidden(marker.id)) return true
  return isCompositeMarkerTypeHidden(getCompositeMarkerType(marker).id) && !isCompositeMarkerIdShown(marker.id)
}

function setCompositeMarkerTypeHidden(type, hidden) {
  if (!markerTypeIds.has(type)) return
  const nextVisibility = { ...hiddenCompositeMarkerTypes.value }
  if (hidden) nextVisibility[type] = true
  else delete nextVisibility[type]
  hiddenCompositeMarkerTypes.value = nextVisibility
  const nextShownMarkers = { ...shownCompositeMarkerIds.value }
  scopedCompositeMarkers.value
    .filter((marker) => getCompositeMarkerType(marker).id === type)
    .forEach((marker) => delete nextShownMarkers[marker.id])
  shownCompositeMarkerIds.value = nextShownMarkers
}

function toggleCompositeMarkerTypeVisibility(type) {
  setCompositeMarkerTypeHidden(type, !isCompositeMarkerTypeHidden(type))
}

function setCompositeMarkerHidden(markerId, hidden) {
  if (!markerId) return
  const nextVisibility = { ...hiddenCompositeMarkerIds.value }
  if (hidden) nextVisibility[markerId] = true
  else delete nextVisibility[markerId]
  hiddenCompositeMarkerIds.value = nextVisibility
  const nextShownMarkers = { ...shownCompositeMarkerIds.value }
  delete nextShownMarkers[markerId]
  shownCompositeMarkerIds.value = nextShownMarkers
}

function setCompositeMarkerShown(markerId, shown) {
  if (!markerId) return
  const nextShownMarkers = { ...shownCompositeMarkerIds.value }
  if (shown) nextShownMarkers[markerId] = true
  else delete nextShownMarkers[markerId]
  shownCompositeMarkerIds.value = nextShownMarkers
  if (shown) {
    const nextHiddenMarkers = { ...hiddenCompositeMarkerIds.value }
    delete nextHiddenMarkers[markerId]
    hiddenCompositeMarkerIds.value = nextHiddenMarkers
  }
}

function toggleCompositeMarkerVisibility(marker) {
  if (!marker) return
  if (isCompositeMarkerHidden(marker)) {
    setCompositeMarkerShown(marker.id, true)
    showStatus(`${marker.label || '未命名'} 已显示`)
  } else {
    setCompositeMarkerHidden(marker.id, true)
    showStatus(`${marker.label || '未命名'} 已隐藏`)
  }
}

function hideAllCompositeMarkers() {
  hiddenCompositeMarkerIds.value = scopedCompositeMarkers.value.reduce((result, marker) => {
    result[marker.id] = true
    return result
  }, {})
  shownCompositeMarkerIds.value = {}
}

function showAllCompositeMarkers() {
  hiddenCompositeMarkerTypes.value = {}
  hiddenCompositeMarkerIds.value = {}
  shownCompositeMarkerIds.value = {}
}

function toggleAreaLayerList() {
  areaLayerListOpen.value = !areaLayerListOpen.value
}

function toggleMarkerVisibilityPickMode() {
  markerVisibilityPickMode.value = !markerVisibilityPickMode.value
  if (markerVisibilityPickMode.value) {
    routeEditMode.value = false
    compositeMarkerMode.value = false
    compositeItemDragMode.value = false
    compositeConnectionMode.value = false
    pendingConnectionMarkerId.value = ''
  }
  renderCompositeAnnotations()
  showStatus(markerVisibilityPickMode.value ? '点选地图标点切换显示/隐藏' : '标点点选已关闭')
}

function normalizeCompositeMarker(marker) {
  const type = markerTypeIds.has(marker?.type) ? marker.type : MARKER_TYPES[0].id
  return {
    ...marker,
    type,
    label: String(marker?.label ?? ''),
  }
}

function syncTransformFormFromLayer() {
  suppressTransformPersist = true
  transformForm.value = createTransformForm(getLayerCoordinateTransform(activeLayer.value))
  nextTick(() => {
    suppressTransformPersist = false
  })
}

async function persistLayerCoordinateTransform(layerId, coordinateTransform) {
  const response = await fetch('/api/layer-transform', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layerId, coordinateTransform }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || '写入 layers.js 失败')
}

function applyTransformForm() {
  const layerId = activeLayer.value.id
  const coordinateTransform = transformFormToConfig()
  coordinateTransformOverrides.value = {
    ...coordinateTransformOverrides.value,
    [layerId]: coordinateTransform,
  }
  segmentPoints.value = []
  renderRoute()
  renderCalibrationPoints()
  renderGeofence()
  if (navigationUsesGameCoordinates && latestGamePosition.value) {
    const locator = mapper.value.gameToLocator(latestGamePosition.value)
    navigationPosition.value = {
      ...locator,
      sourceWidth: activeLayer.value.locator.sourceWidth,
      sourceHeight: activeLayer.value.locator.sourceHeight,
    }
    renderNavigationMarker()
  }
  return coordinateTransform
}

function scheduleTransformPersist() {
  if (!isDevelopment || suppressTransformPersist) return
  const layerId = activeLayer.value.id
  const coordinateTransform = applyTransformForm()
  if (transformPersistTimer) window.clearTimeout(transformPersistTimer)
  transformPersistTimer = window.setTimeout(async () => {
    transformPersistTimer = null
    try {
      await persistLayerCoordinateTransform(layerId, coordinateTransform)
      showStatus('坐标平面配置已写入 layers.js')
    } catch (error) {
      showStatus(`坐标平面已临时生效，但写回失败：${error.message}`)
    }
  }, 280)
}

async function persistLayerComposite(layerId, composite) {
  const response = await fetch('/api/layer-composite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ layerId, composite }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || '写入 layers.js 失败')
}

function scheduleCompositePersist(composite = overviewComposite.value, delay = 280) {
  if (!isDevelopment || !overviewLayer.value?.composite) return
  const layerId = OVERVIEW_LAYER_ID
  if (compositePersistTimer) window.clearTimeout(compositePersistTimer)
  compositePersistTimer = window.setTimeout(async () => {
    compositePersistTimer = null
    try {
      await persistLayerComposite(layerId, composite)
      showStatus('地图标点已写入 layers.js')
    } catch (error) {
      showStatus(`地图标点已临时生效，但写回失败：${error.message}`)
    }
  }, delay)
}

function updateCompositeConfig(nextComposite, options = {}) {
  compositeLayoutOverrides.value = {
    ...compositeLayoutOverrides.value,
    [OVERVIEW_LAYER_ID]: nextComposite,
  }
  renderCompositeAnnotations()
  scheduleCompositePersist(nextComposite, options.persistImmediately ? 0 : 280)
}

function updateCompositeItemPosition(layerId, x, y) {
  const nextItems = overviewCompositeItems.value.map((item) =>
    item.layerId === layerId
      ? { ...item, x: Math.round(x), y: Math.round(y) }
      : { ...item },
  )
  updateCompositeConfig(getCompositeConfigWith(nextItems, activeCompositeMarkers.value, activeCompositeEdges.value))
}

function getAnnotationScale() {
  if (!map) return 1
  annotationBaseZoom ??= map.getZoom()
  return Math.min(1, 2 ** (map.getZoom() - annotationBaseZoom))
}

function updateAnnotationScaleCss() {
  mapElement.value?.style.setProperty('--annotation-scale', getAnnotationScale().toFixed(3))
}

function resetAnnotationScaleBase() {
  if (!map) return
  annotationBaseZoom = map.getZoom()
  updateAnnotationScaleCss()
}

function startCompositeMarkerMode() {
  routeEditMode.value = false
  compositeItemDragMode.value = false
  compositeConnectionMode.value = false
  markerVisibilityPickMode.value = false
  pendingConnectionMarkerId.value = ''
  cancelCalibration()
  cancelGeofenceCalibration()
  compositeMarkerMode.value = true
  const scope = isCompositeLayer.value ? '总览中的任意子图' : '当前区域'
  showStatus(`点击${scope}添加${getCompositeMarkerType({ type: compositeMarkerType.value }).label}`)
}

function toggleCompositeItemDragMode() {
  if (!isCompositeLayer.value) return
  compositeItemDragMode.value = !compositeItemDragMode.value
  if (compositeItemDragMode.value) {
    compositeMarkerMode.value = false
    compositeConnectionMode.value = false
    markerVisibilityPickMode.value = false
    pendingConnectionMarkerId.value = ''
  }
  renderCompositeAnnotations()
  showStatus(compositeItemDragMode.value ? '子图拖动已开启' : '子图拖动已关闭')
}

function addCompositeMarker(latlng) {
  const localPosition = getMarkerLocalPosition(latlng)
  if (!localPosition) {
    showStatus(isCompositeLayer.value ? '请点击某个子地图内部添加标记点' : '请点击当前地图范围内添加标记点')
    return
  }
  const id = `m${Date.now().toString(36)}`
  const markerType = getCompositeMarkerType({ type: compositeMarkerType.value })
  const marker = {
    id,
    label: `${markerType.label}${activeCompositeMarkers.value.length + 1}`,
    type: markerType.id,
    layerId: localPosition.layerId,
    x: localPosition.x,
    y: localPosition.y,
  }
  const nextComposite = getCompositeConfigWith(
    overviewCompositeItems.value,
    [...activeCompositeMarkers.value, marker],
    activeCompositeEdges.value,
  )
  updateCompositeConfig(nextComposite)
  compositeMarkerMode.value = false
  compositeConnection.value = { ...compositeConnection.value, from: compositeConnection.value.from || id }
  showStatus(`${getCompositeMarkerType(marker).label}已添加`)
}

function getMarkerLocalPosition(latlng) {
  if (isCompositeLayer.value) {
    const hit = getCompositeHit(latlng)
    if (!hit) return null
    return {
      layerId: hit.item.layerId,
      x: Math.round(Number(latlng.lng) - Number(hit.item.x || 0)),
      y: Math.round(-Number(latlng.lat) - Number(hit.item.y || 0)),
    }
  }
  const x = Number(latlng.lng)
  const y = -Number(latlng.lat)
  if (x < 0 || y < 0 || x > activeLayer.value.image.width || y > activeLayer.value.image.height) return null
  return {
    layerId: activeLayer.value.id,
    x: Math.round(x),
    y: Math.round(y),
  }
}

function updateCompositeMarkerLabel(markerId, label) {
  const nextMarkers = activeCompositeMarkers.value.map((marker) =>
    marker.id === markerId
      ? { ...normalizeCompositeMarker(marker), label: String(label ?? '') }
      : normalizeCompositeMarker(marker),
  )
  updateCompositeConfig(getCompositeConfigWith(overviewCompositeItems.value, nextMarkers, activeCompositeEdges.value))
}

function getCompositeMarkerLabelDraft(marker) {
  return Object.prototype.hasOwnProperty.call(markerLabelDrafts.value, marker.id)
    ? markerLabelDrafts.value[marker.id]
    : marker.label
}

function setCompositeMarkerLabelDraft(markerId, label) {
  markerLabelDrafts.value = {
    ...markerLabelDrafts.value,
    [markerId]: String(label ?? ''),
  }
}

function commitCompositeMarkerLabel(markerId) {
  if (!Object.prototype.hasOwnProperty.call(markerLabelDrafts.value, markerId)) return
  updateCompositeMarkerLabel(markerId, markerLabelDrafts.value[markerId])
  const nextDrafts = { ...markerLabelDrafts.value }
  delete nextDrafts[markerId]
  markerLabelDrafts.value = nextDrafts
}

function updateCompositeMarkerType(markerId, type) {
  if (!markerTypeIds.has(type)) return
  const nextMarkers = activeCompositeMarkers.value.map((marker) =>
    marker.id === markerId ? { ...marker, type } : normalizeCompositeMarker(marker),
  )
  const portalIds = new Set(nextMarkers
    .filter((marker) => getCompositeMarkerType(marker).id === 'portal')
    .map((marker) => marker.id))
  const nextEdges = activeCompositeEdges.value.filter((edge) => portalIds.has(edge.from) && portalIds.has(edge.to))
  updateCompositeConfig(getCompositeConfigWith(overviewCompositeItems.value, nextMarkers, nextEdges))
}

function removeCompositeMarker(markerId) {
  const nextMarkers = activeCompositeMarkers.value.filter((marker) => marker.id !== markerId)
  const nextEdges = activeCompositeEdges.value.filter((edge) => edge.from !== markerId && edge.to !== markerId)
  if (pendingConnectionMarkerId.value === markerId) pendingConnectionMarkerId.value = ''
  const nextDrafts = { ...markerLabelDrafts.value }
  delete nextDrafts[markerId]
  markerLabelDrafts.value = nextDrafts
  setCompositeMarkerHidden(markerId, false)
  updateCompositeConfig(getCompositeConfigWith(overviewCompositeItems.value, nextMarkers, nextEdges))
}

function addCompositeEdge(from = compositeConnection.value.from, to = compositeConnection.value.to) {
  if (!from || !to || from === to) {
    showStatus('请选择两个不同的标记点')
    return
  }
  const fromMarker = activeCompositeMarkers.value.find((marker) => marker.id === from)
  const toMarker = activeCompositeMarkers.value.find((marker) => marker.id === to)
  if (getCompositeMarkerType(fromMarker).id !== 'portal' || getCompositeMarkerType(toMarker).id !== 'portal') {
    showStatus('只有传送门标点之间可以建立有向连接')
    return
  }

  const bidirectional = compositeConnectionDirection.value === 'two-way'
  const existingEdgeIndex = activeCompositeEdges.value.findIndex((edge) =>
    edge.from === from && edge.to === to,
  )
  const reverseEdgeIndex = activeCompositeEdges.value.findIndex((edge) =>
    edge.from === to && edge.to === from,
  )
  if (existingEdgeIndex >= 0) {
    const existingEdge = activeCompositeEdges.value[existingEdgeIndex]
    if (!bidirectional || existingEdge.bidirectional === true) {
      showStatus(bidirectional ? '双向连接已经存在' : '这条有向连接已经存在')
      return
    }
    const nextEdges = activeCompositeEdges.value
      .map((edge, index) =>
        index === existingEdgeIndex ? { ...normalizeCompositeEdge(edge), bidirectional: true } : normalizeCompositeEdge(edge),
      )
      .filter((_, index) => !bidirectional || index !== reverseEdgeIndex)
    updateCompositeConfig(getCompositeConfigWith(overviewCompositeItems.value, activeCompositeMarkers.value, nextEdges), { persistImmediately: true })
    showStatus('已将连接改为双向箭头')
    return
  }

  if (bidirectional && reverseEdgeIndex >= 0) {
    const nextEdges = activeCompositeEdges.value.map((edge, index) => {
      const normalized = normalizeCompositeEdge(edge)
      return index === reverseEdgeIndex
        ? { from, to, bidirectional: true, points: [...normalized.points].reverse() }
        : normalized
    })
    updateCompositeConfig(getCompositeConfigWith(overviewCompositeItems.value, activeCompositeMarkers.value, nextEdges), { persistImmediately: true })
    showStatus('已将反向连接改为双向箭头')
    return
  }

  const nextEdges = [
    ...activeCompositeEdges.value,
    { from, to, bidirectional, points: [] },
  ]
  updateCompositeConfig(getCompositeConfigWith(overviewCompositeItems.value, activeCompositeMarkers.value, nextEdges), { persistImmediately: true })
  showStatus(compositeConnectionDirection.value === 'two-way' ? '传送门双向连接已添加' : '传送门单向连接已添加')
}

function removeCompositeEdge(index) {
  const nextEdges = activeCompositeEdges.value.filter((_, edgeIndex) => edgeIndex !== index)
  updateCompositeConfig(getCompositeConfigWith(overviewCompositeItems.value, activeCompositeMarkers.value, nextEdges), { persistImmediately: true })
}

function toggleCompositeConnectionMode() {
  if (!isCompositeLayer.value) return
  compositeItemDragMode.value = false
  compositeMarkerMode.value = false
  markerVisibilityPickMode.value = false
  compositeConnectionMode.value = !compositeConnectionMode.value
  pendingConnectionMarkerId.value = ''
  renderCompositeAnnotations()
  showStatus(compositeConnectionMode.value ? '连接编辑已开启：点击传送门连接，点击线段添加拐点' : '连接编辑已关闭')
}

function handleCompositeMarkerClick(marker, event) {
  L.DomEvent.stop(event)
  if (markerVisibilityPickMode.value) {
    toggleCompositeMarkerVisibility(marker)
    renderCompositeAnnotations()
    return
  }
  if (!isCompositeLayer.value || !compositeConnectionMode.value) return
  if (getCompositeMarkerType(marker).id !== 'portal') {
    showStatus('只能连接传送门标点')
    return
  }
  if (!pendingConnectionMarkerId.value) {
    pendingConnectionMarkerId.value = marker.id
    renderCompositeAnnotations()
    showStatus(`已选择起点：${marker.label}`)
    return
  }
  const from = pendingConnectionMarkerId.value
  const to = marker.id
  pendingConnectionMarkerId.value = ''
  renderCompositeAnnotations()
  if (from === to) {
    showStatus('请选择另一个传送门作为终点')
    return
  }
  addCompositeEdge(from, to)
}

function layerBounds(layer = activeLayer.value) {
  return L.latLngBounds([-layer.image.height, 0], [0, layer.image.width])
}

function activeViewBounds() {
  if (!isCompositeLayer.value) return layerBounds()
  const bounds = activeCompositeItems.value.reduce((combined, item) => {
    const resolved = compositeItemBounds(item)
    if (!resolved) return combined
    if (!combined) return L.latLngBounds(resolved.bounds.getSouthWest(), resolved.bounds.getNorthEast())
    return combined.extend(resolved.bounds)
  }, null)
  return bounds || layerBounds()
}

function compositeItemBounds(item) {
  const layer = getLayerById(item.layerId)
  if (!layer) return null
  const x = Number(item.x) || 0
  const y = Number(item.y) || 0
  return {
    layer,
    bounds: L.latLngBounds(
      [-(y + layer.image.height), x],
      [-y, x + layer.image.width],
    ),
  }
}

function sortedCompositeImageEntries() {
  let center = null
  try {
    center = map?._loaded ? map.getCenter() : activeViewBounds().getCenter()
  } catch {
    center = null
  }
  return activeCompositeItems.value
    .map((item) => {
      const resolved = compositeItemBounds(item)
      return resolved ? { item, resolved } : null
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!center) return 0
      const aCenter = a.resolved.bounds.getCenter()
      const bCenter = b.resolved.bounds.getCenter()
      const aDistance = (aCenter.lat - center.lat) ** 2 + (aCenter.lng - center.lng) ** 2
      const bDistance = (bCenter.lat - center.lat) ** 2 + (bCenter.lng - center.lng) ** 2
      return aDistance - bDistance
    })
}

function versionedMapTileUrl(layerId, z, x, y) {
  return `/map-tiles/${encodeURIComponent(layerId)}/${z}/${x}/${y}.webp?v=${encodeURIComponent(MAP_ASSET_VERSION)}`
}

function loadMapTileImage(url) {
  if (mapTileImageCache.has(url)) return mapTileImageCache.get(url)
  const promise = new Promise((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
  mapTileImageCache.set(url, promise)
  return promise
}

function clampTileZoom(zoom) {
  return Math.max(MAP_TILE_MIN_ZOOM, Math.min(MAP_TILE_MAX_NATIVE_ZOOM, Number(zoom) || 0))
}

async function drawSourceTilesToCanvas(canvas, sourceLayer, offsetX, offsetY, coords) {
  const tileSize = MAP_TILE_SIZE
  const z = clampTileZoom(coords.z)
  const scale = 2 ** z
  const tileMapX = coords.x * tileSize / scale
  const tileMapY = coords.y * tileSize / scale
  const tileMapWidth = tileSize / scale
  const tileMapHeight = tileSize / scale
  const imageWidth = sourceLayer.image.width
  const imageHeight = sourceLayer.image.height
  const imageLeft = offsetX
  const imageTop = offsetY
  const imageRight = imageLeft + imageWidth
  const imageBottom = imageTop + imageHeight
  const overlapLeft = Math.max(tileMapX, imageLeft)
  const overlapTop = Math.max(tileMapY, imageTop)
  const overlapRight = Math.min(tileMapX + tileMapWidth, imageRight)
  const overlapBottom = Math.min(tileMapY + tileMapHeight, imageBottom)
  if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) return

  const sourceLeft = (overlapLeft - imageLeft) * scale
  const sourceTop = (overlapTop - imageTop) * scale
  const sourceRight = (overlapRight - imageLeft) * scale
  const sourceBottom = (overlapBottom - imageTop) * scale
  const firstSourceTileX = Math.floor(sourceLeft / tileSize)
  const firstSourceTileY = Math.floor(sourceTop / tileSize)
  const lastSourceTileX = Math.floor((sourceRight - 0.001) / tileSize)
  const lastSourceTileY = Math.floor((sourceBottom - 0.001) / tileSize)
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = z !== 0
  context.imageSmoothingQuality = 'high'

  const drawTasks = []
  for (let sourceTileY = firstSourceTileY; sourceTileY <= lastSourceTileY; sourceTileY += 1) {
    for (let sourceTileX = firstSourceTileX; sourceTileX <= lastSourceTileX; sourceTileX += 1) {
      drawTasks.push((async () => {
        const image = await loadMapTileImage(versionedMapTileUrl(sourceLayer.id, z, sourceTileX, sourceTileY))
        if (!image) return
        const sourceTileLeft = sourceTileX * tileSize
        const sourceTileTop = sourceTileY * tileSize
        const cropLeft = Math.max(sourceLeft, sourceTileLeft)
        const cropTop = Math.max(sourceTop, sourceTileTop)
        const cropRight = Math.min(sourceRight, sourceTileLeft + tileSize)
        const cropBottom = Math.min(sourceBottom, sourceTileTop + tileSize)
        if (cropLeft >= cropRight || cropTop >= cropBottom) return
        const cropWidth = cropRight - cropLeft
        const cropHeight = cropBottom - cropTop
        const destX = cropLeft + (imageLeft - tileMapX) * scale
        const destY = cropTop + (imageTop - tileMapY) * scale
        context.drawImage(
          image,
          cropLeft - sourceTileLeft,
          cropTop - sourceTileTop,
          cropWidth,
          cropHeight,
          destX,
          destY,
          cropWidth,
          cropHeight,
        )
      })())
    }
  }

  await Promise.all(drawTasks)
}

const MapImageTileLayer = L.GridLayer.extend({
  createTile(coords, done) {
    const canvas = L.DomUtil.create('canvas', 'map-image-tile')
    canvas.width = MAP_TILE_SIZE
    canvas.height = MAP_TILE_SIZE
    const { sourceLayer, item, interactive } = this.options
    if (interactive) {
      canvas.classList.add('map-image-tile--interactive')
      canvas.classList.toggle('map-image-tile--moveable', compositeItemDragMode.value)
      L.DomEvent.on(canvas, 'click', (event) => {
        if (!compositeMarkerMode.value || !map) return
        L.DomEvent.stop(event)
        addCompositeMarker(map.mouseEventToLatLng(event))
      })
      L.DomEvent.on(canvas, 'mousedown', (event) => beginCompositeItemDrag(event, item, sourceLayer, this, canvas))
    }
    drawSourceTilesToCanvas(
      canvas,
      sourceLayer,
      Number(item?.x) || 0,
      Number(item?.y) || 0,
      coords,
    ).then(
      () => done(null, canvas),
      () => done(null, canvas),
    )
    return canvas
  },
})

function createMapTileLayer(layer, item = { x: 0, y: 0 }, options = {}) {
  const bounds = L.latLngBounds(
    [-(Number(item.y || 0) + layer.image.height), Number(item.x || 0)],
    [-Number(item.y || 0), Number(item.x || 0) + layer.image.width],
  )
  return new MapImageTileLayer({
    sourceLayer: layer,
    item,
    bounds,
    tileSize: MAP_TILE_SIZE,
    minNativeZoom: MAP_TILE_MIN_ZOOM,
    maxNativeZoom: MAP_TILE_MAX_NATIVE_ZOOM,
    minZoom: MAP_TILE_MIN_ZOOM,
    maxZoom: 2,
    noWrap: true,
    keepBuffer: 2,
    updateWhenIdle: false,
    updateWhenZooming: false,
    ...options,
  })
}

function renderSingleMapImage(token) {
  if (!map || token !== mapImageRenderToken || isCompositeLayer.value) return
  imageTileLayer = createMapTileLayer(activeLayer.value).addTo(map)
  if (token === mapImageRenderToken) renderCompositeAnnotations()
}

function renderCompositeMapImages(token) {
  sortedCompositeImageEntries().forEach((entry) => {
    if (!map || token !== mapImageRenderToken || !compositeImageLayer) return
    const layer = createMapTileLayer(entry.resolved.layer, entry.item, {
      interactive: true,
      pane: 'compositeImagePane',
    })
    layer.addTo(compositeImageLayer)
  })
}

function scheduleCompositeAnnotationsRender() {
  if (compositeAnnotationFrame !== null) return
  compositeAnnotationFrame = window.requestAnimationFrame(() => {
    compositeAnnotationFrame = null
    renderCompositeAnnotations()
  })
}

function getCompositeMarkerPosition(marker) {
  const item = activeCompositeItems.value.find((candidate) => candidate.layerId === marker.layerId)
  if (!item) return null
  const x = Number(item.x || 0) + Number(marker.x || 0)
  const y = Number(item.y || 0) + Number(marker.y || 0)
  return { x, y, latlng: [-y, x] }
}

function getCompositeHit(latlng) {
  const x = Number(latlng.lng)
  const y = -Number(latlng.lat)
  return activeCompositeItems.value
    .map((item) => ({ item, layer: getLayerById(item.layerId) }))
    .filter(({ layer }) => layer)
    .find(({ item, layer }) =>
      x >= Number(item.x || 0)
      && x <= Number(item.x || 0) + layer.image.width
      && y >= Number(item.y || 0)
      && y <= Number(item.y || 0) + layer.image.height,
    ) || null
}

function renderMapImages() {
  if (!map) return
  const token = ++mapImageRenderToken
  imageTileLayer?.remove()
  imageTileLayer = null
  compositeImageLayer?.remove()
  compositeImageLayer = null
  compositeMarkerLayer?.remove()
  compositeMarkerLayer = null

  if (isCompositeLayer.value) {
    compositeImageLayer = L.layerGroup().addTo(map)
    renderCompositeAnnotations()
    renderCompositeMapImages(token)
    return
  }

  renderSingleMapImage(token)
}

function beginCompositeItemDrag(event, item, layer, tileLayer, element) {
  if (!isDevelopment || !isCompositeLayer.value || !compositeItemDragMode.value || !map) return
  L.DomEvent.stop(event)
  const startLatLng = map.mouseEventToLatLng(event)
  const startX = Number(item.x) || 0
  const startY = Number(item.y) || 0
  let nextX = startX
  let nextY = startY
  element.classList.add('map-image-tile--dragging')
  map.dragging.disable()

  const move = (moveEvent) => {
    const latlng = map.mouseEventToLatLng(moveEvent)
    nextX = startX + latlng.lng - startLatLng.lng
    nextY = startY - (latlng.lat - startLatLng.lat)
    item.x = nextX
    item.y = nextY
    tileLayer.options.bounds = L.latLngBounds(
      [-(nextY + layer.image.height), nextX],
      [-nextY, nextX + layer.image.width],
    )
    tileLayer.redraw()
    renderCompositeAnnotations()
  }

  const end = () => {
    L.DomEvent.off(document, 'mousemove', move)
    L.DomEvent.off(document, 'mouseup', end)
    element.classList.remove('map-image-tile--dragging')
    map.dragging.enable()
    updateCompositeItemPosition(item.layerId, nextX, nextY)
    showStatus(`${layer.name} 位置已更新：${Math.round(nextX)}, ${Math.round(nextY)}`)
  }

  L.DomEvent.on(document, 'mousemove', move)
  L.DomEvent.on(document, 'mouseup', end)
}

function renderCompositeAnnotations() {
  if (!map) return
  updateAnnotationScaleCss()
  compositeMarkerLayer?.remove()
  compositeMarkerLayer = null

  compositeMarkerLayer = L.layerGroup().addTo(map)
  if (isCompositeLayer.value) {
    const edgeEndpoints = activeCompositeEdges.value
      .map((edge) => {
        const from = activeCompositeMarkers.value.find((marker) => marker.id === edge.from)
        const to = activeCompositeMarkers.value.find((marker) => marker.id === edge.to)
        if (isCompositeMarkerHidden(from) || isCompositeMarkerHidden(to)) return null
        if (getCompositeMarkerType(from).id !== 'portal' || getCompositeMarkerType(to).id !== 'portal') return null
        const fromPosition = from && getMapMarkerPosition(from)
        const toPosition = to && getMapMarkerPosition(to)
        if (!fromPosition || !toPosition) return null
        return { edge, fromPosition, toPosition }
      })
      .filter(Boolean)
    renderCompositeEdges(edgeEndpoints)
  }

  const renderedMarkers = markerVisibilityPickMode.value ? scopedCompositeMarkers.value : visibleCompositeMarkers.value
  renderedMarkers.forEach((marker) => {
    const position = getMapMarkerPosition(marker)
    if (!position) return
    const markerType = getCompositeMarkerType(marker)
    const markerTypeGlyph = getCompositeMarkerDisplayGlyph(marker)
    const markerTypeGlyphHtml = markerTypeGlyph ? `<i>${markerTypeGlyph}</i>` : ''
    const hidden = isCompositeMarkerHidden(marker)
    const markerLayer = L.marker(position.latlng, {
      icon: L.divIcon({
        className: [
          'composite-point-marker',
          `composite-point-marker--${markerType.id}`,
          hidden ? 'composite-point-marker--hidden' : '',
          markerVisibilityPickMode.value ? 'composite-point-marker--visibility-pick' : '',
          pendingConnectionMarkerId.value === marker.id ? 'composite-point-marker--selected' : '',
        ].join(' '),
        html: `<span title="${markerType.label}: ${marker.label || '未命名'}" style="--marker-color: ${markerType.color}">${markerTypeGlyphHtml}<b>${marker.label || '未命名'}</b></span>`,
        iconSize: [COMPOSITE_MARKER_ICON_SIZE.width, COMPOSITE_MARKER_ICON_SIZE.height],
        iconAnchor: [COMPOSITE_MARKER_ICON_SIZE.width / 2, COMPOSITE_MARKER_ICON_SIZE.height / 2],
      }),
    }).addTo(compositeMarkerLayer)
    markerLayer.on('click', (event) => handleCompositeMarkerClick(marker, event))
  })
}

function getMapMarkerPosition(marker) {
  if (isCompositeLayer.value) return getCompositeMarkerPosition(marker)
  if (marker.layerId !== activeLayer.value.id) return null
  const x = Number(marker.x || 0)
  const y = Number(marker.y || 0)
  return { x, y, latlng: [-y, x] }
}

function renderCompositeEdges(edges) {
  if (!edges.length) return
  edges.forEach(({ edge, fromPosition, toPosition }, edgeIndex) => {
    const routePoints = getCompositeEdgeRoutePoints(edge, fromPosition, toPosition)
    const displayLatLngs = getDisplayEdgeLatLngs(routePoints, edge.bidirectional === true)
    if (displayLatLngs.length < 2) return

    const visibleEdge = createCompositeEdgeLayer(displayLatLngs, edge.bidirectional === true)
    visibleEdge.layer.addTo(compositeMarkerLayer)

    if (compositeConnectionMode.value) {
      routePoints.slice(0, -1).forEach((point, segmentIndex) => {
        const next = routePoints[segmentIndex + 1]
        L.polyline([pointToLatLng(point), pointToLatLng(next)], {
          color: '#fff',
          weight: 28,
          opacity: 0.01,
          interactive: true,
          bubblingMouseEvents: false,
          className: 'composite-edge-hit-path',
        }).on('click', (event) => {
          L.DomEvent.stop(event)
          insertCompositeEdgeWaypoint(edgeIndex, segmentIndex, event.latlng)
        }).addTo(compositeMarkerLayer)
      })

      ;(edge.points || []).forEach((point, pointIndex) => {
        const waypoint = L.marker(pointToLatLng(point), {
          draggable: true,
          icon: L.divIcon({
            className: 'composite-edge-waypoint-marker',
            html: '<span title="拖动移动，点击删除"></span>',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        }).addTo(compositeMarkerLayer)
        let dragged = false
        waypoint.on('dragstart', () => {
          dragged = true
        })
        waypoint.on('drag', (event) => {
          const liveRoute = getCompositeEdgeRoutePoints(edge, fromPosition, toPosition)
          liveRoute[pointIndex + 1] = latLngToPoint(event.latlng)
          const liveDisplayLatLngs = getDisplayEdgeLatLngs(liveRoute, edge.bidirectional === true)
          visibleEdge.update(liveDisplayLatLngs)
        })
        waypoint.on('dragend', (event) => {
          updateCompositeEdgeWaypoint(edgeIndex, pointIndex, event.target.getLatLng())
          window.setTimeout(() => {
            dragged = false
          }, 0)
        })
        waypoint.on('click', (event) => {
          L.DomEvent.stop(event)
          if (dragged) return
          removeCompositeEdgeWaypoint(edgeIndex, pointIndex)
        })
      })
    }
  })
}

function createCompositeEdgeLayer(latlngs, bidirectional = false) {
  const layer = L.layerGroup()
  const update = (nextLatLngs) => {
    layer.clearLayers()
    if (!map || !map._loaded || nextLatLngs.length < 2) return
    const scale = getAnnotationScale()
    const lineLatLngs = trimCompositeEdgeLatLngsForArrow(nextLatLngs, scale, bidirectional)
    addCompositeEdgeStrokeLayers(layer, lineLatLngs, scale)
    if (!bidirectional) createCompositeEdgeChevronLayers(nextLatLngs, scale).forEach((chevron) => chevron.addTo(layer))
    const arrow = createCompositeEdgeArrowLayer(nextLatLngs, scale)
    if (arrow) arrow.addTo(layer)
    if (bidirectional) {
      const reverseArrow = createCompositeEdgeArrowLayer([...nextLatLngs].reverse(), scale)
      if (reverseArrow) reverseArrow.addTo(layer)
    }
  }
  update(latlngs)
  return { layer, update }
}

function addCompositeEdgeStrokeLayers(layer, latlngs, scale = 1) {
  [
    { className: 'composite-edge-shadow', color: 'rgba(0,0,0,.82)', weight: 17, opacity: 1 },
    { className: 'composite-edge-rail', color: 'rgba(7,17,15,.92)', weight: 12, opacity: 1 },
    { className: 'composite-edge-core', color: '#b8fff2', weight: 7, opacity: 1 },
    {
      className: 'composite-edge-highlight',
      color: 'rgba(255,255,255,.78)',
      weight: 2,
      opacity: 1,
      dashArray: `${Math.round(16 * scale)} ${Math.round(18 * scale)}`,
      dashOffset: Math.round(5 * scale),
    },
  ].forEach((style) => {
    L.polyline(latlngs, {
      ...style,
      weight: style.weight * scale,
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 0,
    }).addTo(layer)
  })
}

function trimCompositeEdgeLatLngsForArrow(latlngs, scale = 1, trimStart = false) {
  if (!map || latlngs.length < 2) return latlngs
  const points = latlngs.map((latlng) => map.latLngToLayerPoint(latlng))
  if (trimStart) {
    const start = points[0]
    const next = points[1]
    const distance = getPointDistance(start, next)
    const trim = Math.min(COMPOSITE_EDGE_ARROW_LENGTH * scale * 0.54, distance * 0.45)
    if (trim > 0) points[0] = pointToward(start, next, trim)
  }
  const endIndex = points.length - 1
  const end = points[endIndex]
  const previous = points[endIndex - 1]
  const distance = getPointDistance(previous, end)
  const trim = Math.min(COMPOSITE_EDGE_ARROW_LENGTH * scale * 0.54, distance * 0.45)
  if (trim > 0) points[endIndex] = pointToward(end, previous, trim)
  return points.map((point) => map.layerPointToLatLng(point))
}

function createCompositeEdgeArrowLayer(latlngs, scale = 1) {
  if (!map || latlngs.length < 2) return null
  const points = latlngs.map((latlng) => map.latLngToLayerPoint(latlng))
  const tip = points[points.length - 1]
  const previous = points[points.length - 2]
  const vector = getUnitVector(previous, tip)
  const length = COMPOSITE_EDGE_ARROW_LENGTH * scale
  const halfWidth = COMPOSITE_EDGE_ARROW_WIDTH * scale / 2
  const base = {
    x: tip.x - vector.x * length,
    y: tip.y - vector.y * length,
  }
  const notch = {
    x: tip.x - vector.x * length * 0.56,
    y: tip.y - vector.y * length * 0.56,
  }
  const normal = { x: -vector.y, y: vector.x }
  const left = {
    x: base.x + normal.x * halfWidth,
    y: base.y + normal.y * halfWidth,
  }
  const right = {
    x: base.x - normal.x * halfWidth,
    y: base.y - normal.y * halfWidth,
  }
  const arrowLatLngs = [tip, left, notch, right].map((point) => map.layerPointToLatLng(point))
  return L.polygon(arrowLatLngs, {
    color: '#07110f',
    fillColor: '#b8fff2',
    fillOpacity: 1,
    opacity: 1,
    weight: 1.6 * scale,
    interactive: false,
    className: 'composite-edge-arrow-shape',
  })
}

function createCompositeEdgeChevronLayers(latlngs, scale = 1) {
  if (!map || latlngs.length < 2) return []
  const layers = []
  const points = latlngs.map((latlng) => map.latLngToLayerPoint(latlng))
  const size = COMPOSITE_EDGE_CHEVRON_SIZE * scale
  const minLength = COMPOSITE_EDGE_CHEVRON_MIN_LENGTH * scale
  points.slice(0, -1).forEach((point, index) => {
    const next = points[index + 1]
    const distance = getPointDistance(point, next)
    if (distance < minLength) return
    const vector = getUnitVector(point, next)
    const normal = { x: -vector.y, y: vector.x }
    const center = {
      x: point.x + (next.x - point.x) * 0.5,
      y: point.y + (next.y - point.y) * 0.5,
    }
    const tip = {
      x: center.x + vector.x * size,
      y: center.y + vector.y * size,
    }
    const back = {
      x: center.x - vector.x * size * 0.72,
      y: center.y - vector.y * size * 0.72,
    }
    const left = {
      x: back.x + normal.x * size * 0.62,
      y: back.y + normal.y * size * 0.62,
    }
    const right = {
      x: back.x - normal.x * size * 0.62,
      y: back.y - normal.y * size * 0.62,
    }
    layers.push(L.polyline([left, tip, right].map((chevronPoint) => map.layerPointToLatLng(chevronPoint)), {
      color: 'rgba(7,17,15,.88)',
      weight: 3 * scale,
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 0,
      className: 'composite-edge-chevron',
    }))
  })
  return layers
}

function pointToward(point, target, distance) {
  const total = getPointDistance(point, target)
  if (!Number.isFinite(total) || total === 0) return { ...point }
  const ratio = distance / total
  return {
    x: point.x + (target.x - point.x) * ratio,
    y: point.y + (target.y - point.y) * ratio,
  }
}

function getUnitVector(from, to) {
  const distance = getPointDistance(from, to) || 1
  return {
    x: (to.x - from.x) / distance,
    y: (to.y - from.y) / distance,
  }
}

function getPointDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function pointToLatLng(point) {
  return L.latLng(-Number(point.y || 0), Number(point.x || 0))
}

function latLngToPoint(latlng) {
  return {
    x: Math.round(Number(latlng.lng)),
    y: Math.round(-Number(latlng.lat)),
  }
}

function getCompositeEdgeRoutePoints(edge, fromPosition, toPosition) {
  return [
    { x: Number(fromPosition.x), y: Number(fromPosition.y) },
    ...(edge.points || []).map((point) => ({ x: Number(point.x), y: Number(point.y) })),
    { x: Number(toPosition.x), y: Number(toPosition.y) },
  ].filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
}

function getDisplayEdgeLatLngs(routePoints, bidirectional = false) {
  if (routePoints.length < 2) return []
  const latlngs = routePoints.map(pointToLatLng)
  if (!map || !map._loaded) return latlngs

  const layerPoints = latlngs.map((latlng) => map.latLngToLayerPoint(latlng))
  const first = layerPoints[0]
  const second = layerPoints[1]
  const beforeLast = layerPoints[layerPoints.length - 2]
  const last = layerPoints[layerPoints.length - 1]
  const firstVector = { x: second.x - first.x, y: second.y - first.y }
  const lastVector = { x: last.x - beforeLast.x, y: last.y - beforeLast.y }
  const firstLength = Math.max(1, Math.hypot(firstVector.x, firstVector.y))
  const lastLength = Math.max(1, Math.hypot(lastVector.x, lastVector.y))
  const firstUnit = { x: firstVector.x / firstLength, y: firstVector.y / firstLength }
  const lastUnit = { x: lastVector.x / lastLength, y: lastVector.y / lastLength }

  const sourcePadding = Math.min(
    markerBoxPadding(firstUnit, bidirectional ? COMPOSITE_EDGE_ARROW_TIP_OFFSET : 4),
    firstLength * 0.45,
  )
  const targetPadding = Math.min(
    markerBoxPadding(lastUnit, COMPOSITE_EDGE_ARROW_TIP_OFFSET),
    lastLength * 0.45,
  )
  const startLayerPoint = L.point(
    first.x + firstUnit.x * sourcePadding,
    first.y + firstUnit.y * sourcePadding,
  )
  const endLayerPoint = L.point(
    last.x - lastUnit.x * targetPadding,
    last.y - lastUnit.y * targetPadding,
  )

  return [
    map.layerPointToLatLng(startLayerPoint),
    ...latlngs.slice(1, -1),
    map.layerPointToLatLng(endLayerPoint),
  ]
}

function markerBoxPadding(unit, extra = 0) {
  const scale = getAnnotationScale()
  const halfWidth = COMPOSITE_MARKER_ICON_SIZE.width * scale / 2
  const halfHeight = COMPOSITE_MARKER_ICON_SIZE.height * scale / 2
  const xDistance = Math.abs(unit.x) > 0.001 ? halfWidth / Math.abs(unit.x) : Number.POSITIVE_INFINITY
  const yDistance = Math.abs(unit.y) > 0.001 ? halfHeight / Math.abs(unit.y) : Number.POSITIVE_INFINITY
  return Math.min(xDistance, yDistance) + extra * scale
}

function insertCompositeEdgeWaypoint(edgeIndex, segmentIndex, latlng) {
  const edge = activeCompositeEdges.value[edgeIndex]
  if (!edge) return
  const point = latLngToPoint(latlng)
  const nextEdges = activeCompositeEdges.value.map((current, currentIndex) => {
    const normalized = normalizeCompositeEdge(current)
    if (currentIndex !== edgeIndex) return normalized
    const points = [...normalized.points]
    points.splice(segmentIndex, 0, point)
    return { ...normalized, points }
  })
  updateCompositeConfig(getCompositeConfigWith(overviewCompositeItems.value, activeCompositeMarkers.value, nextEdges), { persistImmediately: true })
  showStatus('拐点已添加：可拖动移动，点击拐点删除')
}

function updateCompositeEdgeWaypoint(edgeIndex, pointIndex, latlng) {
  const nextEdges = activeCompositeEdges.value.map((current, currentIndex) => {
    const normalized = normalizeCompositeEdge(current)
    if (currentIndex !== edgeIndex) return normalized
    const points = normalized.points.map((point, index) =>
      index === pointIndex ? latLngToPoint(latlng) : point,
    )
    return { ...normalized, points }
  })
  updateCompositeConfig(getCompositeConfigWith(overviewCompositeItems.value, activeCompositeMarkers.value, nextEdges), { persistImmediately: true })
}

function removeCompositeEdgeWaypoint(edgeIndex, pointIndex) {
  const nextEdges = activeCompositeEdges.value.map((current, currentIndex) => {
    const normalized = normalizeCompositeEdge(current)
    if (currentIndex !== edgeIndex) return normalized
    return {
      ...normalized,
      points: normalized.points.filter((_, index) => index !== pointIndex),
    }
  })
  updateCompositeConfig(getCompositeConfigWith(overviewCompositeItems.value, activeCompositeMarkers.value, nextEdges), { persistImmediately: true })
  showStatus('拐点已删除')
}

function showStatus(message) {
  statusMessage.value = message
  window.setTimeout(() => {
    if (statusMessage.value === message) statusMessage.value = ''
  }, 2600)
}

function createNavigationIcon() {
  return L.divIcon({
    className: 'navigation-arrow-shell',
    html: '<div class="navigation-arrow"><img src="/images/map_webview_pointer.png" alt=""></div>',
    iconSize: [30, 35],
    iconAnchor: [15, 18],
  })
}

function updateNavigationMarkerAngle(angle) {
  if (!Number.isFinite(angle)) return
  if (navigationDisplayAngle === null) {
    navigationDisplayAngle = angle
  } else {
    const delta = ((angle - navigationDisplayAngle + 540) % 360) - 180
    navigationDisplayAngle += delta
  }
  navigationArrowImage ||= navigationMarker?.getElement()?.querySelector('.navigation-arrow img')
  if (navigationArrowImage) {
    navigationArrowImage.style.transform = `translateZ(0) rotate(${navigationDisplayAngle}deg)`
  }
}

function renderNavigationMarker() {
  if (!map) return
  if (!navigationPosition.value) {
    if (navigationMarker) map.removeLayer(navigationMarker)
    navigationMarker = null
    navigationArrowImage = null
    navigationDisplayAngle = null
    return
  }

  const latlng = mapper.value.locatorToLatLng(navigationPosition.value)
  if (!navigationMarker) {
    navigationMarker = L.marker(latlng, {
      icon: createNavigationIcon(),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000000,
    }).addTo(map)
    navigationArrowImage = null
  } else {
    navigationMarker.setLatLng(latlng)
  }
  const arrow = navigationMarker.getElement()?.querySelector('.navigation-arrow')
  arrow?.classList.toggle('navigation-arrow--angle-missing', correctedNavigationAngle.value === null)
  updateNavigationMarkerAngle(correctedNavigationAngle.value)
  if (followEnabled.value) map.panTo(latlng, { animate: true, duration: 0.25 })
}

function renderRoute() {
  if (!routeLayer) return
  routeLayer.clearLayers()
  if (isAddingSegment.value) {
    drawRouteSegment(segmentPoints.value, '#ffd27d', true)
    return
  }
  const colors = ['#ffd27d', '#b8fff2', '#e8a6ff', '#ff8a70', '#87a9ff']
  routes.value
    .filter((route) => !route.isHidden)
    .forEach((route, routeIndex) => {
      route.segments
        .filter((segment) => !segment.isHidden)
        .forEach((segment, segmentIndex) => {
          drawRouteSegment(getSegmentPoints(segment), colors[(routeIndex + segmentIndex) % colors.length], false)
        })
    })
}

function normalizeRoutePoint(point) {
  if (!point || typeof point !== 'object') return null
  const pixelX = Number(point.pixelX ?? point.x)
  const pixelY = Number(point.pixelY ?? point.y)
  if (!Number.isFinite(pixelX) || !Number.isFinite(pixelY)) return null
  return {
    layerId: String(point.layerId || activeLayer.value.id),
    pixelX: Number(pixelX.toFixed(3)),
    pixelY: Number(pixelY.toFixed(3)),
  }
}

function getSegmentPoints(segment) {
  return Array.isArray(segment?.points)
    ? segment.points.map(normalizeRoutePoint).filter(Boolean)
    : []
}

function normalizeRoutes(importedRoutes) {
  return Array.isArray(importedRoutes)
    ? importedRoutes
        .filter((route) => route && typeof route === 'object')
        .map((route, routeIndex) => ({
          id: String(route.id || `route-${Date.now()}-${routeIndex}`),
          name: String(route.name || `路线 ${routeIndex + 1}`),
          isHidden: route.isHidden === true,
          segments: Array.isArray(route.segments)
            ? route.segments
                .filter((segment) => segment && typeof segment === 'object')
                .map((segment, segmentIndex) => ({
                  id: String(segment.id || `segment-${Date.now()}-${routeIndex}-${segmentIndex}`),
                  name: String(segment.name || `路段 ${segmentIndex + 1}`),
                  isHidden: segment.isHidden === true,
                  points: getSegmentPoints(segment),
                }))
            : [],
        }))
    : []
}

function routesForExport() {
  return normalizeRoutes(routes.value).map((route) => ({
    ...route,
    segments: route.segments.map((segment) => ({
      ...segment,
      points: getSegmentPoints(segment).map((point) => ({
        layerId: point.layerId,
        x: point.pixelX,
        y: point.pixelY,
      })),
    })),
  }))
}

function isRoutePointOnActiveLayer(point) {
  return normalizeRoutePoint(point)?.layerId === activeLayer.value.id
}

function routePointToLatLng(point) {
  const normalized = normalizeRoutePoint(point)
  if (!normalized || normalized.layerId !== activeLayer.value.id) return null
  return mapper.value.locatorToLatLng({
    pixelX: normalized.pixelX,
    pixelY: normalized.pixelY,
    sourceWidth: activeLayer.value.locator.sourceWidth,
    sourceHeight: activeLayer.value.locator.sourceHeight,
  })
}

function drawRouteSegment(points, color, editable = false) {
  const visiblePoints = points
    .map((point, originalIndex) => ({ point: normalizeRoutePoint(point), originalIndex }))
    .filter(({ point }) => point && point.layerId === activeLayer.value.id)
  const latlngs = visiblePoints.map(({ point }) => routePointToLatLng(point)).filter(Boolean)
  if (latlngs.length > 1) {
    L.polyline(latlngs, {
      color,
      weight: editable ? 5 : 4,
      opacity: editable ? 1 : 0.88,
      dashArray: editable ? '10 6' : undefined,
    }).addTo(routeLayer)
  }
  visiblePoints.forEach(({ point, originalIndex }, visibleIndex) => {
    const latlng = routePointToLatLng(point)
    if (!latlng) return
    const marker = L.marker(latlng, {
      draggable: editable,
      icon: L.divIcon({
        className: editable ? 'route-point-handle' : 'route-point-shell',
        html: `<span style="--route-color:${color}">${visibleIndex + 1}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    }).addTo(routeLayer)
    if (editable) {
      marker.on('dragend', (event) => updateSegmentPoint(originalIndex, event.target.getLatLng()))
    }
  })
}

function renderCalibrationPoints() {
  if (!calibrationLayer) return
  calibrationLayer.clearLayers()
  calibrationPoints.value.forEach((point, index) => {
    L.marker(mapper.value.locatorToLatLng({
      pixelX: point.map[0],
      pixelY: point.map[1],
      sourceWidth: activeLayer.value.locator.sourceWidth,
      sourceHeight: activeLayer.value.locator.sourceHeight,
    }), {
      interactive: false,
      zIndexOffset: 1200,
      icon: L.divIcon({
        className: 'calibration-point-shell',
        html: `<span><i>${index + 1}</i></span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    }).addTo(calibrationLayer)
  })
}

function getPendingGeofence() {
  if (geofenceCorners.value.length < 3) return null
  return normalizeLayerGeofence({
    enabled: true,
    points: geofenceCorners.value,
    zMin: geofenceForm.value.zMin,
    zMax: geofenceForm.value.zMax,
  })
}

function renderGeofence() {
  if (!geofenceLayer) return
  geofenceLayer.clearLayers()
  if (!geofenceMode.value) return
  if (geofenceMode.value) {
    geofenceCorners.value.forEach((corner, index) => {
      L.circleMarker(mapper.value.planeToLatLng(corner), {
        color: '#fff',
        fillColor: '#ffe0a6',
        fillOpacity: 1,
        radius: 6,
        weight: 2,
        interactive: false,
      }).bindTooltip(`#${index + 1}`, {
        permanent: true,
        direction: 'top',
        className: 'geofence-corner-label',
      }).addTo(geofenceLayer)
    })
  }
  if (geofenceCorners.value.length < 2) return
  const latlngs = geofenceCorners.value.map((point) => mapper.value.planeToLatLng(point))
  const shapeOptions = {
    color: geofenceMode.value ? '#ffe0a6' : '#b8fff2',
    fillColor: geofenceMode.value ? '#ffe0a6' : '#8adfd6',
    fillOpacity: geofenceMode.value ? 0.1 : 0.07,
    opacity: 0.9,
    weight: 2,
    dashArray: geofenceMode.value ? '7 5' : undefined,
    interactive: false,
  }
  if (latlngs.length >= 3) L.polygon(latlngs, shapeOptions).addTo(geofenceLayer)
  else L.polyline(latlngs, shapeOptions).addTo(geofenceLayer)
}

function resetView() {
  map?.fitBounds(activeViewBounds(), { padding: [30, 30], animate: false })
  resetAnnotationScaleBase()
  renderCompositeAnnotations()
}

function clearRoute() {
  routes.value = []
  activeRouteId.value = null
  cancelSegment()
  persistRoutesLocally()
  renderRoute()
}

function undoRoutePoint() {
  segmentPoints.value = segmentPoints.value.slice(0, -1)
  renderRoute()
}

function addRoutePoint(latlng) {
  const point = mapper.value.latLngToLocator(latlng)
  segmentPoints.value = [...segmentPoints.value, {
    layerId: activeLayer.value.id,
    pixelX: Number(point.pixelX.toFixed(3)),
    pixelY: Number(point.pixelY.toFixed(3)),
  }]
  renderRoute()
}

function updateSegmentPoint(index, latlng) {
  const point = mapper.value.latLngToLocator(latlng)
  segmentPoints.value = segmentPoints.value.map((item, pointIndex) =>
    pointIndex === index
      ? {
          layerId: activeLayer.value.id,
          pixelX: Number(point.pixelX.toFixed(3)),
          pixelY: Number(point.pixelY.toFixed(3)),
        }
      : item,
  )
  renderRoute()
}

function createRoute() {
  const name = window.prompt('路线名称')
  if (!name?.trim()) return null
  const route = { id: `route-${Date.now()}`, name: name.trim(), segments: [] }
  routes.value = [...routes.value, route]
  activeRouteId.value = route.id
  persistRoutesLocally()
  renderRoute()
  return route
}

function deleteRoute(route) {
  if (!route || !window.confirm(`删除路线“${route.name}”？`)) return
  routes.value = routes.value.filter((item) => item.id !== route.id)
  activeRouteId.value = routes.value[0]?.id || null
  cancelSegment()
  persistRoutesLocally()
  renderRoute()
}

function startSegment() {
  if (!activeRoute.value || isCompositeLayer.value) return
  cancelCalibration()
  cancelGeofenceCalibration()
  compositeMarkerMode.value = false
  markerVisibilityPickMode.value = false
  routeEditMode.value = true
  isAddingSegment.value = true
  editingSegmentId.value = null
  segmentPoints.value = []
  renderRoute()
  showStatus('点击地图添加路段点')
}

function editSegment(segment) {
  if (!activeRoute.value || !segment || isCompositeLayer.value) return
  cancelCalibration()
  cancelGeofenceCalibration()
  compositeMarkerMode.value = false
  markerVisibilityPickMode.value = false
  routeEditMode.value = true
  isAddingSegment.value = true
  editingSegmentId.value = segment.id
  segmentPoints.value = getSegmentPoints(segment)
  renderRoute()
}

function cancelSegment() {
  isAddingSegment.value = false
  editingSegmentId.value = null
  segmentPoints.value = []
  routeEditMode.value = false
  renderRoute()
}

function finishSegment() {
  if (!activeRoute.value || segmentPoints.value.length < 2) return
  if (editingSegment.value) {
    editingSegment.value.points = [...segmentPoints.value]
  } else {
    const name = window.prompt('路段名称')
    if (!name?.trim()) return
    activeRoute.value.segments.push({
      id: `segment-${Date.now()}`,
      name: name.trim(),
      points: [...segmentPoints.value],
    })
  }
  cancelSegment()
  persistRoutesLocally()
  renderRoute()
}

function deleteSegment(segment) {
  if (!activeRoute.value || !segment || !window.confirm(`删除路段“${segment.name}”？`)) return
  activeRoute.value.segments = activeRoute.value.segments.filter((item) => item.id !== segment.id)
  if (editingSegmentId.value === segment.id) cancelSegment()
  persistRoutesLocally()
  renderRoute()
}

function toggleRouteVisibility(route) {
  if (!route) return
  if (activeRouteId.value !== route.id) {
    activeRouteId.value = route.id
    if (route.isHidden) route.isHidden = false
  } else {
    route.isHidden = !route.isHidden
  }
  persistRoutesLocally()
  renderRoute()
}

function toggleSegmentVisibility(segment) {
  if (!segment) return
  segment.isHidden = !segment.isHidden
  persistRoutesLocally()
  renderRoute()
}

function exportRoutes() {
  downloadJson({
    version: 1,
    routes: routesForExport(),
  }, `MaaNTE-PPH-routes-${new Date().toISOString().slice(0, 10)}.json`)
  showStatus('路线 JSON 已导出')
}

async function importRoutes(event) {
  const [file] = event.target.files || []
  event.target.value = ''
  if (!file) return
  try {
    const payload = JSON.parse(await file.text())
    const importedRoutes = Array.isArray(payload) ? payload : payload.routes
    const nextRoutes = normalizeRoutes(importedRoutes)
    if (!nextRoutes.length && !Array.isArray(importedRoutes)) throw new Error('invalid routes')
    routes.value = nextRoutes
    activeRouteId.value = routes.value[0]?.id || null
    cancelSegment()
    persistRoutesLocally()
    renderRoute()
    showStatus(`已导入 ${routes.value.length} 条路线`)
  } catch {
    showStatus('路线 JSON 格式无效')
  }
}

function startCalibration() {
  routeEditMode.value = false
  cancelGeofenceCalibration()
  calibrationMode.value = true
  calibrationPoints.value = []
  renderCalibrationPoints()
  showStatus('标定模式已开启：移动到目标位置，等待 WS 坐标后点击地图')
}

function cancelCalibration() {
  calibrationMode.value = false
  calibrationPoints.value = []
  renderCalibrationPoints()
}

async function resetCalibration() {
  const layerId = activeLayer.value.id
  const defaultMapping = {
    version: 1,
    calibrated: false,
    points: [
      { raw: [0, 0], map: [0, 0] },
      { raw: [1, 0], map: [1, 0] },
      { raw: [0, 1], map: [0, 1] },
    ],
  }
  const next = { ...calibrationOverrides.value }
  next[layerId] = defaultMapping
  calibrationOverrides.value = next
  persistCalibrationOverrides()
  cancelCalibration()
  if (navigationUsesGameCoordinates && latestGamePosition.value) {
    const locator = mapper.value.gameToLocator(latestGamePosition.value)
    navigationPosition.value = {
      ...locator,
      sourceWidth: activeLayer.value.locator.sourceWidth,
      sourceHeight: activeLayer.value.locator.sourceHeight,
    }
    renderNavigationMarker()
  }
  try {
    await persistLayerCalibration(layerId, defaultMapping)
    showStatus('已清除当前图层标定并写回 layers.js')
  } catch (error) {
    showStatus(`本地标定已清除，但写回失败：${error.message}`)
  }
}

async function addCalibrationPoint(latlng) {
  const planePosition = latestPlanePosition.value
  if (!planePosition) {
    showStatus('尚未收到可用于当前平面的 WebSocket 坐标')
    return
  }

  const raw = [
    Number(planePosition.x),
    Number(planePosition.y),
  ]
  if (calibrationPoints.value.some((point) =>
    Math.hypot(point.raw[0] - raw[0], point.raw[1] - raw[1]) < 0.001,
  )) {
    showStatus('该 WebSocket 坐标已经采集，请移动到另一个位置后再点击')
    return
  }

  const locator = mapper.value.latLngToLocator(latlng)
  const nextPoint = {
    raw,
    map: [
      Number(locator.pixelX.toFixed(3)),
      Number(locator.pixelY.toFixed(3)),
    ],
  }
  const nextPoints = [...calibrationPoints.value, nextPoint]
  calibrationPoints.value = nextPoints
  renderCalibrationPoints()

  if (nextPoints.length < 3) {
    showStatus(`已采集标定点 ${nextPoints.length}/3，请移动到下一个位置`)
    return
  }

  const mapping = {
    version: 1,
    calibrated: true,
    calibratedAt: new Date().toISOString(),
    points: nextPoints,
  }

  try {
    const layerId = activeLayer.value.id
    createLayerCoordinateMapper({
      ...activeLayer.value,
      coordinateMapping: mapping,
    })
    calibrationOverrides.value = {
      ...calibrationOverrides.value,
      [layerId]: mapping,
    }
    persistCalibrationOverrides()
    await persistLayerCalibration(layerId, mapping)
    calibrationMode.value = false
    calibrationPoints.value = []
    renderCalibrationPoints()
    if (latestGamePosition.value) {
      const calibratedLocator = mapper.value.gameToLocator(latestGamePosition.value)
      navigationUsesGameCoordinates = true
      navigationCoordinateSource.value = 'CALIBRATED PLANE'
      navigationPosition.value = {
        ...calibratedLocator,
        sourceWidth: activeLayer.value.locator.sourceWidth,
        sourceHeight: activeLayer.value.locator.sourceHeight,
      }
      renderNavigationMarker()
    }
    showStatus('三点标定完成，已应用并写回 layers.js')
  } catch (error) {
    if (!isLayerCalibrated.value) {
      calibrationPoints.value = nextPoints.slice(0, 2)
      renderCalibrationPoints()
      showStatus(`${error.message}，请重新采集第三点`)
    } else {
      calibrationMode.value = false
      calibrationPoints.value = []
      renderCalibrationPoints()
      showStatus(`标定已在浏览器生效，但写回失败：${error.message}`)
    }
  }
}

function startGeofenceCalibration() {
  routeEditMode.value = false
  cancelCalibration()
  geofenceMode.value = true
  geofenceCorners.value = activeGeofence.value
    ? activeGeofence.value.points.map((point) => ({ ...point }))
    : []
  geofenceForm.value = {
    zMin: activeGeofence.value?.zMin ?? latestGamePosition.value?.z ?? '',
    zMax: activeGeofence.value?.zMax ?? latestGamePosition.value?.z ?? '',
  }
  renderGeofence()
  showStatus(activeGeofence.value
    ? '围栏编辑已开启：可继续添加顶点、撤销顶点或调整高度轴'
    : '电子围栏标定已开启：按边界顺序点击至少三个顶点')
}

function cancelGeofenceCalibration() {
  geofenceMode.value = false
  geofenceCorners.value = []
  renderGeofence()
}

function addGeofenceCorner(latlng) {
  const game = mapper.value.locatorToGame(mapper.value.latLngToLocator(latlng))
  geofenceCorners.value = [
    ...geofenceCorners.value,
    {
    x: Number(game.x.toFixed(3)),
    y: Number(game.y.toFixed(3)),
    },
  ]
  renderGeofence()
  showStatus(geofenceCorners.value.length < 3
    ? `已采集 ${geofenceCorners.value.length}/3 个最低所需顶点`
    : `已采集 ${geofenceCorners.value.length} 个顶点，可继续添加或保存`)
}

function undoGeofenceCorner() {
  geofenceCorners.value = geofenceCorners.value.slice(0, -1)
  renderGeofence()
}

function clearGeofenceCorners() {
  geofenceCorners.value = []
  renderGeofence()
}

function useCurrentZ(target) {
  const planePosition = transformGamePositionToPlane(latestGamePosition.value, activeCoordinateTransform.value)
  if (!Number.isFinite(planePosition?.z)) {
    showStatus('当前 WebSocket 没有可用于本平面的有效高度坐标')
    return
  }
  geofenceForm.value[target] = Number(planePosition.z.toFixed(3))
  renderGeofence()
}

async function persistGeofenceToLayers(geofence) {
  const response = await fetch('/api/layer-geofence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      layerId: activeLayer.value.id,
      geofence,
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || '写入 layers.js 失败')
}

async function saveGeofence() {
  const fence = getPendingGeofence()
  if (!fence) {
    showStatus(geofenceCorners.value.length < 3
      ? '请按顺序点击至少三个多边形顶点'
      : '请填写有效的高度轴最小值和最大值')
    return
  }
  geofenceOverrides.value = {
    ...geofenceOverrides.value,
    [activeLayer.value.id]: fence,
  }
  persistGeofenceOverrides()
  let sourcePersisted = true
  try {
    await persistGeofenceToLayers(fence)
  } catch (error) {
    sourcePersisted = false
    showStatus(`围栏已在当前浏览器生效，但 ${error.message}`)
  }
  geofenceMode.value = false
  geofenceCorners.value = []
  renderGeofence()
  if (sourcePersisted) showStatus('围栏已写入 layers.js 并启用')
  if (latestGamePosition.value && !isGamePositionInsideGeofence(latestGamePosition.value, fence, activeCoordinateTransform.value)) {
    navigationPosition.value = null
    renderNavigationMarker()
  }
}

async function clearGeofence() {
  geofenceOverrides.value = {
    ...geofenceOverrides.value,
    [activeLayer.value.id]: { enabled: false },
  }
  persistGeofenceOverrides()
  let sourcePersisted = true
  try {
    await persistGeofenceToLayers({ enabled: false })
  } catch (error) {
    sourcePersisted = false
    showStatus(`围栏已在当前浏览器清除，但 ${error.message}`)
  }
  cancelGeofenceCalibration()
  renderGeofence()
  if (sourcePersisted) showStatus('已从 layers.js 清除当前图层电子围栏')
}

function handleMapClick(latlng) {
  if (compositeMarkerMode.value) {
    addCompositeMarker(latlng)
    return
  }
  if (isCompositeLayer.value) {
    return
  }
  if (calibrationMode.value) addCalibrationPoint(latlng)
  else if (geofenceMode.value) addGeofenceCorner(latlng)
  else if (isAddingSegment.value) addRoutePoint(latlng)
}

function sendMessage(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showStatus('导航服务尚未连接')
    return false
  }
  socket.send(JSON.stringify(payload))
  return true
}

function buildNavigationWaypoints(points) {
  const waypoints = points
    .map(normalizeRoutePoint)
    .filter((point) => point && point.layerId === activeLayer.value.id)
    .map((point) => ({ pixelX: point.pixelX, pixelY: point.pixelY }))
  return waypoints.filter((point, index) => {
    const previous = waypoints[index - 1]
    return !previous || previous.pixelX !== point.pixelX || previous.pixelY !== point.pixelY
  })
}

function sendNavigationWaypoints(points, label = '路线', start = true) {
  const waypoints = buildNavigationWaypoints(points)
  if (!waypoints.length) {
    showStatus(`${label}在当前区域没有可发送的路径点`)
    return false
  }
  if (sendMessage({
    type: 'navi-route-set',
    sourceWidth: activeLayer.value.locator.sourceWidth,
    sourceHeight: activeLayer.value.locator.sourceHeight,
    start,
    waypoints,
  })) {
    showStatus(`已发送 ${waypoints.length} 个路径点`)
    return true
  }
  return false
}

function sendRouteToNavigation(route = activeRoute.value, start = true) {
  if (!route) return false
  const points = route.segments
    .filter((segment) => !segment.isHidden)
    .flatMap((segment) => getSegmentPoints(segment))
  return sendNavigationWaypoints(points, route.name || '路线', start)
}

function sendSegmentToNavigation(segment, start = true) {
  if (!segment) return false
  return sendNavigationWaypoints(getSegmentPoints(segment), segment.name || '路段', start)
}

async function handleNavigationMessage(event) {
  try {
    const payload = JSON.parse(event.data)
    if (payload.type === 'navi-route-ack') {
      routeStatus.value = payload.route || null
      if (payload.message) showStatus(payload.message)
      return
    }
    if (payload.type === 'navi-error') {
      showStatus(payload.message || '导航服务返回错误')
      return
    }
    if (payload.type !== 'navi-state' || payload.version !== 1) return

    const position = payload.position && typeof payload.position === 'object' ? payload.position : payload
    const gamePosition = payload.gamePosition || position.gamePosition || {}
    const readNumber = (...values) => {
      for (const value of values) {
        const number = Number(value)
        if (value !== '' && value !== null && value !== undefined && Number.isFinite(number)) return number
      }
      return null
    }
    const gameX = readNumber(position.x, gamePosition.x, payload.x)
    const gameY = readNumber(position.y, gamePosition.y, payload.y)
    const gameZ = readNumber(position.z, gamePosition.z, payload.z)
    const incomingGamePosition = [gameX, gameY, gameZ].some((value) => value !== null)
      ? { x: gameX, y: gameY, z: gameZ }
      : null
    if (incomingGamePosition) latestGamePosition.value = incomingGamePosition

    let suppressNavigationForCurrentLayer = false
    const configuredGeofenceLayers = getConfiguredGeofenceLayers()
    if (!isCompositeLayer.value && configuredGeofenceLayers.length && incomingGamePosition) {
      const matchedLayer = findLayerForGamePosition(incomingGamePosition)
      const currentLayerHasGeofence = Boolean(getLayerGeofence(activeLayer.value))
      const matchedCurrentLayer = matchedLayer?.id === activeLayer.value.id
      suppressNavigationForCurrentLayer = manualLayerView.value
        && (Boolean(matchedLayer && !matchedCurrentLayer) || (!matchedLayer && currentLayerHasGeofence))

      if (!manualLayerView.value && !matchedLayer && currentLayerHasGeofence) {
        navigationPosition.value = null
        renderNavigationMarker()
        return
      }
      if (!manualLayerView.value && matchedLayer && matchedLayer.id !== activeLayer.value.id) {
        await changeLayer(matchedLayer.id, { preserveNavigation: true })
        suppressNavigationForCurrentLayer = false
      } else if (manualLayerView.value && matchedCurrentLayer) {
        manualLayerView.value = false
        suppressNavigationForCurrentLayer = false
      }
    }

    let pixelX = readNumber(position.pixelX, payload.pixelX)
    let pixelY = readNumber(position.pixelY, payload.pixelY)
    const sourceWidth = readNumber(position.sourceWidth, payload.sourceWidth) || activeLayer.value.locator.sourceWidth
    const sourceHeight = readNumber(position.sourceHeight, payload.sourceHeight) || activeLayer.value.locator.sourceHeight

    const compositeNavigation = isCompositeLayer.value && incomingGamePosition
      ? resolveCompositeNavigationPosition(incomingGamePosition)
      : null
    const resolvedPosition = suppressNavigationForCurrentLayer
      ? {
          position: null,
          source: 'MANUAL LAYER VIEW',
          usesGameCoordinates: false,
          angleLayer: activeLayer.value,
        }
      : isCompositeLayer.value
      ? {
          position: compositeNavigation?.position || null,
          source: compositeNavigation?.layer ? `COMPOSITE CHILD / ${compositeNavigation.layer.name}` : 'COMPOSITE CHILD',
          usesGameCoordinates: true,
          angleLayer: compositeNavigation?.layer || null,
        }
      : {
          ...resolveLayerNavigationPosition({
            layer: activeLayer.value,
            mapper: mapper.value,
            calibrated: isLayerCalibrated.value,
            gameX,
            gameY,
            gameZ,
            pixelX,
            pixelY,
            sourceWidth,
            sourceHeight,
          }),
          angleLayer: activeLayer.value,
        }
    navigationUsesGameCoordinates = resolvedPosition.usesGameCoordinates
    navigationPosition.value = resolvedPosition.position
    navigationAngleLayerId.value = isCompositeLayer.value
      ? resolvedPosition.angleLayer?.id || null
      : null
    navigationCoordinateSource.value = resolvedPosition.source
    navigationAngle.value = Number.isFinite(Number(payload.angle)) ? Number(payload.angle) : null
    navigationAngleConfidence.value = Number.isFinite(Number(payload.angleConfidence))
      ? Number(payload.angleConfidence)
      : 0
    navigationTimestamp.value = readNumber(payload.timestamp)
    routeStatus.value = payload.route ?? routeStatus.value
    renderNavigationMarker()
  } catch {
    // Ignore malformed or unknown messages and keep the socket alive.
  }
}

function scheduleReconnect() {
  if (stopped || !realtimeEnabled.value || reconnectTimer) return
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connectSocket()
  }, 2000)
}

function disconnectSocket() {
  if (reconnectTimer) window.clearTimeout(reconnectTimer)
  reconnectTimer = null
  const current = socket
  socket = null
  current?.removeEventListener('message', handleNavigationMessage)
  current?.close()
  connection.value = 'disconnected'
  navigationPosition.value = null
  latestGamePosition.value = null
  navigationUsesGameCoordinates = false
  navigationAngleLayerId.value = null
  navigationCoordinateSource.value = 'none'
  navigationTimestamp.value = null
  navigationDisplayAngle = null
  navigationArrowImage = null
  renderNavigationMarker()
}

function connectSocket() {
  if (stopped || !realtimeEnabled.value || socket) return
  connection.value = 'connecting'
  const current = new WebSocket(navigationUrl.value)
  socket = current
  current.addEventListener('open', () => {
    if (socket === current) connection.value = 'connected'
  })
  current.addEventListener('message', handleNavigationMessage)
  current.addEventListener('close', () => {
    if (socket !== current) return
    socket = null
    connection.value = 'disconnected'
    scheduleReconnect()
  })
  current.addEventListener('error', () => current.close())
}

function applyEndpoint() {
  navigationPort.value = normalizeNavigationPort(navigationPort.value)
  localStorage.setItem('pph-websocket-url', navigationUrl.value)
  if (realtimeEnabled.value) {
    disconnectSocket()
    connectSocket()
  }
}

async function changeLayer(id, { preserveNavigation = false, manual = false } = {}) {
  if (id === activeLayerId.value) return
  if (manual) {
    manualLayerView.value = id !== OVERVIEW_LAYER_ID
    if (id !== OVERVIEW_LAYER_ID) areaLayerListOpen.value = true
  }
  activeLayerId.value = id
  navigationAngleLayerId.value = null
  localStorage.setItem('pph-active-layer', id)
  await nextTick()
  renderMapImages()
  map.setMaxBounds(activeViewBounds().pad(0.45))
  routeEditMode.value = false
  compositeMarkerMode.value = false
  compositeItemDragMode.value = false
  compositeConnectionMode.value = false
  markerVisibilityPickMode.value = false
  pendingConnectionMarkerId.value = ''
  cancelSegment()
  renderRoute()
  cancelCalibration()
  cancelGeofenceCalibration()
  renderGeofence()
  if (!preserveNavigation) {
    navigationPosition.value = null
    latestGamePosition.value = null
    navigationUsesGameCoordinates = false
    navigationAngleLayerId.value = null
    navigationCoordinateSource.value = 'none'
    renderNavigationMarker()
  }
  resetView()
}

watch(realtimeEnabled, (enabled) => {
  localStorage.setItem('pph-realtime-enabled', String(enabled))
  if (enabled) connectSocket()
  else disconnectSocket()
})
watch(followEnabled, (enabled) => localStorage.setItem('pph-follow-enabled', String(enabled)))
watch(areaLayerListOpen, (open) => localStorage.setItem('pph-area-layer-list-open', String(open)))
watch(compositeConnectionDirection, (direction) => localStorage.setItem('pph-composite-connection-direction', direction))
watch(hiddenCompositeMarkerTypes, (visibility) => {
  persistCompositeMarkerVisibility(HIDDEN_COMPOSITE_MARKER_TYPES_STORAGE_KEY, visibility)
  renderCompositeAnnotations()
}, { deep: true })
watch(hiddenCompositeMarkerIds, (visibility) => {
  persistCompositeMarkerVisibility(HIDDEN_COMPOSITE_MARKER_IDS_STORAGE_KEY, visibility)
  renderCompositeAnnotations()
}, { deep: true })
watch(shownCompositeMarkerIds, (visibility) => {
  persistCompositeMarkerVisibility(SHOWN_COMPOSITE_MARKER_IDS_STORAGE_KEY, visibility)
  renderCompositeAnnotations()
}, { deep: true })
watch(activeLayerId, () => syncTransformFormFromLayer(), { immediate: true })
watch(transformForm, () => scheduleTransformPersist(), { deep: true })
watch([compositeMarkerMode, compositeItemDragMode], () => {
  if (isCompositeLayer.value) renderMapImages()
})

onMounted(() => {
  map = L.map(mapElement.value, {
    crs: L.CRS.Simple,
    minZoom: -8,
    maxZoom: 2,
    zoomControl: false,
    attributionControl: false,
    maxBoundsViscosity: 0.8,
  })
  map.createPane('compositeImagePane')
  map.getPane('compositeImagePane').style.zIndex = 350
  renderMapImages()
  routeLayer = L.layerGroup().addTo(map)
  calibrationLayer = L.layerGroup().addTo(map)
  geofenceLayer = L.layerGroup().addTo(map)
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  map.setMaxBounds(activeViewBounds().pad(0.45))
  map.on('mousemove', ({ latlng }) => {
    const locator = mapper.value.latLngToLocator(latlng)
    const game = mapper.value.locatorToGame(locator)
    pointer.value = { ...locator, ...game }
  })
  map.on('click', ({ latlng }) => handleMapClick(latlng))
  map.on('zoom', () => updateAnnotationScaleCss())
  map.on('zoomend moveend', () => {
    updateAnnotationScaleCss()
    scheduleCompositeAnnotationsRender()
  })
  renderGeofence()
  resetView()
  if (realtimeEnabled.value) connectSocket()
})

onUnmounted(() => {
  stopped = true
  if (transformPersistTimer) window.clearTimeout(transformPersistTimer)
  if (compositePersistTimer) window.clearTimeout(compositePersistTimer)
  if (compositeAnnotationFrame !== null) window.cancelAnimationFrame(compositeAnnotationFrame)
  mapImageRenderToken += 1
  disconnectSocket()
  map?.remove()
})
</script>

<template>
  <main
    class="app-shell"
    :class="{
      'app-shell--calibrating': calibrationMode,
      'app-shell--route-editing': routeEditMode,
      'app-shell--composite-marking': compositeMarkerMode,
      'app-shell--marker-visibility-picking': markerVisibilityPickMode,
    }"
  >
    <div ref="mapElement" class="map-canvas" />

    <header class="topbar glass-panel">
      <div class="brand-block topbar-brand">
        <div class="brand-mark"><img :src="LOGO_URL" alt="PPH" /></div>
        <div>
          <p class="eyebrow">MaaNTE Map</p>
          <h1>粉爪大劫案在线地图</h1>
        </div>
      </div>
      <div class="topbar-layer">
        <p class="eyebrow">CURRENT LAYER</p>
        <strong>{{ activeLayer.name }}</strong>
        <small>{{ activeLayer.subtitle }}</small>
      </div>
      <div class="toolbar topbar-tools">
        <button
          type="button"
          :class="{ 'toolbar-button--active': routePanelOpen }"
          @click="routePanelOpen = !routePanelOpen"
        >
          路线
        </button>
        <button type="button" @click="resetView">重置视野</button>
      </div>
    </header>

    <button
      type="button"
      class="sidebar-toggle glass-panel"
      :class="{ 'sidebar-toggle--open': sidebarOpen }"
      @click="sidebarOpen = !sidebarOpen"
    >
      {{ sidebarOpen ? '‹' : '›' }}
    </button>

    <aside class="sidebar glass-panel" :class="{ 'sidebar--collapsed': !sidebarOpen }">
      <section>
        <p class="eyebrow">MAP LAYERS</p>
        <h2>楼层 / 区域</h2>
        <div class="layer-list">
          <button
            v-for="layer in overviewDisplayLayers"
            :key="layer.id"
            type="button"
            :class="{ active: layer.id === activeLayer.id }"
            @click="changeLayer(layer.id, { manual: true })"
          >
            <span>{{ layer.name }}</span>
            <small>{{ layer.subtitle }}</small>
            <i>{{ layer.id === activeLayer.id ? '显示中' : '切换' }}</i>
          </button>
          <div class="layer-group" :class="{ 'layer-group--collapsed': !areaLayerListOpen }">
            <button class="layer-group-toggle" type="button" @click="toggleAreaLayerList">
              <span>
                <b>区域地图</b>
                <small>{{ areaLayerListOpen ? `${areaDisplayLayers.length} 个区域` : activeLayer.id === OVERVIEW_LAYER_ID ? '默认折叠' : activeLayer.name }}</small>
              </span>
              <i>{{ areaLayerListOpen ? '收起' : '展开' }}</i>
            </button>
            <div v-show="areaLayerListOpen" class="layer-group-items">
              <button
                v-for="layer in areaDisplayLayers"
                :key="layer.id"
                type="button"
                :class="{ active: layer.id === activeLayer.id }"
                @click="changeLayer(layer.id, { manual: true })"
              >
                <span>{{ layer.name }}</span>
                <small>{{ layer.subtitle }}</small>
                <i>{{ layer.id === activeLayer.id ? '显示中' : '切换' }}</i>
              </button>
            </div>
          </div>
        </div>

        <div v-if="scopedCompositeMarkers.length" class="marker-display-panel">
          <div class="marker-display-heading">
            <span>
              <b>标点显示</b>
              <small>{{ hiddenCompositeMarkerCount ? `已隐藏 ${hiddenCompositeMarkerCount} 个` : '全部显示中' }}</small>
            </span>
            <i>{{ visibleCompositeMarkers.length }}/{{ scopedCompositeMarkers.length }}</i>
          </div>
          <div class="marker-display-actions">
            <button type="button" :disabled="hiddenCompositeMarkerCount === 0" @click="showAllCompositeMarkers">全部显示</button>
            <button type="button" :disabled="hiddenCompositeMarkerCount === scopedCompositeMarkers.length" @click="hideAllCompositeMarkers">全部隐藏</button>
            <button type="button" :class="{ active: markerVisibilityPickMode }" @click="toggleMarkerVisibilityPickMode">
              {{ markerVisibilityPickMode ? '结束点选' : '点选标点' }}
            </button>
          </div>
          <div class="marker-display-types" aria-label="按分类控制标点显示">
            <button
              v-for="type in MARKER_TYPES"
              :key="`display-${type.id}`"
              type="button"
              :class="{ 'marker-display-type--muted': isCompositeMarkerTypeHidden(type.id) }"
              :style="{ '--marker-color': type.color }"
              @click="toggleCompositeMarkerTypeVisibility(type.id)"
            >
              <span>{{ getCompositeMarkerBadge(type) }}</span>
              <b>{{ type.label }}</b>
              <small>{{ isCompositeMarkerTypeHidden(type.id) ? '隐藏' : '显示' }}</small>
            </button>
          </div>
        </div>

        <div v-if="isDevelopment && !isCompositeLayer" class="calibration-panel" :class="{ 'calibration-panel--complete': isLayerCalibrated }">
          <div class="calibration-panel__heading">
            <span>
              <b>{{ isLayerCalibrated ? '坐标映射已标定' : '坐标映射待标定' }}</b>
              <small>{{ calibrationMode ? `正在采集 ${calibrationPoints.length}/3` : '每个图层独立保存' }}</small>
            </span>
            <i>{{ isLayerCalibrated ? 'READY' : 'DEBUG' }}</i>
          </div>
          <p v-if="calibrationMode">
            当前平面 {{ activePlaneAxes[0] }}/{{ activePlaneAxes[1] }}：
            <code v-if="latestPlanePosition">
              {{ latestPlanePosition.x.toFixed(3) }}, {{ latestPlanePosition.y.toFixed(3) }}
            </code>
            <em v-else>等待当前平面坐标</em>
          </p>
          <p v-else>
            {{ isLayerCalibrated ? '游戏坐标会先投影到当前平面，再使用本图层三点映射。' : '开启后，将 WS 当前平面坐标与地图点击位置配对。' }}
          </p>
          <ol v-if="calibrationMode && calibrationPoints.length" class="calibration-points">
            <li v-for="(point, index) in calibrationPoints" :key="`${point.raw[0]}-${point.raw[1]}`">
              <b>#{{ index + 1 }}</b>
              <span>{{ activePlaneAxes[0] }}{{ activePlaneAxes[1] }} {{ point.raw[0].toFixed(1) }}, {{ point.raw[1].toFixed(1) }}</span>
              <span>PX {{ point.map[0].toFixed(1) }}, {{ point.map[1].toFixed(1) }}</span>
            </li>
          </ol>
          <div class="calibration-actions">
            <button v-if="!calibrationMode" type="button" @click="startCalibration">
              {{ isLayerCalibrated ? '重新标定' : '开始标定' }}
            </button>
            <button v-else type="button" @click="cancelCalibration">取消</button>
            <button v-if="isLayerCalibrated && !calibrationMode" type="button" @click="resetCalibration">清除标定</button>
          </div>
        </div>

        <div v-if="isDevelopment && !isCompositeLayer" class="transform-panel">
          <div class="calibration-panel__heading">
            <span>
              <b>3D Coordinate Plane</b>
              <small>write-through to layers.js</small>
            </span>
            <i>{{ transformForm.plane.toUpperCase() }}</i>
          </div>

          <div class="transform-plane-picker" aria-label="coordinate plane">
            <button
              v-for="plane in ['xoy', 'yoz', 'xoz']"
              :key="plane"
              type="button"
              :class="{ active: transformForm.plane === plane }"
              @click="transformForm.plane = plane"
            >
              {{ plane.toUpperCase() }}
            </button>
          </div>

          <div class="transform-visual">
            <span :class="{ active: transformForm.plane.includes('x') }">X</span>
            <span :class="{ active: transformForm.plane.includes('y') }">Y</span>
            <span :class="{ active: transformForm.plane.includes('z') }">Z</span>
          </div>

          <div class="transform-grid">
            <label>
              <span>Rotate X</span>
              <input v-model.number="transformForm.rotationX" type="number" step="1" />
            </label>
            <label>
              <span>Rotate Y</span>
              <input v-model.number="transformForm.rotationY" type="number" step="1" />
            </label>
            <label>
              <span>Rotate Z</span>
              <input v-model.number="transformForm.rotationZ" type="number" step="1" />
            </label>
          </div>

          <div class="transform-toggle-grid">
            <label><input v-model="transformForm.mirrorXoy" type="checkbox" /> Mirror XOY</label>
            <label><input v-model="transformForm.mirrorYoz" type="checkbox" /> Mirror YOZ</label>
            <label><input v-model="transformForm.mirrorXoz" type="checkbox" /> Mirror XOZ</label>
            <label><input v-model="transformForm.flipX" type="checkbox" /> Flip X</label>
            <label><input v-model="transformForm.flipY" type="checkbox" /> Flip Y</label>
            <label><input v-model="transformForm.flipZ" type="checkbox" /> Flip Z</label>
          </div>

          <div class="transform-grid">
            <label>
              <span>Offset X</span>
              <input v-model.number="transformForm.offsetX" type="number" step="any" />
            </label>
            <label>
              <span>Offset Y</span>
              <input v-model.number="transformForm.offsetY" type="number" step="any" />
            </label>
            <label>
              <span>Offset Z</span>
              <input v-model.number="transformForm.offsetZ" type="number" step="any" />
            </label>
          </div>
        </div>

        <div v-if="isDevelopment" class="composite-panel">
          <div class="calibration-panel__heading">
            <span>
              <b>地图标点</b>
              <small>{{ isCompositeLayer ? '全图同步标点与传送门连接' : '当前区域独立标点' }}</small>
            </span>
            <i>{{ visibleCompositeMarkers.length }}/{{ scopedCompositeMarkers.length }} 点</i>
          </div>

          <div class="composite-marker-tools">
            <div class="composite-marker-type-picker" aria-label="标记类型">
              <button
                v-for="type in MARKER_TYPES"
                :key="type.id"
                type="button"
                :class="{ active: compositeMarkerType === type.id }"
                :style="{ '--marker-color': type.color }"
                @click="compositeMarkerType = type.id"
              >
                <span>{{ getCompositeMarkerBadge(type) }}</span>
                {{ type.label }}
              </button>
            </div>

            <div class="composite-marker-actions">
              <button
                v-if="isCompositeLayer"
                type="button"
                :class="{ active: compositeItemDragMode }"
                @click="toggleCompositeItemDragMode"
              >
                {{ compositeItemDragMode ? '停止拖动子图' : '拖动子图' }}
              </button>
              <button v-if="!compositeMarkerMode" type="button" @click="startCompositeMarkerMode">
                添加{{ getCompositeMarkerType({ type: compositeMarkerType }).label }}
              </button>
              <button v-else type="button" @click="compositeMarkerMode = false">取消添加</button>
              <button
                v-if="isCompositeLayer"
                type="button"
                :disabled="compositePortalMarkers.length < 2"
                :class="{ active: compositeConnectionMode }"
                @click="toggleCompositeConnectionMode"
              >
                {{ compositeConnectionMode ? '停止编辑' : '连接/编辑' }}
              </button>
              <i>{{ isCompositeLayer ? `${activeCompositeEdges.length} 连接` : activeLayer.name }}</i>
            </div>

            <div v-if="isCompositeLayer" class="composite-connection-direction" aria-label="连接方向">
              <button
                type="button"
                :class="{ active: compositeConnectionDirection === 'one-way' }"
                @click="compositeConnectionDirection = 'one-way'"
              >
                单向
              </button>
              <button
                type="button"
                :class="{ active: compositeConnectionDirection === 'two-way' }"
                @click="compositeConnectionDirection = 'two-way'"
              >
                双向
              </button>
            </div>

            <div v-if="scopedCompositeMarkers.length" class="composite-marker-list">
              <div
                v-for="marker in scopedCompositeMarkers"
                :key="marker.id"
                class="composite-marker-row"
                :class="{ 'composite-marker-row--hidden': isCompositeMarkerHidden(marker) }"
              >
                <div class="composite-marker-row__main">
                  <b :style="{ '--marker-color': getCompositeMarkerType(marker).color }">
                    {{ getCompositeMarkerBadge(getCompositeMarkerType(marker)) }}
                  </b>
                  <input
                    :value="getCompositeMarkerLabelDraft(marker)"
                    type="text"
                    @mousedown.stop
                    @click.stop
                    @input="setCompositeMarkerLabelDraft(marker.id, $event.target.value)"
                    @blur="commitCompositeMarkerLabel(marker.id)"
                    @keydown.enter.prevent="$event.target.blur()"
                  />
                  <button
                    type="button"
                    @click="toggleCompositeMarkerVisibility(marker)"
                  >
                    {{ isCompositeMarkerHidden(marker) ? '显示' : '隐藏' }}
                  </button>
                  <button type="button" @click="removeCompositeMarker(marker.id)">删除</button>
                </div>
                <div class="composite-marker-row__meta">
                  <select
                    :value="getCompositeMarkerType(marker).id"
                    @mousedown.stop
                    @click.stop
                    @change="updateCompositeMarkerType(marker.id, $event.target.value)"
                  >
                    <option
                      v-for="type in MARKER_TYPES"
                      :key="`${marker.id}-${type.id}`"
                      :value="type.id"
                    >
                      {{ type.label }}
                    </option>
                  </select>
                  <span>{{ getLayerById(marker.layerId)?.name || marker.layerId }}</span>
                </div>
              </div>
            </div>

            <p v-else class="composite-help">还没有标点。</p>

            <div v-if="isCompositeLayer && compositeConnectionMode" class="composite-link-hint">
              {{ pendingConnectionMarkerId
                ? `已选择 ${activeCompositeMarkers.find((marker) => marker.id === pendingConnectionMarkerId)?.label || '起点'}，再点一个传送门作为终点`
                : `点击两个传送门创建${compositeConnectionDirection === 'two-way' ? '双向' : '单向'}连接；点击线段添加拐点，点击拐点删除`
              }}
            </div>

            <div v-if="isCompositeLayer && activeCompositeEdges.length" class="composite-edge-list">
              <div
                v-for="(edge, index) in activeCompositeEdges"
                :key="`${edge.from}-${edge.to}-${index}`"
                class="composite-edge-row"
              >
                <span>
                  #{{ activeCompositeMarkers.find((marker) => marker.id === edge.from)?.label || edge.from }}
                  {{ edge.bidirectional ? '↔' : '→' }}
                  #{{ activeCompositeMarkers.find((marker) => marker.id === edge.to)?.label || edge.to }}
                  <small v-if="edge.points?.length"> · {{ edge.points.length }} 拐点</small>
                </span>
                <small>点线添加 / 拖点移动 / 点点删除</small>
                <button type="button" @click="removeCompositeEdge(index)">删除</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="isDevelopment && !isCompositeLayer" class="geofence-panel" :class="{ 'geofence-panel--complete': isGeofenceConfigured }">
          <div class="calibration-panel__heading">
            <span>
              <b>电子围栏</b>
              <small>{{ geofenceMode ? `多边形顶点 ${geofenceCorners.length}` : '平面多边形 + 高度轴阈值' }}</small>
            </span>
            <i>{{ geofenceMode ? 'DEBUG' : activeGeofenceStatus }}</i>
          </div>

          <template v-if="geofenceMode">
            <p>沿边界顺序点击地图，至少三个顶点；最后一条边会自动闭合。</p>
            <div v-if="geofenceCorners.length" class="geofence-corners">
              <span v-for="(corner, index) in geofenceCorners" :key="`${corner.x}-${corner.y}`">
                #{{ index + 1 }} XY {{ corner.x.toFixed(1) }}, {{ corner.y.toFixed(1) }}
              </span>
            </div>
            <div class="calibration-actions">
              <button type="button" :disabled="!geofenceCorners.length" @click="undoGeofenceCorner">撤销顶点</button>
              <button type="button" :disabled="!geofenceCorners.length" @click="clearGeofenceCorners">清空顶点</button>
            </div>
            <div class="geofence-z-fields">
              <label>
                <span>高度最小值</span>
                <input v-model="geofenceForm.zMin" type="number" step="any" @input="renderGeofence" />
                <button type="button" @click="useCurrentZ('zMin')">使用当前高度</button>
              </label>
              <label>
                <span>高度最大值</span>
                <input v-model="geofenceForm.zMax" type="number" step="any" @input="renderGeofence" />
                <button type="button" @click="useCurrentZ('zMax')">使用当前高度</button>
              </label>
            </div>
            <div class="calibration-actions">
              <button type="button" @click="cancelGeofenceCalibration">取消</button>
              <button type="button" @click="saveGeofence">保存围栏</button>
            </div>
          </template>

          <template v-else>
            <p v-if="activeGeofence">
              平面多边形：{{ activeGeofence.points.length }} 个顶点<br />
              高度轴 {{ activeGeofence.zMin.toFixed(1) }} ～ {{ activeGeofence.zMax.toFixed(1) }}
            </p>
            <p v-else>未配置时不限制图层；配置后严格检查平面多边形和高度轴。</p>
            <div class="calibration-actions">
              <button type="button" @click="startGeofenceCalibration">
                {{ isGeofenceConfigured ? '编辑围栏' : '标定范围框' }}
              </button>
              <button v-if="isGeofenceConfigured" type="button" @click="clearGeofence">清除围栏</button>
            </div>
          </template>
        </div>
      </section>

      <section class="navigation-settings">
        <div class="section-heading">
          <div>
            <p class="eyebrow">NAVIGATION</p>
            <h2>实时定位</h2>
          </div>
          <label class="switch">
            <input v-model="realtimeEnabled" type="checkbox" />
            <i />
          </label>
        </div>
        <label class="setting-row">
          <span><b>箭头保持居中</b><small>接收位置后自动跟随</small></span>
          <span class="switch setting-row-switch">
            <input v-model="followEnabled" type="checkbox" />
            <i />
          </span>
        </label>
        <div class="endpoint-fields">
          <label><span>协议</span><select v-model="navigationProtocol" @change="applyEndpoint"><option>ws</option><option>wss</option></select></label>
          <label><span>IP</span><input v-model.trim="navigationHost" @change="applyEndpoint" /></label>
          <label><span>端口</span><input v-model.trim="navigationPort" type="number" min="1" max="65535" @change="applyEndpoint" /></label>
        </div>
        <code>{{ navigationUrl }}</code>
      </section>
    </aside>

    <div v-if="routePanelOpen" class="right-panel-stack">
      <aside class="route-panel glass-panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">ROUTES</p>
            <h2>路线规划</h2>
          </div>
          <button type="button" class="text-button" @click="createRoute">+ 新建</button>
        </div>
        <div class="route-file-actions">
          <button type="button" @click="routeImportInput?.click()">导入 JSON</button>
          <button type="button" :disabled="!routes.length" @click="exportRoutes">导出 JSON</button>
          <input ref="routeImportInput" type="file" accept="application/json,.json" @change="importRoutes" />
        </div>
        <div class="route-list">
          <button
            v-for="route in routes"
            :key="route.id"
            type="button"
            :class="{ active: activeRouteId === route.id, hidden: route.isHidden }"
            @click="toggleRouteVisibility(route)"
          >
            <span>{{ route.name }}</span>
            <small>{{ route.isHidden ? '已隐藏' : `${route.segments.length} 个路段` }}</small>
          </button>
        </div>

        <template v-if="activeRoute">
          <div class="route-heading">
            <b>{{ activeRoute.name }}</b>
            <button type="button" @click="deleteRoute(activeRoute)">删除路线</button>
          </div>
          <div class="route-file-actions">
            <button type="button" :disabled="!canSendRoute" @click="sendRouteToNavigation(activeRoute)">发送整条路线</button>
            <button type="button" :disabled="connection !== 'connected'" @click="sendMessage({ type: 'navi-route-start' })">开始</button>
            <button type="button" :disabled="connection !== 'connected'" @click="sendMessage({ type: 'navi-route-stop' })">暂停</button>
            <button type="button" :disabled="connection !== 'connected'" @click="sendMessage({ type: 'navi-route-clear' })">清空服务端</button>
          </div>
          <small v-if="routeStatus" class="route-server-status">
            服务端：{{ routeStatus.status || 'unknown' }} {{ routeStatus.currentIndex || 0 }}/{{ routeStatus.waypoints?.length || 0 }}
          </small>
          <div v-if="isAddingSegment" class="segment-editor">
            <span>{{ editingSegment ? `正在编辑：${editingSegment.name}` : '新路段' }}：{{ segmentPoints.length }} 个点</span>
            <button type="button" @click="undoRoutePoint">撤销</button>
            <button type="button" @click="cancelSegment">取消</button>
            <button type="button" :disabled="segmentPoints.length < 2" @click="finishSegment">{{ editingSegment ? '保存' : '完成' }}</button>
          </div>
          <button v-else class="add-segment-button" type="button" :disabled="isCompositeLayer" @click="startSegment">+ 添加路段</button>
          <div class="segment-list">
            <button
              v-for="segment in activeRoute.segments"
              :key="segment.id"
              type="button"
              :class="{ hidden: segment.isHidden }"
              @click="toggleSegmentVisibility(segment)"
            >
              <span>{{ segment.name }}</span>
              <small>{{ segment.isHidden ? '已隐藏' : `${getSegmentPoints(segment).length} 个点` }}</small>
              <i @click.stop="sendSegmentToNavigation(segment)">发送</i>
              <i @click.stop="editSegment(segment)">编辑</i>
              <i @click.stop="deleteSegment(segment)">×</i>
            </button>
          </div>
        </template>
      </aside>
    </div>

    <div class="map-hud glass-panel">
      <span class="game-coordinate">
        当前位置 XYZ
        {{ hudGamePosition.x.toFixed(0) }},
        {{ hudGamePosition.y.toFixed(0) }},
        {{ Number.isFinite(hudGamePosition.z) ? hudGamePosition.z.toFixed(0) : '--' }}
      </span>
      <span>
        鼠标指向 XY
        {{ pointer.x.toFixed(0) }},
        {{ pointer.y.toFixed(0) }}
      </span>
    </div>

    <div v-if="statusMessage" class="toast glass-panel">{{ statusMessage }}</div>
  </main>
</template>
