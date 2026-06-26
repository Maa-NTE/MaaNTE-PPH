# MaaNTE 粉爪大劫案在线地图

基于 Vue 3、Leaflet 和 Vite 的多图层在线地图。当前已加入首个图层“大厅”。

## 启动

```powershell
npm install
npm run dev
```

开发服务器默认运行在 `http://127.0.0.1:5173`。

## 图层与坐标

图层配置位于 `src/data/layers.js`。每个图层独立声明：

- 底图地址与图片尺寸；
- MapLocator 坐标源尺寸；
- 游戏 X/Y 到 MapLocator 像素坐标的三点仿射标定。
- 导航箭头方向偏移 `navigation.angleOffset`。

新增楼层时只需增加一项配置和对应底图，不会影响其他楼层的坐标映射。

“大厅”的方向偏移当前为 `180` 度：

```text
显示角度 = (WebSocket angle + 当前图层 angleOffset) mod 360
```

“大厅”的三点标定已经固化在 `src/data/layers.js`。浏览器中不存在
`pph-layer-calibrations` 覆盖数据时，也会直接使用仓库内置标定。

### 调试标定

1. 开启实时定位并确认 WebSocket 正在发送游戏 `x/y`。
2. 点击当前图层的“开始标定”。
3. 玩家站在一个明确位置时，点击地图上的对应点。
4. 移动到另外两个不共线的位置并重复点击。
5. 第三个点采集后，页面会校验并立即应用该图层的仿射映射。

标定结果按图层保存在浏览器 `localStorage` 的 `pph-layer-calibrations` 中。“重新标定”会覆盖当前图层结果，“清除标定”会恢复仓库内的默认映射。

### 电子围栏

每个图层可以独立配置游戏真实坐标围栏：

- XY：沿边界依次点击至少三个顶点，生成任意多边形；
- Z：单独填写最小值和最大值，也可以读取 WebSocket 当前 Z；
- 可视化：范围会根据当前图层仿射映射绘制为地图多边形；
- 判定：X、Y、Z 必须同时落在范围内，角色才被认为处于该图层；
- 多图层：存在多个围栏时，会自动切换到第一个命中的图层；
- 未命中：只要已经配置任意围栏，但当前坐标未命中任何图层，定位箭头就会隐藏。

通过 `npm run dev` 使用围栏编辑器保存时，数据会直接回写
`src/data/layers.js` 中当前图层的 `geofence` 字段，同时在浏览器中保留即时覆盖。
生产静态站点没有写源码能力，只能保存在当前浏览器。

围栏保存后不会继续显示在地图上；只有新增或编辑围栏时才显示范围框。

仓库内图层使用以下结构：

```js
geofence: {
  enabled: true,
  points: [
    { x: -100, y: -100 },
    { x: 100, y: -100 },
    { x: 80, y: 100 },
    { x: -80, y: 100 },
  ],
  zMin: 0,
  zMax: 500,
}
```

旧版 `xMin/xMax/yMin/yMax` 矩形配置仍会自动读取，并在下次保存时迁移为多边形。

## WebSocket

默认连接地址与 MaaNTE-Map 一致：

```text
ws://127.0.0.1:14514
```

可通过环境变量覆盖：

```env
VITE_MAANTE_NAVI_WEBSOCKET_URL=ws://127.0.0.1:14514
```

兼容消息类型：

- 接收：`navi-state`、`navi-route-ack`、`navi-error`
- 发送：`navi-route-set`、`navi-route-start`、`navi-route-stop`、`navi-route-clear`

`navi-route-set` 的字段结构与 MaaNTE-Map 保持一致。当前活动图层决定路线点的 `sourceWidth/sourceHeight` 与坐标映射。

完整示例见 [`docs/websocket-api.md`](docs/websocket-api.md)。
