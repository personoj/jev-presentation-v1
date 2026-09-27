export class AppError extends Error {
  constructor(code, message, status = 502) { super(message); this.code = code; this.status = status; }
}
export function upstreamError(status, body = '') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  if (status === 402 || /insufficient[_ .-]?(quota|balance|credit)|quota[_ .-]?(exhausted|exceeded)|arrears|out.of.credit|balance.*insufficient|额度不足|余额不足|欠费|allocationquota|free.?tier.*exhaust/i.test(text)) return new AppError('QUOTA_EXCEEDED', '模型服务额度不足，已停止该服务的后续调用。请检查服务商额度。', 402);
  if (status === 429 || /rate.limit|throttl|too.many.requests/i.test(text)) return new AppError('RATE_LIMITED', '模型服务暂时限流，请稍后手动重试。', 429);
  if (status === 401 || status === 403 || /invalid_api_key|authentication|unauthorized/i.test(text)) return new AppError('AUTH_FAILED', '模型服务认证失败，请检查本机密钥与服务地域。', 401);
  if (status === 400 || status === 422) return new AppError('UPSTREAM_BAD_REQUEST', '模型服务拒绝了请求参数，请检查问题定义或模型配置。', 400);
  return new AppError('UPSTREAM_ERROR', '模型服务暂不可用，请稍后重试。', 502);
}
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const description = v => typeof v === 'string' || record(v) || Array.isArray(v);
export function validateRequest(value) {
  if (!record(value) || typeof value.requestId !== 'string' || value.requestId.length > 160 || !value.requestId) throw new AppError('BAD_REQUEST', '需要有效 requestId。', 400);
  if (!description(value.state)) throw new AppError('BAD_REQUEST', 'state 必须是文本、对象或数组。', 400);
  if (!record(value.questions) || Object.keys(value.questions).length < 1 || Object.keys(value.questions).length > 100) throw new AppError('BAD_REQUEST', '需要 1 至 100 个问题。', 400);
  if (value.model !== undefined && (typeof value.model !== 'string' || !/^jev-[a-zA-Z0-9.\-]+$/.test(value.model))) throw new AppError('BAD_REQUEST', '模型名必须是有效 Jev 模型。', 400);
  if (value.stateVersion !== undefined && !['string', 'number'].includes(typeof value.stateVersion)) throw new AppError('BAD_REQUEST', 'stateVersion 必须是数字或文本。', 400);
  for (const [id, q] of Object.entries(value.questions)) {
    if (!id || id.length > 160 || !record(q) || !description(q.instructions)) throw new AppError('BAD_REQUEST', '每个问题需要 instructions。', 400);
    if (q.type === 'choice') {
      if (!record(q.criteria) || Object.keys(q.criteria).length < 2 || Object.keys(q.criteria).length > 255 || Object.values(q.criteria).some(v => v !== null && !description(v))) throw new AppError('BAD_REQUEST', 'Choice 需要 2 至 255 个有定义的选项。', 400);
    } else if (q.type === 'score') {
      if (!Array.isArray(q.criteria) || q.criteria.length < 2 || q.criteria.length > 10 || q.criteria.some(v => !description(v))) throw new AppError('BAD_REQUEST', 'Score 需要 2 至 10 个有序等级。', 400);
    } else if (q.type === 'noul') {
      if (q.criteria !== undefined && !record(q.criteria)) throw new AppError('BAD_REQUEST', 'Noul criteria 必须是对象。', 400);
    } else throw new AppError('BAD_REQUEST', '仅支持 choice、score、noul。', 400);
  }
  return value;
}
const probability = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
export function validateResponse(data, questions) {
  const bad = () => { throw new AppError('INVALID_RESPONSE', '模型返回结构不完整，本次结果未被采用。'); };
  if (!record(data) || typeof data.model !== 'string' || !record(data.answers) || !record(data.usage)) bad();
  for (const [id, q] of Object.entries(questions)) {
    const a = data.answers[id];
    if (!record(a) || a.type !== q.type) bad();
    if (a.type === 'noul') { if (!probability(a.noul)) bad(); continue; }
    if (!probability(a.confidence) || !record(a.probabilities) || Object.values(a.probabilities).some(p => !probability(p))) bad();
    const expected = q.type === 'choice' ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
    if (Object.keys(a.probabilities).length !== expected.length || expected.some(key => !Object.hasOwn(a.probabilities, key)) || Math.abs(Object.values(a.probabilities).reduce((x,y) => x+y, 0)-1) > .03) bad();
    if (a.type === 'choice' && (typeof a.choice !== 'string' || !Object.hasOwn(q.criteria, a.choice))) bad();
    if (a.type === 'score' && (!Number.isFinite(a.score) || a.score < 0 || a.score > q.criteria.length - 1 || !record(a.legend))) bad();
  }
  return data;
}
export function createEvaluator(config, fetcher = fetch) {
  let quotaStopped = false;
  return async (payload, signal) => {
    validateRequest(payload);
    if (!config.keys.jev) throw new AppError('NOT_CONFIGURED', '未配置 Jev 密钥。', 503);
    if (quotaStopped) throw upstreamError(402);
    const started = performance.now();
    const response = await fetcher('https://api.typesafe.ai/v1/systemone', {
      method: 'POST', headers: { Authorization: `Bearer ${config.keys.jev}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: payload.model || config.models.jev, state: payload.state, questions: payload.questions }), signal,
    });
    if (!response.ok) {
      const error = upstreamError(response.status, await response.text());
      if (error.code === 'QUOTA_EXCEEDED') { quotaStopped = true; console.error('[Jev] QUOTA_EXCEEDED: subsequent calls disabled until restart.'); }
      throw error;
    }
    let data;
    try { data = await response.json(); } catch { throw new AppError('INVALID_RESPONSE', '模型返回了无法读取的结果。'); }
    validateResponse(data, payload.questions);
    return { requestId: payload.requestId, ...(payload.stateVersion !== undefined ? {stateVersion: payload.stateVersion} : {}), model: data.model, answers: data.answers, usage: data.usage, elapsedMs: Math.round(performance.now() - started), source: 'live' };
  };
}
