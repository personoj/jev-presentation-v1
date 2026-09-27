# 本机模型服务

启动：在项目根目录执行 `node server/index.mjs`（可作为 `npm start`）。默认监听 `127.0.0.1:4178`，仅提供 `dist` 和 `public` 内的展示资源，视频支持 Range 请求。请先 `npm run build`。

## 配置

优先读取进程环境变量 `TYPESAFE_API_KEY`、`DASHSCOPE_API_KEY`、`ZENMUX_API_KEY`；缺省时只把 `C:/Users/W/Desktop/apikey.txt` 中名为 `Jev`、`DASHSCOPE_API_KEY`、`ZenMux` 的行解析成凭据，不执行文件内容。`API_KEYS_FILE` 可更改本机文件位置。密钥始终留在服务端内存，不写入项目、前端或日志。

可选环境变量：`JEV_MODEL`、`ASR_MODEL`、`VIDEO_MODEL`、`ASR_WS_URL`、`PORT`。当前默认 `jev-latest`、`qwen3-asr-flash-realtime`、`minimax/minimax-h3-max`。千问默认北京兼容入口已实测可用；其他地域需要对应密钥和 WebSocket URL。

## HTTP

- `GET /api/capabilities` 返回配置存在性，三个 boolean 表示是否配置密钥，不表示额度、网络或模型的实时健康状态。
- `POST /api/evaluate` 请求 `{requestId,stateVersion?,state,questions,model?}`，返回 `{requestId,stateVersion?,model,answers,usage,elapsedMs,source:"live"}`。官方三种答案保持原字段。前端使用 requestId/stateVersion 拒绝过期结果。
- 请求最多 512 KB、1–100 个问题、最多 8 个并行请求、30 秒超时。连接关闭时取消上游 fetch。
- 错误仅返回 `{code,message}`。`RATE_LIMITED` 为临时限流，不自动重试。明确额度不足返回 `QUOTA_EXCEEDED`，熔断该服务至进程重启。绝不返回原始服务商错误内容。

## ASR

`WebSocket /api/asr`：先发 `{"type":"start"}`，等 `{"type":"ready"}` 后发送二进制 PCM16、16 kHz、单声道块。完成时发送 `{"type":"stop"}`，服务器请求 `session.finish`，最后一段 final 到达后返回 stopped 并断开。

- partial `{type:"partial",text,segmentId}`：`text` 是当前 segment 的完整修订文本，由上游 `text + stash` 拼接，前端覆盖同 segment 上次预览。
- final `{type:"final",text,segmentId}`：单个 segment 的最终识别，来自 `transcript`。
- error `{type:"error",code,message}`：停止录音并释放音频设备。
- 每次最多 2 个语音会话；单次最多 20 分钟；浏览器断开立即释放上游连接。

## 验证

`node --test tests/backend*.test.mjs`：9 项本地测试覆盖请求/响应校验、Quota 熔断、限流区分、来源限制、静态目录隔离、视频 Range、ASR 文本修订、停止时排空和断连释放。测试日志的 QUOTA_EXCEEDED 来自模拟，不是账户故障。

`server/evidence/jev-live.json` 保存一次真实三原语调用及模型版本、token 使用量、延迟，未含密钥。`server/evidence/asr-live.json` 保存一次真实语音中继事件；音源为本机 Microsoft Huihui Desktop 合成的 12.65 秒中文，未使用麦克风。对应 `asr-synthetic.wav` 只在 server 目录留档，不由静态服务公开。真实调用脚本 `verify-jev.mjs`、`verify-asr.mjs` 会消耗服务额度，日常测试不调用。

来源：
- https://docs.typesafe.ai/api
- https://docs.typesafe.ai/primitives/choice
- https://docs.typesafe.ai/primitives/noul
- https://docs.typesafe.ai/primitives/score
- https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook
- https://help.aliyun.com/zh/model-studio/qwen-asr-realtime-client-events
- https://help.aliyun.com/zh/model-studio/qwen-asr-realtime-server-events
