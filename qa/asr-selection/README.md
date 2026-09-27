# ASR 选型、语义跟读与汇报稿

正式默认模型已改为 `qwen-audio-3.1-asr-flash-streaming`。运行服务的 `/api/capabilities` 和浏览器 ASR ready 消息均已确认，完整浏览器链路已验证。没有自动降级伪装成所选模型。

选择依据：[阿里云语音识别选型](https://help.aliyun.com/zh/model-studio/asr-model)将它列为实时场景首选。它支持热词及上下文增强；本项目本次未注入整篇稿件或创建热词表。官方推荐并非所有延迟指标最优的承诺。

## 相同样本对比

使用同一个 12.65 秒合成 WAV、16 kHz PCM、40 ms 上传分包，各调用一次真实云端。下列间隔仅对归一化后文本发生变化的 partial 计数；末句完整文字与句子切分不应混为一谈。

| 模型 | 首个文字 | 更新间隔中位数 | P95 |
|---|---:|---:|---:|
| 原 Qwen3-ASR-Realtime | 473 ms | 420 ms | 941 ms |
| Qwen-Audio 3.1 Streaming | 398 ms | 719 ms | 1227 ms |
| Fun-ASR-Realtime | 330 ms | 721 ms | 1496 ms |

三款最终文字一致，标点、断句有差别。3.1 这次的中间文字与最终文字一致；原 Qwen3 曾出现“我们是”“稿件了”，Fun-ASR 曾出现“是”再修正为“然后”。所以选官方首选 3.1，同时保留限制：这次样本的中间返回更稳定，但更新频率低于原模型，不能宣传为所有延迟都降低，也不能据此推出现场语音准确率。

原始记录位于 `../latency/qwen-audio-3-1-streaming.json`、`../latency/qwen3-current-comparison.json`、`../latency/fun-asr-realtime-comparison.json`。

接入使用新的 run-task / binary PCM / result-generated / finish-task 协议，保留原 Qwen realtime 协议以供显式选择。中间结果不伪装成不可变前缀，心跳不触发高亮，句子 ID 在 partial/final 间保持一致，停止后仍排空尾段。协议依据：[客户端事件](https://help.aliyun.com/zh/model-studio/fun-asr-client-events)、[服务端事件](https://help.aliyun.com/zh/model-studio/fun-asr-server-events)。

## 语义推进

用户明确要求容忍错字与近义表达。精确匹配仍直接处理；局部差异及意思一致的表达交给 Jev，允许当前附近的稿件片段作为语义候选，而不是先用字面相似度把它拒绝。候选仅是假设，核对通过前不移动。

真实 Jev 验证（见 `semantic-review.json`）：

- “我按搞件朗读，标记就跟随我的位置。” → match 0.99，接受。
- “我照着稿子念，屏幕会标出我正在读的位置。” → 对应“我按稿件朗读，标记就跟随我的位置”，match 0.99，接受。
- “这里我补充一下，语音识别有时候也会出现错误。” → no_match 0.99，保持。
- “我没有按照稿件朗读，标记也不会跟随我的位置。” → no_match 1.00，保持。

低字面重叠的当前局部语义候选采用 match ≥ 0.7 的演示门槛；字面接近的原有门槛保留。这是少量代表案例验证，不是完整准确率评测。语义改述只能定位到对应片段末尾，不能声称拥有每个同义词的声学时间戳。

完整浏览器测试：样本音频经过 AudioWorklet、正式 4178 后端、新 ASR、稿件定位与 Jev；位置推进到 20，插话期间位置始终保持 20，最后推进到 32。浏览器首段 ASR 373 ms，最后一次 Jev 261 ms，上传积压 0 ms。见 `browser-asr31.json` / `asr31-proof.png`。之后将核对期间的状态文字统一为“保持位置”，避免等待与暂停标签交替；位置算法未改变。

汇报稿改为讲者第一人称，五行、32 px，保留纸张配色与单屏布局；通过 oil-tone 文风检查。`npm test` 90 项通过，`npm run build` 通过。

以上音频为合成样本，不是用户现场麦克风测试。
