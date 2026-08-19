# 📄 PDF 划词智能翻译阅读器 (AI Selection Translator)

> 🚀 基于大模型 (LLM) 的高精度划词即译 PDF 阅读器。纯前端单页架构，零后端依赖，支持 GitHub Pages 一键免费部署！

---

## ✨ 核心特性

- ⚡ **划词即译**：鼠标划选英文即可秒出纯中文翻译，点击其他区域自动关闭浮窗。
- 🎯 **智能整词吸附**：划选自动扩展对齐到完整单词边界，彻底避免选中半个词。
- 📜 **连续瀑布流翻页**：默认多页垂直连续滚动排版，滚轮一滑到底。
- 🔍 **超清矢量渲染**：默认 270% 高清大字显示，字迹平滑细腻无锯齿。
- 💾 **自动记忆进度**：浏览器 IndexedDB 毫秒级持久化，自动恢复上次阅读文件与页码。
- 🌐 **多大模型支持**：支持 Google Gemini、DeepSeek、OpenAI (ChatGPT)、硅基流动、MiniMax、Ollama 本地大模型。
- 🔒 **隐私安全**：所有 API Key 仅保存在使用者自己的本地浏览器中，绝不上报云端。

---

## 🛠️ GitHub Pages 快速部署步骤

1. 在 GitHub 上新建一个仓库（例如命名为 `pdf-translator`）。
2. 将本目录下的 `index.html` 和 `.nojekyll` 上传至该仓库的主分支（`main`）。
3. 点击仓库顶部的 **Settings** -> 左侧导航栏 **Pages**。
4. 在 **Build and deployment** 下的 **Branch** 选择 `main` 分支并点击 **Save**。
5. 等待 1~2 分钟，即可获得你的专属在线网站地址：
   `https://<你的GitHub用户名>.github.io/pdf-translator/`
