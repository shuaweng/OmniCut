// OmniCut 场景共用底色：近黑、橙调、奶白；不使用原片的粉色体系。
export const scene_styles = `:scope {
  pointer-events: none;
  color: #F6F1E8;
  overflow: hidden;
  background: transparent;
}
.backdrop {
  position: absolute;
  inset: -12%;
  filter: blur(24px) brightness(0.3);
  transform: scale(1.12);
  overflow: hidden;
}
.backdrop-pane {
  position: absolute;
  top: 0;
  bottom: 0;
  opacity: 0;
  overflow: hidden;
}
.backdrop-pane > * {
  object-fit: cover !important;
}
.backdrop-wash {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #0B0B0C66 0%, #0B0B0C33 45%, #0B0B0Ce6 100%);
}
.font-resource {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}
.grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(#ffffff09 1px, transparent 1px),
    linear-gradient(90deg, #ffffff09 1px, transparent 1px);
  background-size: 54px 54px;
}
.glow {
  position: absolute;
  left: -20%;
  bottom: -18%;
  width: 90%;
  height: 55%;
  background: radial-gradient(closest-side, #FF6B3533, transparent);
}
.panel {
  background: #17171A;
  border: 2px solid #34343C;
  border-radius: 28px;
  box-shadow: 0 26px 60px #000000a6;
  overflow: hidden;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  height: 74px;
  padding: 0 30px;
  background: #17171Ae6;
  border: 2px solid #34343C;
  border-radius: 999px;
  font-size: 32px;
  letter-spacing: 2px;
}
.dot {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: #FF6B35;
}
.accent { color: #FF6B35; }
.muted { color: #9AA0A6; }
`;
