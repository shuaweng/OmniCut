import assert from "node:assert/strict";
import test from "node:test";
import { loadMaterials, materialUrls } from "../src/ui/isolated-preview.js";
import { materialTag } from "../src/server.js";

const project = "p-eea876508eae", video = "v-dfb6950b128b";
const href = `http://localhost:5180/hypit-studio/?project=${project}&videoId=${video}`;
const audio = `/__studio/projects/${project}/videos/${video}/material/res_7d88066b-b3ce-4561-b326-397763d27552`;

test("isolated preview materializes the current film's audio and deduplicates its sources", () => {
  const html = `<audio src="${audio}"></audio><audio src="${audio}"></audio>`;
  const oldMatches = html.match(/\/__studio\/(?:projects\/p-[a-f0-9]{12}\/)?material\/res_[a-zA-Z0-9._:-]+/g) || [];
  assert.equal(oldMatches.length, 0, "the previous matcher skipped the real film route");
  assert.deepEqual(materialUrls(html, href), [audio]);
});

test("isolated preview refuses materials from another project or film before fetching", () => {
  assert.throws(() => materialUrls(audio.replace(project, "p-111111111111"), href), /当前项目/);
  assert.throws(() => materialUrls(audio.replace(video, "v-111111111111"), href), /当前视频/);
  assert.throws(() => materialUrls(audio.replace(`/videos/${video}`, ""), href), /当前视频/);
});

test("isolated preview retains unscoped and default-film materials", () => {
  const unscoped = "/__studio/material/res_audio";
  assert.deepEqual(materialUrls(unscoped, "http://localhost:5180/"), [unscoped]);
  const legacy = `/__studio/projects/${project}/material/res_audio`;
  assert.deepEqual(materialUrls(legacy, `http://localhost:5180/?project=${project}&videoId=v-default`), [legacy]);
});

test("material tags follow content, not the per-compile resource id", () => {
  const bytes = new TextEncoder().encode("frame");
  assert.equal(materialTag(bytes), materialTag(new Uint8Array(bytes)));
  assert.notEqual(materialTag(bytes), materialTag(new TextEncoder().encode("other")));
});

test("a recompiled film downloads only media whose content changed", async () => {
  const content: Record<string, { tag: string; body: string }> = {
    "/a1": { tag: '"same"', body: "kept" }, "/a2": { tag: '"same"', body: "kept" },
    "/b1": { tag: '"old"', body: "before" }, "/b2": { tag: '"new"', body: "after" },
  };
  const requests: string[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    const item = content[url]!;requests.push((init?.method || "GET") + " " + url);
    return new Response(init?.method === "HEAD" ? null : item.body, { headers: { etag: item.tag } });
  }) as typeof fetch;
  const first = await loadMaterials(["/a1", "/b1"], new Map(), undefined, fetcher);
  assert.deepEqual(requests, ["GET /a1", "GET /b1"], "a cold load skips content probes");
  requests.length = 0;
  const second = await loadMaterials(["/a2", "/b2"], first.cache, undefined, fetcher);
  assert.deepEqual(requests.sort(), ["GET /b2", "HEAD /a2", "HEAD /b2"]);
  assert.equal(second.resources[0]!.blob, first.resources[0]!.blob);
  assert.equal(await second.resources[1]!.blob.text(), "after");
  assert.deepEqual([...second.cache.keys()].sort(), ['"new"', '"same"'], "media no longer on screen is released");
});
