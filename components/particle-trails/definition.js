export const definition={
  "name": "粒子轨迹",
  "category": "空间图形",
  "description": "粒子沿螺旋轨迹聚拢，帧求值保留完整可重复路径。",
  "image": false,
  "packageName": "@frame/particle-trails",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "让能量 汇聚"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "微小的光，连接成新的方向"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#141b29"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#f0eff1"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#8cd8dd"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#7775b5"
    },
    {
      "key": "count",
      "label": "粒子数量",
      "type": "number",
      "default": 90,
      "min": 20,
      "max": 180,
      "step": 1
    },
    {
      "key": "x",
      "label": "水平位置 %",
      "type": "number",
      "default": 50,
      "min": -50,
      "max": 150,
      "step": 1
    },
    {
      "key": "y",
      "label": "垂直位置 %",
      "type": "number",
      "default": 50,
      "min": -50,
      "max": 150,
      "step": 1
    },
    {
      "key": "scale",
      "label": "整体缩放",
      "type": "number",
      "default": 1,
      "min": 0.25,
      "max": 2,
      "step": 0.05
    },
    {
      "key": "speed",
      "label": "动作速度",
      "type": "number",
      "default": 1,
      "min": 0.25,
      "max": 3,
      "step": 0.1
    },
    {
      "key": "intensity",
      "label": "运动幅度",
      "type": "number",
      "default": 1,
      "min": 0,
      "max": 2,
      "step": 0.1
    },
    {
      "key": "transparent",
      "label": "透明背景 true / false",
      "type": "text",
      "default": "false"
    },
    {
      "key": "z",
      "label": "图层顺序",
      "type": "number",
      "default": 50,
      "step": 1
    }
  ]
};
