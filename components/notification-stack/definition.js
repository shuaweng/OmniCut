export const definition={
  "name": "通知堆叠",
  "category": "界面产品",
  "description": "消息通知从顶部依次滑入并堆叠，最新一条高亮。",
  "image": false,
  "packageName": "@frame/notification-stack",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "好消息接连不断"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "实时提醒，不错过每一次"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#e9edf2"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#14171c"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#2f80ed"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#9aa4b1"
    },
    {
      "key": "items",
      "label": "通知内容（竖线分隔）",
      "type": "text",
      "default": "订单已发货|新评论：太好用了|本周播放量 +240%|你的成片已导出"
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
