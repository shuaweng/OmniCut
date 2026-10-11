import { palette } from "@omnicut/visual-language";
import { performanceMedia } from "./performance-media.js";
import {
  assertAttributes,
  assertEmptyElement,
  textAttribute,
  canonicalize,
  sealGraphFragment,
  createMarkupSurfaceHostFacet,
  sameType,
} from "@hypit/hypit/author-kit";
import { performanceStyle, performanceTypes } from "@hypit/hypit/performance";
import { sealVisualTrack, compositionTypes } from "@hypit/hypit/composition";
import { timelineTypes } from "@hypit/hypit/timeline";
import { spatialTypes } from "@hypit/hypit/spatial";
import { temporalTypes } from "@hypit/hypit/temporal";
import { browserProgram } from "@hypit/hypit/hyperframes";
const styles = (o) =>
  Object.entries(o).map(([name, value]) => ({ name, value }));
// 取景参数由 <gfx:Framing> 元素引用进来：shape="circle" 是右上圆窗，
// shape="rect" 配合整屏 Frame 是开场近景，配合上半屏 Frame 是半屏取景。
const DEFAULTS = {
  shape: "circle",
  radius: 28,
  zoom: 1.23,
  "focus-x": 50,
  "focus-y": 28,
  border: 4,
  ring: 5,
  "ring-color": palette.accent,
};
export function installPortraitInset(module, manifest, component) {
  const optionsType = { module, name: "Framing" };
  const inputs = [
      { name: "timeline", type: timelineTypes.track },
      { name: "canvas", type: spatialTypes.canvas },
      { name: "window", type: temporalTypes.window },
      { name: "frame", type: spatialTypes.frame },
      { name: "options", type: optionsType },
    ],
    producer = { module, name: "portrait-inset" };
  manifest.producers.push({
    name: "portrait-inset",
    inputs,
    outputs: [{ name: "visual", type: compositionTypes.visualTrack }],
    needs: [],
  });
  const fragment = sealGraphFragment({
    inputs,
    operations: [
      {
        id: "render",
        producer,
        inputs: Object.fromEntries(
          inputs.map((p) => [p.name, { kind: "fragment-input", name: p.name }]),
        ),
        result: { kind: "output", name: "visual" },
      },
    ],
    exports: [
      {
        name: "visual",
        type: compositionTypes.visualTrack,
        root: { kind: "fragment-operation", operation: "render" },
      },
    ],
  });
  component.producers.push({
    producer,
    handler: ({ inputs }) => {
      const { timeline, canvas, window, frame, options } = Object.fromEntries(
          Object.entries(inputs).map(([k, r]) => [k, r.value.value]),
        ),
        o = { ...DEFAULTS, ...options },
        { clips, children } = performanceMedia(timeline, window);
      const radius = o.shape === "circle" ? "50%" : o.radius + "px",
        border = o.border > 0 ? o.border + "px solid " + palette.ink : "0",
        ring =
          o.ring > 0
            ? "0 0 0 " + o.ring + "px " + o["ring-color"] + ", 8px 10px 0 " + o.ring + "px " + palette.ink
            : "none";
      const program = browserProgram({
        html:
          '<div class="viewport"><div class="inner">' +
          children.map((v) => "{{" + v.id + "}}").join("") +
          "</div></div>",
        css: `.viewport{position:absolute;overflow:hidden;border-radius:${radius};border:${border};box-shadow:${ring}}.inner{position:absolute;inset:0;transform:scale(${o.zoom});transform-origin:${o["focus-x"]}% ${o["focus-y"]}%}.inner>*{object-position:${o["focus-x"]}% ${o["focus-y"]}%!important}`,
        data: {
          frame,
          spans: clips.map((c) => ({
            start: c.span.startFrame - window.span.startFrame,
            end: c.span.endFrameExclusive - window.span.startFrame,
          })),
        },
        setup: `const view=root.querySelector('.viewport'),a=data.frame;Object.assign(view.style,{left:a.xPx+'px',top:a.yPx+'px',width:a.widthPx+'px',height:a.heightPx+'px'});const vs=[...root.querySelectorAll('video')];return f=>vs.forEach((v,i)=>v.style.visibility=f>=data.spans[i].start&&f<data.spans[i].end?'inherit':'hidden');`,
      });
      const id = window.subjectId,
        visual = sealVisualTrack({
          id,
          programSpaceId: timeline.id,
          visualIr: "hypit.visual-ir@1",
          presents: children.length
            ? [
                {
                  id,
                  span: window.span,
                  stacking: { order: 60, tieBreak: id },
                  elements: [
                    {
                      id: "scene",
                      kind: "program",
                      order: 0,
                      program,
                      style: styles({
                        position: "absolute",
                        inset: 0,
                        width: canvas.widthPx + "px",
                        height: canvas.heightPx + "px",
                      }),
                    },
                    ...children,
                  ],
                },
              ]
            : [],
        });
      return {
        outputs: { visual: { kind: "inline", value: canonicalize(visual) } },
        needs: {},
      };
    },
  });
  return createMarkupSurfaceHostFacet({
    module,
    declaration: {
      name: "portrait-inset",
      tag: "PortraitInset",
      mode: "structured",
      outputs: [performanceTypes.style],
      vocabulary: {
        summary:
          "Speaking portrait viewport with a closer inner crop: circular inset, full close-up or half screen.",
        attributes: [
          {
            name: "id",
            kind: "identifier",
            required: true,
            summary: "Style identity",
          },
          {
            name: "frame",
            kind: "reference",
            required: true,
            accepts: [spatialTypes.frame],
            summary: "Portrait viewport",
          },
          {
            name: "options",
            kind: "reference",
            required: true,
            accepts: [optionsType],
            summary: "Framing parameters",
          },
        ],
      },
    },
    handler: ({ element, resolveReference }) => {
      assertAttributes(element, ["id", "frame", "options"]);
      assertEmptyElement(element);
      const bindings = {};
      for (const [n, t] of [
        ["frame", spatialTypes.frame],
        ["options", optionsType],
      ]) {
        const a = element.attributes[n];
        if (a?.kind !== "reference") throw Error(n + " needs a reference");
        const r = resolveReference(a.path);
        if (!r || !sameType(r.type, t)) throw Error(n + " has the wrong type");
        bindings[n] = r;
      }
      return {
        records: [
          {
            id: textAttribute(element, "id"),
            type: performanceTypes.style,
            value: {
              kind: "inline",
              value: canonicalize(performanceStyle(fragment, bindings)),
            },
            range: element.range,
          },
        ],
        components: [],
        fragments: [],
      };
    },
  });
}
