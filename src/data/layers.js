const OFFICE_ROTATED_X90_XOY_TRANSFORM = {
  rotationDegrees: { x: -90 },
  plane: 'xoy',
}

const OFFICE_ROTATED_X90_XOZ_TRANSFORM = {
  rotationDegrees: { x: -90 },
  plane: 'xoz',
}

const OFFICE_ROTATED_X90_YOZ_TRANSFORM = {
  rotationDegrees: { x: -90 },
  plane: 'yoz',
}

const OFFICE_ROTATED_X90_MIRROR_XOY_TRANSFORM = {
  rotationDegrees: { x: -90 },
  plane: 'xoy',
  mirrorPlanes: ['xoy'],
}

const OFFICE_ROTATED_X90_FLIPPED_XZ_TRANSFORM = {
  rotationDegrees: { x: -90 },
  plane: 'xoy',
  flipAxes: { y: true },
}

export const MAP_LAYERS = [
  {
    id: 'lobby',
    name: '大厅',
    subtitle: '粉爪总部 · 主楼层',
    imageUrl: '/maps/lobby.png',
    image: {
      width: 4096,
      height: 4096,
    },
    locator: {
      sourceWidth: 11264,
      sourceHeight: 11264,
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: true,
      points: [
        { x: -38506.244, y: -22703.426 },
        { x: -32605.997, y: -22703.426 },
        { x: -32605.997, y: -14577.225 },
        { x: -38506.244, y: -14577.225 },
      ],
      zMin: 3015,
      zMax: 5000,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-22T16:28:04.692Z',
      points: [
        { raw: [-35430.03, -19612.28], map: [5692.5, 7020.75] },
        { raw: [-35986.73, -19065.57], map: [6476.25, 6230.125] },
        { raw: [-34869.39, -19051.99], map: [4915.625, 6239.75] },
      ],
    },
  },
  {
    id: 'lobby-lower',
    name: '大厅下楼',
    subtitle: '粉爪总部 · 下层',
    imageUrl: '/maps/lobby-lower.png',
    image: {
      width: 4096,
      height: 4096,
    },
    locator: {
      sourceWidth: 11264,
      sourceHeight: 11264,
    },
    navigation: {
      angleOffset: 0,
    },
    geofence: {
      enabled: true,
      points: [
        { x: -37604.846, y: -19298.747 },
        { x: -33182.15, y: -19174.278 },
        { x: -33119.496, y: -14807.356 },
        { x: -37665.625, y: -14792.779 },
      ],
      zMin: 2500,
      zMax: 3015,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-23T04:34:33.548Z',
      points: [
        { raw: [-35914.63, -16380.53], map: [4970.625, 7403] },
        { raw: [-34918.24, -16882.7], map: [6389.625, 6679.75] },
        { raw: [-35920.95, -18131], map: [4966.5, 4933.5] },
      ],
    },
  },
  {
    id: 'g1-office',
    name: 'G1 办公层',
    subtitle: '办公区 · x0 + x1',
    imageUrl: '/maps/g1-office.png',
    image: {
      width: 8192,
      height: 4096,
    },
    locator: {
      sourceWidth: 22528,
      sourceHeight: 11264,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'xoy',
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: true,
      points: [
        { x: -31774.726, y: 1209.25 },
        { x: -34112.655, y: 1188.439 },
        { x: -34141.668, y: -167.22 },
        { x: -41420.298, y: -308.153 },
        { x: -41479.068, y: -2552.027 },
        { x: -41104.846, y: -2644.679 },
        { x: -40992.018, y: -4981.658 },
        { x: -36237.881, y: -5158.002 },
        { x: -36110.558, y: -6809.361 },
        { x: -33710.234, y: -6819.574 },
        { x: -33573.185, y: -4793.667 },
        { x: -30362.494, y: -4724.159 },
        { x: -30286.872, y: -3274.906 },
        { x: -26904.781, y: -3173.852 },
        { x: -26738.024, y: -228.567 },
        { x: -31585.505, y: -161.502 },
      ],
      zMin: 3000,
      zMax: 4000,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-23T04:57:55.868Z',
      points: [
        { raw: [-34353.54, -5367.06], map: [11464.75, 9453.125] },
        { raw: [-35607.03, -1850.87], map: [13226.125, 4484.563] },
        { raw: [-31683.21, -2424.94], map: [7689, 5307.5] },
      ],
    },
  },
  {
    id: 'g1-office-w2',
    name: 'G1 办公层 W2',
    subtitle: '办公区 · w2 · x0 + x1',
    imageUrl: '/maps/g1-office-w2.png',
    image: {
      width: 8192,
      height: 4096,
    },
    locator: {
      sourceWidth: 22528,
      sourceHeight: 11264,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'xoy',
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: true,
      points: [
        { x: -40991.696, y: 1367.868 },
        { x: -28783.013, y: 1463.879 },
        { x: -28863.172, y: -4890.166 },
        { x: -41010.432, y: -4909.646 },
      ],
      zMin: 4500,
      zMax: 5500,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-25T14:12:40.453Z',
      points: [
        { raw: [-34700.32, -1913.5], map: [11591.25, 6124.25] },
        { raw: [-35124.53, -3725.09], map: [10989, 8723] },
        { raw: [-36022.68, -1905.1], map: [9689.625, 6118.75] },
      ],
    },
  },
  {
    id: 'g1-office-w2-left',
    name: 'G1 Office W2 Left',
    subtitle: 'office area / w2 left / x0 z0',
    imageUrl: '/maps/g1-office-w2-left.png',
    image: {
      width: 4096,
      height: 4096,
    },
    locator: {
      sourceWidth: 11264,
      sourceHeight: 11264,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'xoy',
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: true,
      points: [
        { x: -35358.098, y: 352.877 },
        { x: -40782.045, y: 429.215 },
        { x: -40878.997, y: 7659.063 },
        { x: -35415.952, y: 7660.811 },
      ],
      zMin: 2500,
      zMax: 3500,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-25T15:49:28.327Z',
      points: [
        { raw: [-38228.36, 2425.94], map: [5662.25, 7980.5] },
        { raw: [-40127.92, 3606.13], map: [8346.25, 6331.875] },
        { raw: [-39132.62, 4596.81], map: [6943.75, 4933.5] },
      ],
    },
  },
  {
    id: 'g1-office-w2-right',
    name: 'G1 Office W2 Right',
    subtitle: 'office area / w2 right / z0 + z1',
    imageUrl: '/maps/g1-office-w2-right.png',
    image: {
      width: 4096,
      height: 8192,
    },
    locator: {
      sourceWidth: 11264,
      sourceHeight: 22528,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'xoy',
      flipAxes: { x: true },
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: true,
      points: [
        { x: 28905.05, y: 12258.071 },
        { x: 32395.116, y: 12151.411 },
        { x: 32469.265, y: 8877.117 },
        { x: 33528.662, y: 8768.726 },
        { x: 33526.389, y: 6788.524 },
        { x: 34523.48, y: 6695.682 },
        { x: 34549.596, y: 2298.72 },
        { x: 29064.938, y: 2232.447 },
      ],
      zMin: 2600,
      zMax: 3500,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-25T16:06:58.907Z',
      points: [
        { raw: [30624.36, 3366.91], map: [3916, 16946.875] },
        { raw: [30629.9, 7345.83], map: [3917.375, 11332.75] },
        { raw: [32414.75, 6348.23], map: [6439.125, 12742.125] },
      ],
    },
  },
  {
    id: 'g1-office-w2-left-small-room',
    name: 'G1 Office W2 Left Small Room',
    subtitle: 'office room / w2 left small',
    imageUrl: '/maps/g1-office-w2-left-small-room.png',
    image: {
      width: 4096,
      height: 4096,
    },
    locator: {
      sourceWidth: 11264,
      sourceHeight: 11264,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'yoz',
    },
    navigation: {
      angleOffset: 0,
    },
    geofence: {
      enabled: true,
      points: [
        { x: 690.119, y: 5207.092 },
        { x: 601.961, y: 3126.271 },
        { x: 5780.443, y: 3064.47 },
        { x: 5913.283, y: 5132.671 },
      ],
      zMin: -50000,
      zMax: -40000,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-25T15:52:21.550Z',
      points: [
        { raw: [1526.25, 4467.3], map: [5083.375, 2288] },
        { raw: [1676.98, 3811.7], map: [6278.25, 2629] },
        { raw: [5635.59, 4833.94], map: [4314.75, 10271.25] },
      ],
    },
  },
  {
    id: 'g1-office-w2-right-small-room',
    name: 'G1 Office W2 Right Small Room',
    subtitle: 'office room / w2 right small',
    imageUrl: '/maps/g1-office-w2-right-small-room.png',
    image: {
      width: 4096,
      height: 4096,
    },
    locator: {
      sourceWidth: 11264,
      sourceHeight: 11264,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'yoz',
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: true,
      points: [
        { x: 8380.775, y: 5551.323 },
        { x: 8318.24, y: 2280.758 },
        { x: 3692.416, y: 2229.176 },
        { x: 3771.77, y: 5525.716 },
      ],
      zMin: -30000,
      zMax: -25000,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-25T16:11:59.536Z',
      points: [
        { raw: [6740.76, 4005.12], map: [5227.75, 4259.75] },
        { raw: [3985.23, 3358.07], map: [6542.25, 9856] },
        { raw: [3990.34, 3975.74], map: [5225, 9878] },
      ],
    },
  },
  {
    id: 'g1-office-w3',
    name: 'G1 Office W3',
    subtitle: 'office area / w3 / x0 + x1',
    imageUrl: '/maps/g1-office-w3.png',
    image: {
      width: 8192,
      height: 4096,
    },
    locator: {
      sourceWidth: 22528,
      sourceHeight: 11264,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'xoy',
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: true,
      points: [
        { x: -39667.75, y: 2127.854 },
        { x: -29887.761, y: 2024.886 },
        { x: -29885.441, y: 10964.751 },
        { x: -39664.753, y: 10878.97 },
      ],
      zMin: 3500,
      zMax: 5500,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-25T15:57:55.524Z',
      points: [
        { raw: [-39024.1, 2372.37], map: [5863, 10906.5] },
        { raw: [-35043.11, 7775.32], map: [10983.5, 3979.25] },
        { raw: [-32282.35, 2372.36], map: [14492.5, 10906.5] },
      ],
    },
  },
  {
    id: 'g1-office-w4',
    name: 'G1 Office W4',
    subtitle: 'office area / w4',
    imageUrl: '/maps/g1-office-w4.png',
    image: {
      width: 4096,
      height: 4096,
    },
    locator: {
      sourceWidth: 11264,
      sourceHeight: 11264,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'xoy',
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: true,
      points: [
        { x: -33919.212, y: 13569.685 },
        { x: -33959.596, y: 11590.447 },
        { x: -35774.198, y: 11569.115 },
        { x: -35883.08, y: 13524.418 },
        { x: -36472.198, y: 13585.153 },
        { x: -36422.726, y: 17770.386 },
        { x: -33469.084, y: 17810.932 },
        { x: -33462.292, y: 15910.067 },
        { x: -31404.204, y: 15877.403 },
        { x: -31413.043, y: 14117.296 },
        { x: -33416.249, y: 13962.39 },
        { x: -33408.63, y: 13539.994 },
      ],
      zMin: 2800,
      zMax: 3500,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-25T16:14:52.256Z',
      points: [
        { raw: [-34511.94, 12444.31], map: [6406.125, 8740.875] },
        { raw: [-35266.06, 12436.08], map: [7462.125, 8749.125] },
        { raw: [-34509.56, 13188.44], map: [6403.375, 7694.5] },
      ],
    },
  },
  {
    id: 'g1-office-left-room',
    name: 'G1 Office Left Room',
    subtitle: 'office room / left',
    imageUrl: '/maps/g1-office-left-room.png',
    image: {
      width: 4096,
      height: 4096,
    },
    locator: {
      sourceWidth: 11264,
      sourceHeight: 11264,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'yoz',
    },
    navigation: {
      angleOffset: 90,
    },
    geofence: {
      enabled: true,
      points: [
        { x: -287.234, y: 3565.024 },
        { x: -3412.66, y: 3513.499 },
        { x: -3393.9, y: 5429.073 },
        { x: -268.59, y: 5465.976 },
      ],
      zMin: -30000,
      zMax: -20000,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-25T14:03:58.996Z',
      points: [
        { raw: [-814.11, 3920.74], map: [2560.25, 3982] },
        { raw: [-808.26, 4894.96], map: [2565.75, 6913.5] },
        { raw: [-2815.44, 4886.26], map: [8599.25, 6916.25] },
      ],
    },
  },
  {
    id: 'g1-office-lower-right-small-room',
    name: 'G1 Office Lower Right Small Room',
    subtitle: 'office room / lower right small',
    imageUrl: '/maps/g1-office-lower-right-small-room.png',
    image: {
      width: 4096,
      height: 4096,
    },
    locator: {
      sourceWidth: 11264,
      sourceHeight: 11264,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'yoz',
    },
    navigation: {
      angleOffset: 0,
    },
    geofence: {
      enabled: true,
      points: [
        { x: -4533.529, y: 2754.246 },
        { x: -2196.981, y: 2830.7 },
        { x: -2207.165, y: 5103.652 },
        { x: -4521.898, y: 5005.307 },
      ],
      zMin: -45000,
      zMax: -40000,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-25T14:46:02.883Z',
      points: [
        { raw: [-3714.12, 4392.71], map: [3800.5, 4262.5] },
        { raw: [-3719.98, 3810.28], map: [6088.5, 4262.5] },
        { raw: [-3035.31, 3828.92], map: [6077.5, 6996] },
      ],
    },
  },
  {
    id: 'g1-manager-side-room',
    name: 'G1 Manager Side Room',
    subtitle: 'office room / manager side',
    imageUrl: '/maps/g1-manager-side-room.png',
    image: {
      width: 4096,
      height: 4096,
    },
    locator: {
      sourceWidth: 11264,
      sourceHeight: 11264,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'xoy',
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: false,
    },
    coordinateMapping: {
      version: 1,
      calibrated: false,
      points: [
        { raw: [0, 0], map: [0, 0] },
        { raw: [1, 0], map: [1, 0] },
        { raw: [0, 1], map: [0, 1] },
      ],
    },
  },
  {
    id: 'g2-floor-1',
    name: 'G2 一层',
    subtitle: 'G2 / floor 1 / x0-x2 + z0-z1',
    imageUrl: '/maps/g2-floor-1.png',
    image: {
      width: 12288,
      height: 8192,
    },
    locator: {
      sourceWidth: 33792,
      sourceHeight: 22528,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'xoy',
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: true,
      points: [
        { x: -26196.684, y: 42229.039 },
        { x: -26124.058, y: 38712.026 },
        { x: -29521.44, y: 38635.376 },
        { x: -29549.121, y: 37442.133 },
        { x: -28878.675, y: 37347.562 },
        { x: -28803.11, y: 32825.697 },
        { x: -34148.388, y: 32655.907 },
        { x: -34144.486, y: 31321.339 },
        { x: -35668.689, y: 31306.47 },
        { x: -35734.842, y: 32609.67 },
        { x: -42483.263, y: 32597.653 },
        { x: -42693.219, y: 35109.891 },
        { x: -46386.862, y: 35080.506 },
        { x: -46403.161, y: 40654.29 },
        { x: -39295.725, y: 40477.702 },
        { x: -39437.529, y: 35673.342 },
        { x: -37925.656, y: 35641.116 },
        { x: -37845.275, y: 40131.493 },
        { x: -34482.227, y: 40223.862 },
        { x: -34425.028, y: 41982.318 },
        { x: -37136.929, y: 41999.499 },
        { x: -37177.466, y: 45202.479 },
        { x: -33156.577, y: 45247.387 },
        { x: -32667.967, y: 43378.728 },
        { x: -31327.395, y: 43299.492 },
        { x: -31137.661, y: 42373.043 },
      ],
      zMin: 3300,
      zMax: 4000,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-25T16:26:52.513Z',
      points: [
        { raw: [-34218.13, 33854.11], map: [14063.5, 17109.125] },
        { raw: [-35555.55, 33854.84], map: [15951.375, 17109.125] },
        { raw: [-35131.48, 32238.41], map: [15359.438, 19373.75] },
      ],
    },
  },
  {
    id: 'g2-floor-2',
    name: 'G2 二层',
    subtitle: 'G2 / floor 2 / x0-x1 + z0-z1',
    imageUrl: '/maps/g2-floor-2.png',
    image: {
      width: 8192,
      height: 8192,
    },
    locator: {
      sourceWidth: 22528,
      sourceHeight: 22528,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'xoy',
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: true,
      points: [
        { x: -29107.261, y: 46010.791 },
        { x: -41642.549, y: 46018.666 },
        { x: -41543.934, y: 33966.715 },
        { x: -29305.702, y: 33863.629 },
      ],
      zMin: 4000,
      zMax: 5000,
    },
    coordinateMapping: {
      version: 1,
      calibrated: true,
      calibratedAt: '2026-06-25T16:34:44.159Z',
      points: [
        { raw: [-35708.37, 39826.18], map: [11902, 11467.5] },
        { raw: [-34891.86, 39007.13], map: [10763.5, 12606] },
        { raw: [-34087.59, 39824.24], map: [9626.375, 11471.625] },
      ],
    },
  },
  {
    id: 'vault',
    name: '金库',
    subtitle: 'vault / x0-x1 + z0-z1',
    imageUrl: '/maps/vault.png',
    image: {
      width: 8192,
      height: 8192,
    },
    locator: {
      sourceWidth: 8192,
      sourceHeight: 8192,
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'xoy',
    },
    navigation: {
      angleOffset: 180,
    },
    geofence: {
      enabled: false,
    },
    coordinateMapping: {
      version: 1,
      calibrated: false,
      points: [
        { raw: [0, 0], map: [0, 0] },
        { raw: [1, 0], map: [1, 0] },
        { raw: [0, 1], map: [0, 1] },
      ],
    },
  },
  {
    id: 'all-maps-overview',
    name: '全地图总览',
    subtitle: 'composite / debug layout',
    image: {
      width: 65536,
      height: 65536,
    },
    locator: {
      sourceWidth: 65536,
      sourceHeight: 65536,
    },
    composite: {
      items: [
        { layerId: 'lobby', x: 20704, y: 36576 },
        { layerId: 'lobby-lower', x: 20744, y: 31592 },
        { layerId: 'g1-office', x: 18368, y: 26320 },
        { layerId: 'g1-office-w2', x: 18234, y: 20576 },
        { layerId: 'g1-office-w2-left', x: 13056, y: 18432 },
        { layerId: 'g1-office-w2-right', x: 27072, y: 16224 },
        { layerId: 'g1-office-w2-left-small-room', x: 13024, y: 22912 },
        { layerId: 'g1-office-w2-right-small-room', x: 27072, y: 11680 },
        { layerId: 'g1-office-w3', x: 18240, y: 15840 },
        { layerId: 'g1-office-w4', x: 19872, y: 11328 },
        { layerId: 'g1-office-left-room', x: 13664, y: 27520 },
        { layerId: 'g1-office-lower-right-small-room', x: 25440, y: 31008 },
        { layerId: 'g1-manager-side-room', x: 6176, y: 25376 },
        { layerId: 'g2-floor-1', x: 16644, y: 2720 },
        { layerId: 'g2-floor-2', x: 18112, y: -6112 },
        { layerId: 'vault', x: 18232, y: -14880 },
      ],
      markers: [
        { id: 'mmqubz99p', label: '前往G1', type: 'portal', layerId: 'lobby-lower', x: 2064, y: 1408 },
        { id: 'mmquca68s', label: '前往大厅', type: 'portal', layerId: 'g1-office', x: 4440, y: 3980 },
      ],
      edges: [
        { from: 'mmqubz99p', to: 'mmquca68s', points: [{ x: 22952, y: 31440 }] },
        { from: 'mmquca68s', to: 'mmqubz99p', points: [{ x: 22656, y: 31476 }] },
      ],
    },
    coordinateTransform: {
      rotationDegrees: { x: 0, y: 0, z: 0 },
      plane: 'xoy',
    },
    navigation: {
      angleOffset: 0,
    },
    geofence: {
      enabled: false,
    },
    coordinateMapping: {
      version: 1,
      calibrated: false,
      points: [
        { raw: [0, 0], map: [0, 0] },
        { raw: [1, 0], map: [1, 0] },
        { raw: [0, 1], map: [0, 1] },
      ],
    },
  },
]

export const DEFAULT_LAYER_ID = MAP_LAYERS[0].id
