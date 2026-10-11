import type { Clip, StudioSnapshot, Track } from "../shared.js";

export type FrameTrackKind = "visual" | "motion" | "audio" | "caption";

/** A display layer contains authored words; a caption's title may only be #1. */
export function readableClipName(clip: Clip): string {
  const words = clip.display.layers
    .filter((layer) => layer.kind === "text")
    .map((layer) => layer.text)
    .join(" ").replace(/\s+/gu, " ").trim();
  return words || clip.display.title;
}

export function shortClipName(name: string, limit: number): string {
  const letters = Array.from(name);
  return letters.length > limit ? `${letters.slice(0, limit).join("")}…` : name;
}

export function frameTrackKind(track: Track): FrameTrackKind {
  if (track.binding.facet === "audio") return "audio";
  if (track.binding.family === "caption"
    || /字幕|caption|subtitle/iu.test(`${track.binding.label ?? ""} ${track.label}`)) return "caption";
  if (["media", "performance"].includes(track.binding.family)
    || /(?:^|[-:#])(shot|concept|endcard)(?:$|[-:#])/iu.test(`${track.binding.authoredTag ?? ""} ${track.binding.companion}`)
    || track.clips.some((clip) => clip.display.layers.some((layer) => layer.kind === "preview"
      && layer.preview.kind !== "audio"))) return "visual";
  return "motion";
}

export type FrameCaptionCell = { readonly name: string; readonly startFrame: number; readonly endFrameExclusive: number };

/** Read-only cue geometry from a code component's existing inspector binding. */
export function codeCaptionCells(clip: Clip, frameRate: number): readonly FrameCaptionCell[] {
  const cues = clip.inspector.find((field) => field.binding === "cues")?.value;
  if (typeof cues !== "string") return [];
  return cues.split(";;").flatMap((cue) => {
    const [from, to, ...words] = cue.split("|");
    const start = Number(from);
    const end = Number(to);
    const name = words.join("|").trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || name.length === 0) return [];
    const startFrame = Math.max(clip.startFrame, clip.startFrame + Math.round(start * frameRate));
    const endFrameExclusive = Math.min(clip.endFrameExclusive, clip.startFrame + Math.round(end * frameRate));
    return endFrameExclusive > startFrame ? [{ name, startFrame, endFrameExclusive }] : [];
  });
}

/** Dense authored/code compositions keep their exact tracks behind four facets. */
export function usesFrameTrackGroups(snapshot: StudioSnapshot): boolean {
  return snapshot.tracks.length >= 10
    && snapshot.tracks.some((track) => frameTrackKind(track) === "motion");
}

export const frameTrackGroups = [
  { kind: "visual", label: "画面", icon: "video", tone: "blue" },
  { kind: "motion", label: "动效", icon: "component", tone: "violet" },
  { kind: "audio", label: "音频", icon: "waveform", tone: "green" },
  { kind: "caption", label: "字幕", icon: "captions", tone: "magenta" },
] as const;
