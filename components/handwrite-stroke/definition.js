export const definition={
  "name": "手写描边",
  "category": "文字排版",
  "description": "一笔墨线顺着路径写出，标题与下划线随之落定。",
  "image": false,
  "packageName": "@frame/handwrite-stroke",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "写给生活的情书"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "慢一点，也很好"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#f6f0e6"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#2b2620"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#c8553d"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#8c7b6b"
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
