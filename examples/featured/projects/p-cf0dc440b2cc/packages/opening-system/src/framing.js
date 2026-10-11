import {
  assertAttributes,
  assertEmptyElement,
  textAttribute,
  canonicalize,
  createMarkupSurfaceHostFacet,
} from "@hypit/hypit/author-kit";
import { palette } from "@omnicut/visual-language";

// 取景参数是一个可被 Style 引用的普通元素：圆窗、全屏近景、半屏用同一组参数表达。
const LITERALS = {
  shape: "circle",
  radius: 28,
  zoom: 1.23,
  "focus-x": 50,
  "focus-y": 28,
  border: 4,
  ring: 5,
  "ring-color": palette.accent,
  "from-zoom": 1.5,
  "to-zoom": 1.23,
  "from-focus-y": 26,
  "to-focus-y": 28,
};
export function installFraming(module, manifest, component) {
  const framingType = { module, name: "Framing" };
  return createMarkupSurfaceHostFacet({
    module,
    declaration: {
      name: "framing",
      tag: "Framing",
      mode: "structured",
      outputs: [framingType],
      vocabulary: {
        summary:
          "Named viewport framing for the presenter: circle inset, full close-up, half screen or the move between them.",
        attributes: [
          { name: "id", kind: "identifier", required: true, summary: "Framing identity" },
          ...Object.keys(LITERALS).map((name) => ({
            name,
            kind: "literal",
            required: false,
            summary: name,
          })),
        ],
      },
    },
    handler: ({ element }) => {
      assertAttributes(element, ["id", ...Object.keys(LITERALS)]);
      assertEmptyElement(element);
      const id = textAttribute(element, "id"),
        value = { id };
      for (const [name, fallback] of Object.entries(LITERALS)) {
        const v = element.attributes[name];
        if (v !== undefined && typeof v !== "string") throw Error(name + " must be literal");
        value[name] = typeof fallback === "number" ? Number(v ?? fallback) : (v ?? fallback);
      }
      return {
        records: [
          {
            id: id + ".options",
            type: framingType,
            value: { kind: "inline", value: canonicalize(value) },
            range: element.range,
          },
        ],
        components: [],
        fragments: [],
        exports: [id + ".options"],
      };
    },
  });
}
