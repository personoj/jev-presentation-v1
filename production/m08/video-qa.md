# m08 视频检查

本文件记录保留的 v1 母版。网页媒体现已采用 v2；屋顶出框修复与最新验收见 video-qa-v2.md，最新编译目录为 compiled-v2。

## 已完成

- 本组独立首次 Pilot 调用成功；上游 M01 的 approval.json 已确认通过。没有额度或权限错误，没有重试。
- 原始母版 master.mp4 保留：1344 × 768，24 fps，124 帧。
- 根据实测尺寸上下各裁6像素，生成 master-16x9.mp4，1344 × 756；无缩放、插帧或重排帧。
- 已看 contact.jpg（4 fps 抽样）、actual-first.png、actual-tail.png，以及 compiled/qa/contact-sheet.jpg（完整124帧）。
- 底座通过可见中央铰链展开，最后为两座同类型、同配置街区。两侧均无人、无交易数字且光照相同。抬起阶段纸板与建筑短暂越过画面顶部，随下降回到完整双视图；这是该母版的可见构图特征，根页面验收时应重点复看。没有用画面暗示哪边更繁荣。
- motion-budget.json 的 strict 检查通过：baked-video，segment-playback，1100 × 619 CSS像素、DPR 1。
- 桌面1344 × 756，手机768 × 432，均为静音H.264；compile.json 的 allFramesAreKeyframes 均为 true。
- timeline.json 由编译器生成：初态 m08-first，终态 m08-last；hold=5.125秒，endExclusive=5.166666666666667秒。
- public/media/m08.mp4、m08-mobile.mp4、m08-timeline.json 已复制；组内poster.png是实际末帧。

## 页面检查待根执行

本子任务的 CUA inventory 未列出浏览器，IAB 返回 unavailable。因此没有编造完整实时播放、快速反向、慢网或reduced-motion验收。媒体已供根页面挂载，最终应在真实界面完整观看并检查停帧、降级和移动端。没有生成本组 approval.json。
