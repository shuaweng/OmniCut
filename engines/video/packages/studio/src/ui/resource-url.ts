// A host may scope one Studio to a project/video. Native standalone sessions
// keep their original addresses, including existing artifact query parameters.
export function studioResourceUrl(value: string): string {
  const params = new URL(location.href).searchParams;
  const projectId = params.get("project");
  if (!/^p-[a-f0-9]{12}$/.test(projectId ?? "")) return value;
  const url = new URL(value, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith("/__studio/")) return value;
  if (!url.pathname.startsWith("/__studio/projects/")) url.pathname = `/__studio/projects/${projectId}/` + url.pathname.slice("/__studio/".length);
  const videoId = params.get("videoId");
  if (videoId) url.searchParams.set("videoId", videoId);
  return url.pathname + url.search + url.hash;
}
