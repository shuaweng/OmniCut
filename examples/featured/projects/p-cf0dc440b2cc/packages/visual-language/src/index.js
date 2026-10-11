// OmniCut 视觉语言：近黑底、橙调、奶白，替代原片的粉色体系。
export const palette = Object.freeze({
  ink: "#0B0B0C",
  panel: "#17171A",
  panelSoft: "#212127",
  accent: "#FF6B35",
  accentSoft: "#FFB48F",
  cream: "#F6F1E8",
  muted: "#9AA0A6",
  line: "#3A3A42",
  success: "#8FB8A8",
});
export const paletteCss =
  ":scope{" +
  Object.entries(palette)
    .map(([name, value]) => "--" + name + ":" + value)
    .join(";") +
    "}";
