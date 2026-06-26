# 地图端 WebSocket 接口

本项目保持与 `MaaNTE-Map` 相同的 WebSocket 消息类型和默认连接地址。

## 连接

- 默认地址：`ws://127.0.0.1:14514`
- 消息编码：UTF-8 JSON 文本
- 异常断开后：每 2 秒重连
- 环境变量：`VITE_MAANTE_NAVI_WEBSOCKET_URL`

## 服务端发送

### `navi-state`

```json
{
  "type": "navi-state",
  "version": 1,
  "position": {
    "x": 0,
    "y": 0,
    "z": 0,
    "pixelX": 5600,
    "pixelY": 5600,
    "sourceWidth": 11264,
    "sourceHeight": 11264
  },
  "angle": 90,
  "angleConfidence": 0.9,
  "route": {
    "status": "running",
    "currentIndex": 0,
    "waypoints": []
  }
}
```

页面优先使用 `pixelX/pixelY`。消息只有游戏 `x/y` 时，使用当前活动图层自己的仿射标定转换。

### `navi-route-ack`

```json
{
  "type": "navi-route-ack",
  "message": "路线已设置",
  "route": {
    "status": "running",
    "currentIndex": 0,
    "waypoints": []
  }
}
```

### `navi-error`

```json
{
  "type": "navi-error",
  "message": "路径点为空",
  "code": "EMPTY_WAYPOINTS"
}
```

## 地图端发送

### `navi-route-set`

```json
{
  "type": "navi-route-set",
  "sourceWidth": 11264,
  "sourceHeight": 11264,
  "start": true,
  "waypoints": [
    { "pixelX": 5600, "pixelY": 5600 }
  ]
}
```

`sourceWidth/sourceHeight` 来自当前活动图层的 `locator` 配置。

### 路线控制

```json
{ "type": "navi-route-start" }
```

```json
{ "type": "navi-route-stop" }
```

```json
{ "type": "navi-route-clear" }
```
