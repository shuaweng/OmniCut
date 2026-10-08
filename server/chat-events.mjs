// Project the Harness' native transient frames and durable session events into UI state.
const contentText = (content, type = 'text') => (content || []).filter(b => b.type === type).map(b => b.text || '').join('\n');
function assistant(state, frame) {
  const id = `assistant:${(state.segmentId||state.turnId)||frame.turn}:${frame.step}`;
  let message = state.messages.find(m => m.id === id);
  if (!message) { message = { id, turnToken:(state.segmentId||state.turnId), role: 'assistant', text: '', reasoning: '', status: 'streaming' }; state.messages.push(message); }
  return message;
}
export function reduceChatEvent(state, input) {
  if (input.type === 'stream') {
    const f = input.frame;
    if (f.type === 'start') {
      const m = assistant(state, f);
      Object.assign(m, { attemptId: f.attemptId, streamIndex: -1, text: '', reasoning: '', status: 'streaming' });
    } else {
      const m = state.messages.findLast(m => m.attemptId === f.attemptId && m.turnToken === (state.segmentId||state.turnId));
      if (!m) return;
      if (f.type === 'chunk') {
        if (f.index <= (m.streamIndex ?? -1)) return;
        m.streamIndex = f.index;
        if (f.chunk.type === 'text-delta') m.text += f.chunk.text;
        if (f.chunk.type === 'reasoning-delta') m.reasoning += f.chunk.text;
        if (f.chunk.type === 'tool-call-delta') m.activity = '正在准备工具调用';
      }
      if (f.type === 'end' && f.outcome.kind === 'abandoned') m.status = 'interrupted';
    }
    return;
  }
  const e = input.event, d = e?.data;
  if (!d) return;
  if (e.type === 'assistant/message') {
    const m = assistant(state, d);
    Object.assign(m, { text: contentText(d.message.content), reasoning: contentText(d.message.content, 'reasoning') || m.reasoning,
      status: d.interrupted ? 'interrupted' : 'done', usage: d.usage });
    delete m.activity;
  }
  if (e.type === 'tool/call') {
    const id = 'tool:' + ((state.segmentId||state.turnId)?(state.segmentId||state.turnId)+':':'') + d.callId;
    if (!state.messages.some(m => m.id === id)) state.messages.push({ id, role: 'tool', name: d.name, arguments: d.arguments, status: 'running', started: Date.now() });
  }
  if (e.type === 'tool/result') {
    const m = state.messages.find(m => m.id === 'tool:' + ((state.segmentId||state.turnId)?(state.segmentId||state.turnId)+':':'') + d.message.toolCallId);
    if (m) Object.assign(m, { status: d.message.isError ? 'failed' : 'done', result: contentText(d.message.content), error: d.error?.reason, elapsed: Date.now() - m.started });
  }
}
export function interruptMessages(state) {
  for (const m of state.messages) if (m.status === 'streaming' || m.status === 'running') m.status = 'interrupted';
}
