# 图像提示词记录

历史记录：本文件记录初版过程。用户已要求书籍具有完整内容并扩展全程动效，下面涉及空白页的提示词已停用。当前使用 `motion-prompts-v2.md`，最新设计见 `../全程动效设计.md`。

使用内置 ImageGen。图像用于构图与视觉方向讨论，不是已经实现的网页截图，也不是视频生产首尾帧。生成图中文字以《剧本.md》的可编辑文字为准。

## 开场预览：第一次生成

Use case: ui-mockup. Create ONE polished 16:9 landscape concept image for a Chinese academic presentation about Jev, an AI decision model. This is a proposed opening screen, not a product marketing landing page. Editorial museum exhibition art direction: warm ivory paper, charcoal ink, very restrained vermilion accents, subtle real paper grain, accurate elegant Chinese typography, large readable content for projection. Balanced composition: text occupies left 48%, an exquisitely realistic original cream clothbound book occupies right 45%, seen in a three-quarter overhead view, slightly open with natural paper curvature and a thin red bookmark. Book is an original design referencing Daniel Kahneman's Thinking, Fast and Slow concept, not a replica of any commercial cover. Soft upper-left daylight, real contact shadows, clean matte paper, no gold, no neon, no sci-fi decoration, no ornamental particles. Render the following exact visible text with generous spacing: small top-left label "组会汇报"; large title "Jev 的结构化判断"; subtitle "从《思考，快与慢》到文本分析与主体模拟"; one substantial readable paragraph below: "Jev 根据上下文回答范围明确的问题，返回选项、评分或概率。我们通过跟读定位、政策文本分析和经济主体模拟，讨论这些判断怎样进入程序，以及如何检验它们的效果。"; three modest bottom labels "模型机制" "现场跟读" "政策与 ABM". Small bottom-right "01 / 11". On the book only typeset "思考，快与慢" and "Thinking, Fast and Slow", no invented author credit, no explanatory paragraph. Keep a meaningful 60:40 visual/text balance, text readable and stable, not tiny annotations. No browser chrome, no fake charts, no logos, no branding claims or benchmark numbers. Quiet confident academic design, physically beautiful book, enough actual explanatory text. Output high-resolution landscape 16:9 image.

## 开场预览：风格修订

Edit this concept image into a contemporary INTERACTIVE WEB opening screen for the same Jev academic research presentation. Preserve all main Chinese text exactly, the warm ivory / charcoal / restrained vermilion palette, book title and the left text / right book composition. Make one coherent style correction: remove tea cup, tray, flowers, inkstone, brush, handwriting sheet, landscape painting on book cover, red sun motif and all other decorative props. The only physical object is the same ivory clothbound book with a thin vermilion ribbon; give it a plain unillustrated cover with the original title. Use a clean warm-white studio paper backdrop with very subtle texture; no aged parchment or rustic decor. Book appears as a beautiful precise object in a quiet contemporary science museum. Keep projected body text as readable as now. Replace "01 / 11" with a small understated web control "进入原理 →". Convert the three bottom topic labels into clean understated web navigation links, and add a small subtle top-right "目录" control. No slide counters or PowerPoint appearance, no fake charts, no decorative glow. This is still a raster concept of the web design, not a screenshot of a working app. Wide 16:9 framing, modern editorial scientific restraint.

## 旧版生产素材提示词（已停用）

### 分镜概念板

undefined

正式首尾帧需分别生成，并使用前帧参考保持身份，不能从概念拼图裁切。

### K0：书本闭合

Use case: product-mockup. A single original cream clothbound hardcover book with a narrow vermilion ribbon, on a clean warm-white studio surface. Quiet contemporary academic exhibition art direction. Book on the right half, generous clean negative space on the left for editable web typography. Three-quarter overhead view, believable book thickness, delicate cloth and paper fibers, soft upper-left light, stable natural contact shadow. Plain cover, no embedded text, no landscape painting, no tea or decorative objects. 16:9 landscape. Preserve a simple repeatable composition for a subsequent book-opening video.

### K1：书本打开

Edit the supplied K0 reference. Preserve the same book identity, cloth color, ribbon, page thickness, table, camera and lighting. Open the front cover into a physically believable resting spread. Warm-white unprinted pages with restrained natural curvature. Keep the central region of the right page clean as the next camera target; a very thin vermilion bracket can mark its perimeter. Do not add objects, diagrams, readable text or decorative illustrations. 16:9 landscape. The same scene, after one book-opening action.

### K2：进入右页

Edit the approved K1 reference. Advance the camera toward the clean right-page target on a single continuous optical path. End in a close, nearly frontal paper view that fills the entire 16:9 frame, maintaining paper color and gentle lighting. Only delicate paper fibers, with no text, borders or visible UI. The final paper surface will hand over to editable webpage content. No tunnels, particles, cosmic scenes or circuitry.

### V01：开书

Use the approved first and last frames as exact scene and identity anchors. One cream clothbound hardcover book opens around its actual spine and settles naturally into the provided spread. The camera remains at the same position. Maintain the same cloth, ribbon, page count impression, thickness, table and soft upper-left illumination. One uninterrupted motion, approximately five seconds. No cuts, camera orbit, duplicated cover, page melting, new props or generated text. End cleanly at the supplied last-frame composition, with no long frozen tail.

### V02：进入书页

Use the actual decoded tail frame of V01 as the first image and approved K2 as the final image. Move continuously toward the clean target on the right-hand page of the same book. Maintain the same paper color, surface identity and lighting. Let the paper gradually fill the 16:9 frame and finish in the exact K2 view, approximately four seconds. No scene changes, cosmic tunnels, smoke, particles, camera roll, abrupt focus changes, generated letters or diagrams. Preserve a stable, legible handover to a static webpage background.
