# Jev 组会演示

面向初学者的 15 页浏览器演示，包含模型介绍、实时跟读、四页 ABM 小镇展示和其他应用。当前版本按 `visuals/reference-v3/manifest.json` 的参考图重做，保留原版暖米白、炭黑、朱红与纸张质感。

首次下载需要安装 Node.js 22 或更高版本，在项目目录执行：

```powershell
npm ci
npm run build
npm start
```

打开 http://127.0.0.1:4178/#opening 。完成安装和构建后，也可以双击 `启动演示.cmd` 启动；启动器会复用已经运行的演示服务。当前演示采用固定比例的全屏画布，通过点击或按键逐步推进。

静态展示和 ABM 演示可直接查看。实时 Jev 判断和麦克风识别需要自己的服务密钥：启动服务前设置进程环境变量 `TYPESAFE_API_KEY` 和 `DASHSCOPE_API_KEY`，或用 `API_KEYS_FILE` 指向本机密钥文件，配置说明见 `server/README.md`。仓库不包含服务密钥，`.env.example` 仅为配置参考，服务不会自动加载 `.env`。

- F11 或 F 全屏；← →、Page Up / Page Down、空格逐步推进。
- Esc 打开目录，N 查看笔记，Home 回到开场，点击页码重播本页。
- O 循环切换：实际画面、叠图、参考原图。
- 逐页截图对照： http://127.0.0.1:4178/reference-review/index.html 。
- 三个案例右上角“现场判断”可以运行 Jev，结果标记为实际返回。
- 语音页可开启麦克风，也可用“按稿朗读 → 临时插话 → 回到原文”试演。
- 完整旧版与备用实验： http://127.0.0.1:4178/?legacy#opening 。

操作见 `使用说明.md`；每页内容与制作方式见 `source/reference-v3-production.md`；检查结果见 `qa/reference-v3/验收记录.md`。生成素材及提示词在 `public/reference-art/`，实际截图在 `public/reference-review/`。

React 19、TypeScript、Vite、Node.js。当前入口为 `src/reference/Deck.tsx`。原判断、语音和小镇机制继续复用。密钥仍由本机服务读取，不进入前端。

维护：`npm test`、`npm run build`。开发页面 `npm run dev`（5178），正式页面与接口 `npm start`（4178）。
