import { compositionTypes } from "@hypit/hypit/composition";
import { textLayer, temporalLineageFor } from "@hypit/hypit/studio-adapter";

// Studio 时间线里每个场景的中文名与推进线索：改动直接写在工程源码，界面同步可读。
const scenes = {
  Workbench: ["素材汇入工作台", "图片 · 声音 · 字幕落进轨道，动效在画面轨上弹入"],
  Rework: ["参考改编", "参考卡拆开重组 → 大尺寸真实运动样片 → 时间线选中太慢的一段"],
  Adjust: ["一句话修改", "说出要求 → 样片当场换成另一条真实镜头"],
  Claim: ["主张双卡", "工作台·精确 / 对话·自由 随台词出现"],
  Brand: ["品牌收束", "卡片回中心 → 正式标志 → 让想法开口"],
};

export function sceneCompanions(module, tags) {
  return Object.entries(tags).map(([tag, spec]) => ({
    id: spec.name,
    role: "track",
    output: {
      type: compositionTypes.visualTrack,
      surface: spec.name,
      modules: [module],
    },
    family: "omnicut-scenes",
    label: scenes[tag][0],
    tone: "orange",
    icon: "component",
    lane: { heightPx: 52 },
    bindings: [{ name: "z", writable: true, fallback: spec.defaults.z }],
    inspector: [
      {
        binding: "z",
        label: "叠放顺序",
        domain: "where",
        section: { id: "stack", label: "层次" },
        control: "number",
        number: { step: 1 },
      },
    ],
    project(context) {
      return context.generic().map((e) => ({
        ...e,
        temporal: temporalLineageFor(context, context.placement.id, "window"),
        display: {
          title: scenes[tag][0],
          layers: [textLayer(scenes[tag][1])],
        },
        inspector: [
          {
            id: "sequence",
            label: "推进",
            domain: "how",
            section: { id: "scene", label: "段落" },
            value: scenes[tag][1],
          },
        ],
      }));
    },
  }));
}
