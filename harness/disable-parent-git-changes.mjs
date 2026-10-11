/**
 * OmniCut video projects do not expose repository change summaries. The native
 * recorder discovers enclosing Git repositories, which may be the application
 * checkout rather than the current video workspace.
 *
 * Replace that optional recorder through the profile's public plugin seat.
 * Keep its public service available for native ui-deliverables: unavailable
 * summaries hide old change cards without claiming that no files changed.
 * Explicit file deliveries, filesystem tools and project history are separate.
 */
export const name = 'frame-disable-parent-git-changes';

export function apply(ctx) {
  ctx.provide('workspaceChanges', {
    summary: () => undefined,
    diff: async () => undefined,
  });
}
