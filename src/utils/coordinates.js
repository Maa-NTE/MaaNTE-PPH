function solveAxis(points, index) {
  const [a, b, c] = points
  const [x1, y1] = a.raw
  const [x2, y2] = b.raw
  const [x3, y3] = c.raw
  const determinant = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)

  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new Error('图层坐标标定点不能共线')
  }

  const v1 = a.map[index]
  const v2 = b.map[index]
  const v3 = c.map[index]
  return {
    x: (v1 * (y2 - y3) + v2 * (y3 - y1) + v3 * (y1 - y2)) / determinant,
    y: (v1 * (x3 - x2) + v2 * (x1 - x3) + v3 * (x2 - x1)) / determinant,
    offset: (
      v1 * (x2 * y3 - x3 * y2)
      + v2 * (x3 * y1 - x1 * y3)
      + v3 * (x1 * y2 - x2 * y1)
    ) / determinant,
  }
}

export function applyLayerAngleOffset(angle, offset = 0) {
  const rawAngle = Number(angle)
  if (!Number.isFinite(rawAngle)) return null
  return ((rawAngle + (Number(offset) || 0)) % 360 + 360) % 360
}

function normalizeAngleDegrees(value) {
  const degrees = Number(value)
  return Number.isFinite(degrees) ? degrees : 0
}

const AXES = ['x', 'y', 'z']
const COORDINATE_PLANES = {
  xoy: { axes: ['x', 'y'], heightAxis: 'z' },
  xy: { axes: ['x', 'y'], heightAxis: 'z' },
  yoz: { axes: ['y', 'z'], heightAxis: 'x' },
  yz: { axes: ['y', 'z'], heightAxis: 'x' },
  xoz: { axes: ['x', 'z'], heightAxis: 'y' },
  xz: { axes: ['x', 'z'], heightAxis: 'y' },
}

function isAxis(value) {
  return AXES.includes(value)
}

function getAxisValue(vector, axis) {
  const value = Number(vector?.[axis])
  return Number.isFinite(value) ? value : null
}

function rotateVectorAroundAxis(vector, axis, degrees) {
  const angle = normalizeAngleDegrees(degrees)
  if (angle === 0) return vector
  const radians = angle * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  if (axis === 'x') {
    return {
      x: vector.x,
      y: vector.y * cosine - vector.z * sine,
      z: vector.y * sine + vector.z * cosine,
    }
  }
  if (axis === 'y') {
    return {
      x: vector.x * cosine + vector.z * sine,
      y: vector.y,
      z: -vector.x * sine + vector.z * cosine,
    }
  }
  return {
    x: vector.x * cosine - vector.y * sine,
    y: vector.x * sine + vector.y * cosine,
    z: vector.z,
  }
}

function normalizeMirrorPlanes(value) {
  if (typeof value === 'string') return [value.toLowerCase()]
  if (!Array.isArray(value)) return []
  return value.map((plane) => String(plane).toLowerCase())
}

function getMirrorAxisMultipliers(transform) {
  const multipliers = { x: 1, y: 1, z: 1 }
  for (const plane of normalizeMirrorPlanes(transform?.mirrorPlanes)) {
    if (plane === 'xoy' || plane === 'xy') multipliers.z *= -1
    else if (plane === 'yoz' || plane === 'yz') multipliers.x *= -1
    else if (plane === 'xoz' || plane === 'xz') multipliers.y *= -1
  }
  return multipliers
}

function normalizeRotation(transform) {
  const rotation = transform?.rotationDegrees || transform?.rotation || {}
  return {
    x: normalizeAngleDegrees(rotation.x ?? transform?.rotateXDegrees),
    y: normalizeAngleDegrees(rotation.y ?? transform?.rotateYDegrees),
    z: normalizeAngleDegrees(rotation.z ?? transform?.rotateZDegrees),
  }
}

function normalizeCoordinatePlane(transform) {
  const namedPlane = COORDINATE_PLANES[String(transform?.plane || '').toLowerCase()]
  const axes = Array.isArray(transform?.planeAxes) && transform.planeAxes.length >= 2
    ? transform.planeAxes
    : namedPlane?.axes || ['x', 'y']
  return {
    planeAxes: [
      isAxis(axes[0]) ? axes[0] : 'x',
      isAxis(axes[1]) ? axes[1] : 'y',
    ],
    heightAxis: isAxis(transform?.heightAxis) ? transform.heightAxis : namedPlane?.heightAxis || 'z',
  }
}

function normalizeCoordinateTransform(transform = {}) {
  const plane = normalizeCoordinatePlane(transform)
  const rotation = normalizeRotation(transform)
  const mirror = getMirrorAxisMultipliers(transform)
  return {
    rotation,
    planeAxes: plane.planeAxes,
    flipAxes: {
      x: mirror.x * (transform?.flipAxes?.x === true ? -1 : 1),
      y: mirror.y * (transform?.flipAxes?.y === true ? -1 : 1),
      z: mirror.z * (transform?.flipAxes?.z === true ? -1 : 1),
    },
    offset: {
      x: Number(transform?.offset?.x) || 0,
      y: Number(transform?.offset?.y) || 0,
      z: Number(transform?.offset?.z) || 0,
    },
    heightAxis: plane.heightAxis,
  }
}

export function transformGamePositionToPlane(position, transform) {
  const normalized = normalizeCoordinateTransform(transform)
  const source = {
    x: Number(position?.x),
    y: Number(position?.y),
    z: Number(position?.z),
  }
  const hasRotation = Object.values(normalized.rotation).some((degrees) => degrees !== 0)
  const requiredAxes = new Set([
    ...normalized.planeAxes,
    ...(hasRotation ? AXES : []),
  ])
  for (const axis of requiredAxes) {
    if (!Number.isFinite(source[axis])) return null
  }
  const base = {
    x: Number.isFinite(source.x) ? source.x : 0,
    y: Number.isFinite(source.y) ? source.y : 0,
    z: Number.isFinite(source.z) ? source.z : 0,
  }
  const rotated = ['x', 'y', 'z'].reduce(
    (vector, axis) => rotateVectorAroundAxis(vector, axis, normalized.rotation[axis]),
    base,
  )
  const transformed = {
    x: rotated.x * normalized.flipAxes.x + normalized.offset.x,
    y: rotated.y * normalized.flipAxes.y + normalized.offset.y,
    z: rotated.z * normalized.flipAxes.z + normalized.offset.z,
  }
  const planeX = getAxisValue(transformed, normalized.planeAxes[0])
  const planeY = getAxisValue(transformed, normalized.planeAxes[1])
  const height = getAxisValue(transformed, normalized.heightAxis)
  if (!Number.isFinite(planeX) || !Number.isFinite(planeY)) return null
  return { x: planeX, y: planeY, z: height }
}

export function normalizeLayerGeofence(value) {
  if (!value || value.enabled !== true) return null
  const zMin = Number(value.zMin)
  const zMax = Number(value.zMax)
  let points = Array.isArray(value.points)
    ? value.points
      .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : []

  // Backward compatibility: migrate the old axis-aligned rectangle shape.
  if (points.length < 3) {
    const xMin = Number(value.xMin)
    const xMax = Number(value.xMax)
    const yMin = Number(value.yMin)
    const yMax = Number(value.yMax)
    if ([xMin, xMax, yMin, yMax].every(Number.isFinite)) {
      const left = Math.min(xMin, xMax)
      const right = Math.max(xMin, xMax)
      const top = Math.min(yMin, yMax)
      const bottom = Math.max(yMin, yMax)
      points = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
      ]
    }
  }

  if (points.length < 3 || ![zMin, zMax].every(Number.isFinite)) return null
  return {
    enabled: true,
    points,
    zMin: Math.min(zMin, zMax),
    zMax: Math.max(zMin, zMax),
  }
}

function isPointOnSegment(point, start, end) {
  const cross = (point.y - start.y) * (end.x - start.x)
    - (point.x - start.x) * (end.y - start.y)
  if (Math.abs(cross) > 1e-7) return false
  return point.x >= Math.min(start.x, end.x) - 1e-7
    && point.x <= Math.max(start.x, end.x) + 1e-7
    && point.y >= Math.min(start.y, end.y) - 1e-7
    && point.y <= Math.max(start.y, end.y) + 1e-7
}

function isPointInsidePolygon(point, polygon) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const start = polygon[previous]
    const end = polygon[index]
    if (isPointOnSegment(point, start, end)) return true
    const intersects = (end.y > point.y) !== (start.y > point.y)
      && point.x < (start.x - end.x) * (point.y - end.y) / (start.y - end.y) + end.x
    if (intersects) inside = !inside
  }
  return inside
}

export function isGamePositionInsideGeofence(position, geofence, coordinateTransform = null) {
  const fence = normalizeLayerGeofence(geofence)
  const plane = transformGamePositionToPlane(position, coordinateTransform)
  if (!fence || !plane || !Number.isFinite(plane.z)) return false
  return plane.z >= fence.zMin && plane.z <= fence.zMax
    && isPointInsidePolygon({ x: plane.x, y: plane.y }, fence.points)
}

export function geofenceToMapLatLngs(mapper, geofence) {
  const fence = normalizeLayerGeofence(geofence)
  if (!fence) return []
  return fence.points.map((point) => mapper.planeToLatLng(point))
}

export function createLayerCoordinateMapper(layer) {
  const points = layer.coordinateMapping.points
  const mapX = solveAxis(points, 0)
  const mapY = solveAxis(points, 1)
  const inverseDeterminant = mapX.x * mapY.y - mapX.y * mapY.x

  if (!Number.isFinite(inverseDeterminant) || Math.abs(inverseDeterminant) < 1e-12) {
    throw new Error(`图层“${layer.name}”的坐标映射不可逆`)
  }

  function planeToLocator({ x, y }) {
    return {
      pixelX: mapX.x * Number(x) + mapX.y * Number(y) + mapX.offset,
      pixelY: mapY.x * Number(x) + mapY.y * Number(y) + mapY.offset,
    }
  }

  function gameToLocator(position) {
    const plane = transformGamePositionToPlane(position, layer.coordinateTransform)
    if (!plane) return { pixelX: NaN, pixelY: NaN }
    return planeToLocator(plane)
  }

  function locatorToGame({ pixelX, pixelY, sourceWidth, sourceHeight }) {
    const normalizedX = Number(pixelX) * layer.locator.sourceWidth / (Number(sourceWidth) || layer.locator.sourceWidth)
    const normalizedY = Number(pixelY) * layer.locator.sourceHeight / (Number(sourceHeight) || layer.locator.sourceHeight)
    const shiftedX = normalizedX - mapX.offset
    const shiftedY = normalizedY - mapY.offset
    return {
      x: (shiftedX * mapY.y - mapX.y * shiftedY) / inverseDeterminant,
      y: (mapX.x * shiftedY - shiftedX * mapY.x) / inverseDeterminant,
    }
  }

  function locatorToLatLng({ pixelX, pixelY, sourceWidth, sourceHeight }) {
    const width = Number(sourceWidth) || layer.locator.sourceWidth
    const height = Number(sourceHeight) || layer.locator.sourceHeight
    return [
      -Number(pixelY) * layer.image.height / height,
      Number(pixelX) * layer.image.width / width,
    ]
  }

  function latLngToLocator({ lat, lng }) {
    return {
      pixelX: Number(lng) * layer.locator.sourceWidth / layer.image.width,
      pixelY: -Number(lat) * layer.locator.sourceHeight / layer.image.height,
    }
  }

  return {
    gameToLocator,
    planeToLocator,
    locatorToGame,
    locatorToLatLng,
    latLngToLocator,
    gameToLatLng(point) {
      return locatorToLatLng({
        ...gameToLocator(point),
        sourceWidth: layer.locator.sourceWidth,
        sourceHeight: layer.locator.sourceHeight,
      })
    },
    planeToLatLng(point) {
      return locatorToLatLng({
        ...planeToLocator(point),
        sourceWidth: layer.locator.sourceWidth,
        sourceHeight: layer.locator.sourceHeight,
      })
    },
  }
}

export function resolveLayerNavigationPosition({
  layer,
  mapper,
  calibrated,
  gameX,
  gameY,
  gameZ,
  pixelX,
  pixelY,
  sourceWidth,
  sourceHeight,
}) {
  const hasPixelPosition = Number.isFinite(pixelX) && Number.isFinite(pixelY)
  const derived = mapper.gameToLocator({ x: gameX, y: gameY, z: gameZ })
  const hasGamePosition = Number.isFinite(derived.pixelX) && Number.isFinite(derived.pixelY)
  const useGamePosition = hasGamePosition && (calibrated || !hasPixelPosition)

  if (useGamePosition) {
    return {
      position: {
        ...derived,
        sourceWidth: layer.locator.sourceWidth,
        sourceHeight: layer.locator.sourceHeight,
      },
      source: 'CALIBRATED PLANE',
      usesGameCoordinates: true,
    }
  }

  if (hasPixelPosition) {
    return {
      position: {
        pixelX,
        pixelY,
        sourceWidth: Number(sourceWidth) || layer.locator.sourceWidth,
        sourceHeight: Number(sourceHeight) || layer.locator.sourceHeight,
      },
      source: 'WS PIXEL',
      usesGameCoordinates: false,
    }
  }

  return {
    position: null,
    source: 'none',
    usesGameCoordinates: false,
  }
}
