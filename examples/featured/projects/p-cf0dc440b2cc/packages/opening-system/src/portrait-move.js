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
// 全屏近景 ↔ 右上圆窗的连续形变：视口、内裁与描边一起过渡，两端与相邻 Style 对齐。
const DEFAULTS = {
  "from-zoom": 1.5,
  "to-zoom": 1.23,
  "from-focus-y": 26,
  "to-focus-y": 28,
  "ring-color": palette.accent,
};
export function installPortraitTransition(module, manifest, component) {
  const optionsType = { module, name: "Framing" };
  const inputs = [
      { name: "timeline", type: timelineTypes.track },
      { name: "canvas", type: spatialTypes.canvas },
      { name: "window", type: temporalTypes.window },
      { name: "from", type: spatialTypes.frame },
      { name: "to", type: spatialTypes.frame },
      { name: "options", type: optionsType },
    ],
    producer = { module, name: "portrait-transition" };
  manifest.producers.push({
    name: "portrait-transition",
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
      const { timeline, canvas, window, from, to, options } = Object.fromEntries(
          Object.entries(inputs).map(([k, r]) => [k, r.value.value]),
        ),
        o = { ...DEFAULTS, ...options },
        { clips, children } = performanceMedia(timeline, window);
      const program = browserProgram({
        html:
          '<div class="viewport"><div class="inner">' +
          children.map((v) => "{{" + v.id + "}}").join("") +
          "</div></div>",
        css: ".viewport{position:absolute;overflow:hidden}.inner{position:absolute;inset:0}",
        data: {
          from,
          to,
          o,
          ink: palette.ink,
          spans: clips.map((c) => ({
            start: c.span.startFrame - window.span.startFrame,
            end: c.span.endFrameExclusive - window.span.startFrame,
          })),
          duration: window.span.endFrameExclusive - window.span.startFrame,
        },
        setup: `const view=root.querySelector('.viewport'),inner=root.querySelector('.inner'),videos=[...inner.querySelectorAll('video')];return f=>{
 const p=Math.max(0,Math.min(1,f/Math.max(1,data.duration-1))),q=p*p*p*(p*(p*6-15)+10),a=data.from,b=data.to,o=data.o;
 Object.assign(view.style,{left:(a.xPx+(b.xPx-a.xPx)*q)+'px',top:(a.yPx+(b.yPx-a.yPx)*q)+'px',width:(a.widthPx+(b.widthPx-a.widthPx)*q)+'px',height:(a.heightPx+(b.heightPx-a.heightPx)*q)+'px',borderRadius:(50*q)+'%',border:(4*q)+'px solid '+data.ink,boxShadow:q===0?'none':'0 0 0 '+(5*q)+'px '+o['ring-color']+','+(8*q)+'px '+(10*q)+'px 0 '+(5*q)+'px '+data.ink});
 const z=o['from-zoom']+(o['to-zoom']-o['from-zoom'])*q,fy=o['from-focus-y']+(o['to-focus-y']-o['from-focus-y'])*q;
 inner.style.transform='scale('+z+')';inner.style.transformOrigin='50% '+fy+'%';
 videos.forEach((v,i)=>{v.style.setProperty('object-position','50% '+fy+'%','important');v.style.visibility=f>=data.spans[i].start&&f<data.spans[i].end?'inherit':'hidden'});
};`,
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
      name: "portrait-transition",
      tag: "PortraitTransition",
      mode: "structured",
      outputs: [performanceTypes.style],
      vocabulary: {
        summary:
          "Continuous prepared-performance move between two Frames, ending in the circular presenter inset.",
        attributes: [
          {
            name: "id",
            kind: "identifier",
            required: true,
            summary: "Style identity",
          },
          ...["from", "to"].map((name) => ({
            name,
            kind: "reference",
            required: true,
            accepts: [spatialTypes.frame],
            summary: "Endpoint frame",
          })),
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
      assertAttributes(element, ["id", "from", "to", "options"]);
      assertEmptyElement(element);
      const bindings = {};
      for (const [n, t] of [
        ["from", spatialTypes.frame],
        ["to", spatialTypes.frame],
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
