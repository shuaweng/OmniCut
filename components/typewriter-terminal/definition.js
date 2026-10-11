export const definition={
  "name": "终端打字",
  "category": "代码终端",
  "description": "终端窗口弹出，命令逐字敲入，结果一行行返回。",
  "image": false,
  "packageName": "@frame/typewriter-terminal",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "一句话\n生成整条片子"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "从命令到成片"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#0d1110"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#d8f5d0"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#57e389"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#5f8a72"
    },
    {
      "key": "lines",
      "label": "终端内容（竖线分隔，首行为命令）",
      "type": "text",
      "default": "omnicut 做一条新品发布片|读取素材 6 项|生成分镜 12 镜|成片已导出 00:30"
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
