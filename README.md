# MySchedule / yaoyaoflow

一个本地优先的个人日程与效率工作台，集成任务清单、日历、倒数日、提醒、番茄钟和富文本笔记。项目支持多主题外观、图片识别日程、笔记多媒体附件、Markdown 导入和 Notion 同步能力。

## 功能亮点

- **任务清单**：清单分组、优先级、日期时间、拖拽排序、回收站。
- **日历管理**：月 / 周 / 日视图，任务、提醒、倒数日统一展示。
- **图片识别日程**：支持一次添加多张图片；一张图片中识别多个日程时可批量创建。
- **富文本笔记**：Tiptap 编辑器，支持标题、列表、任务列表、代码块、链接、图片、视频。
- **Markdown 支持**：粘贴或导入 Markdown 自动转为富文本。
- **笔记附件库**：上传图片 / 视频后自动归档到附件库；图片可 OCR 并插入识别文字。
- **主题系统**：白天、夜间、复古电子乐、像素风、波普风、蒙德里安等主题。
- **Notion 集成**：支持 Notion OAuth、同步任务和笔记。
- **桌面端**：基于 Electron，支持 macOS 本地图像 OCR。

## 技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- Tiptap
- Electron
- macOS Vision OCR Swift helper

## 本地运行

安装依赖：

```bash
npm install
```

启动 Web 开发环境：

```bash
npm run dev
```

构建生产包：

```bash
npm run build
```

启动桌面端：

```bash
npx electron .
```

也可以直接执行桌面构建流程：

```bash
npm run desktop:dev
```

## 项目结构

```text
web-app/
├── electron/              # Electron 主进程、preload、OCR helper
├── public/                # 静态资源
├── src/
│   ├── app/               # React 路由入口
│   ├── components/        # 通用组件、导航、布局
│   ├── features/          # 业务模块
│   │   ├── calendar/      # 日历
│   │   ├── countdown/     # 倒数日
│   │   ├── notes/         # 笔记
│   │   ├── pomodoro/      # 番茄钟
│   │   ├── profile/       # 设置与主题
│   │   ├── reminders/     # 提醒
│   │   ├── tasks/         # 任务清单
│   │   └── trash/         # 回收站
│   ├── lib/               # 工具函数
│   └── styles/            # 全局样式和主题变量
└── package.json
```

## 数据存储

当前应用以本地优先为主，任务、笔记、日历等数据通过 Zustand persist 存储在浏览器 / Electron 的 localStorage 中。桌面端 OCR 依赖 macOS 系统能力。

## Notion 配置

Notion OAuth 相关环境变量可按需配置：

```bash
NOTION_OAUTH_CLIENT_ID=...
NOTION_OAUTH_CLIENT_SECRET=...
NOTION_OAUTH_REDIRECT_URI=http://127.0.0.1:39391/notion/callback
```

未配置时，应用仍可正常使用本地功能。

## 开发备注

- `node_modules`、`dist`、`release`、`*.tsbuildinfo` 不会提交到仓库。
- 图片 / 视频附件目前会以内嵌数据形式保存在笔记内容和附件数据中，适合本地使用；大量媒体文件建议后续升级为独立附件存储。
- Electron 开发环境会出现 CSP 安全提示，打包生产应用时需要进一步收紧安全策略。

## License

Personal project. All rights reserved unless otherwise specified.
