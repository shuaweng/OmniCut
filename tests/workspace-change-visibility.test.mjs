import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { apply as applyDeliverables } from '@deepseek-ai/dsh-client-ui-deliverables';
import * as disableParentGitChanges from '../harness/disable-parent-git-changes.mjs';

test('视频配置不提供旧 Git 摘要或差异，原生文件交付服务继续可用', async t => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  await ctx.plugin(disableParentGitChanges);
  const routes = new Map(), cleanups = [];
  t.after(async () => { for (const cleanup of cleanups) await cleanup(); });
  // Exercise the shipped native delivery routes, including a historical
  // workspace/changes coordinate. No files, Git or model calls are involved.
  applyDeliverables({
    workspaceChanges: ctx.workspaceChanges,
    connection: { fetch: { register: route => routes.set(route.path, route) } },
    sessionController: { workspaceDesktop: () => ({ available: true }) },
    systemPrompt: { section() {}, getSectionOrder: () => 0 },
    effect: effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); },
  });
  for (const route of ['/api/changes.summary', '/api/changes.diff']) {
    const response = await routes.get(route).fetch(new Request(`http://fixture.test${route}?sessionId=old-video-session&seq=24&index=0`));
    assert.equal(response.status, 404, 'unavailable, not an empty or fabricated change summary');
  }
  const hostRoute = [...routes.values()].find(route => route.path.endsWith('/present.host'));
  assert.ok(hostRoute, 'native explicit-delivery endpoints remain registered');
  assert.equal((await hostRoute.fetch()).status, 200);
});
