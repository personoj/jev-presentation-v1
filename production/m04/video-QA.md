# M04 视频与编译检查

此记录更新先前静帧 QA：已使用现有独立首尾帧，通过内置适配器默认 minimax/minimax-h3-max 各提交一次任务并成功，无重试。

- 原始视频：768×768、24 fps、124 帧；视频流约5.167秒，母版容器含音轨共约5.184秒。
- 已查看20个时间采样、124帧原生接触表、实际解码尾帧，以及移动成片第0/36/72/123帧在400px显示下的解码检查图。
- 内容观察：导向片约45度转动；中文稿件与固定底座可辨，没有伪造高亮或音频数据。
- 保留原生帧，没有插帧、裁切、抠色或跳帧拼接。连续结构变化未见明显闪帧、额外物件或突变。
- motion_budget.py --strict：400×400 CSS、DPR1、video背景、segment-play、linear，选择baked-video并通过。
- 编译输出：桌面720×720、手机480×480；24fps，124帧，全I帧，两版本均只有视频流、无音轨；元数据由ffprobe复核。
- 实际时间轴由编译器生成在 build/timeline.json；hold与endExclusive不同，供共享控制器读取。
- public/media/m04.mp4、m04-mobile.mp4、m04-poster.png、m04-timeline.json 已复制。

本组尚未由本代理完成实际网页最终位置、反向输入、弱网与reduced-motion验收，因此没有创建或伪造本组 Pilot approval。媒体技术审计可用，运行时批准交由根代理。

可复现参数保存在video-prompt.txt、contract.yaml、brief.yaml、job.json、build/motion-budget.json、compiled/compile.json与video-QA.json。母版与首尾图保留；编译器按默认策略清理可重建PNG，完整接触表保留在compiled/qa/contact-sheet.jpg。
