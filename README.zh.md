<p align="center">
  <img src="dsh-browser-annotation/icon.svg" width="72" height="72" alt="dsh-browser-annotation 图标">
</p>

# dsh-browser-annotation

一个非官方的 **DSH Desktop** 社区插件：把内置右侧浏览器变成可视化批注工具。直接在页面上点选元素，填写批注和属性修改，把精确的元素定位信息发送到对话，让模型基于真实 DOM 信息改源码，而不是猜测元素。

> 非官方项目，与 DeepSeek 无隶属关系。基于 DSH Desktop `0.2.1-rc.2`（Electron 44.7.0）开发。插件依赖内置侧栏浏览器的私有 DOM 标记，DSH 升级后可能需要适配。

[English README](README.md) · [插件包说明](dsh-browser-annotation/README.md)

## 功能

- **点击选取**：从输入框「批注」按钮（或右键浏览器标签页）进入批注模式，悬停/点击元素；选取时不会触发页面原有按钮/跳转逻辑。
- **编号标记**：每个批注在元素旁显示带序号的小圆标；点击圆标可查看说明并编辑/删除。
- **同步批注区块**：输入框上方显示当前浏览器标签页的批注列表，支持编辑说明、删除、清空；与页内标记双向同步。
- **精确定位**：页面 URL、已校验唯一性的 CSS 选择器、XPath、稳定属性、DOM、best-effort 源码线索、批注、属性/文本差异。
- **紧凑对话卡片**：输入框里是一个紧凑的批注 chip；发送后对话中渲染成可展开的紧凑卡片（模型仍收到完整文本）。
- **Apple 风页内 UI**：根据页面背景自动浅/深色，可用 ☾/☀ 手动切换；可编辑元素属性和文本。
- **纯客户端**：不新增 Host 服务、工具、路由、网络请求或遥测；只使用公开的批注/槽位 API 和 webview 执行通道。

## 环境要求

- DSH Desktop，且内置右侧浏览器为 Electron `<webview>`；纯 Web 模式不支持。
- DSH `>=0.2.1-rc.2 <0.3.0`（在 `0.2.1-rc.2` / Electron 44.7.0 / Windows 验证）。
- 只有开发检查需要 Node.js；安装后的插件没有构建步骤。

## 安装

1. 克隆仓库：

   ```bash
   git clone https://github.com/Enterdada/dsh-browser-annotation.git
   cd dsh-browser-annotation
   ```

2. 用 DSH 插件管理器安装 **`dsh-browser-annotation/`** 子目录（含 `package.json` 的目录）：
   - 在一个 DSH 会话里，让 Agent 用 `plugin_manager` 的 `install_bundle` 指向该子目录的绝对路径，或使用你的 profile 本地 bundle 安装流程。
   - 如 DSH 要求批准，请确认。

3. 如果客户端 bundle 没有热更新，刷新 DSH 页面。输入框会出现 **「批注」** 按钮，浏览器标签页右键菜单会出现 **「批注模式」**。

4. Settings → Plugins 中应显示 **页面元素批注** 和插件图标。

profile 会链接到克隆目录，请保持路径稳定（移动后需重装）。更新：`git pull`；客户端改动会热更新，Host 改动需要重新安装/重启。卸载：`plugin_manager` 的 `remove_bundle`（包名 `dsh-browser-annotation`）；卸载前先删除草稿里未发送的批注 chip。

## 使用

1. 在右侧浏览器打开一个页面（建议源码在当前工作区的本地开发服务器页面）。
2. 点输入框左侧 **「批注」**，或右键浏览器标签页 → **「批注模式」**。
3. 点选元素，填写修改说明，按需编辑属性/文本，点 **「加入批注列表」**。
4. 元素旁出现编号圆标，输入框上方出现 **页面批注** 区块。
5. 继续添加其它元素；在页内圆标或区块中编辑/删除批注。
6. 点区块里的 **「加入对话框」** 插入紧凑批注 chip；检查草稿后发送。对话中显示可展开的紧凑卡片，模型收到完整批注文本。

说明：

- 浏览器标签页菜单是**右键菜单**；内置侧栏没有「⋯」按钮。
- 点击页面外、点击应用其它位置、按 `Esc`、再点一次「批注」都可以退出批注模式。
- 修改批注后点 **「重新加入」**，并手动删除旧 chip。

## 实现概要

- 入口：`conversation.input.left`（session 作用域）和 `sidebar.right.tab.menu.item`。
- 目标页面：通过侧栏 tab 的 DOM 标记定位 Electron `<webview>`。
- 选取：用 `webview.executeJavaScript` 注入自包含脚本（closed shadow root + CSSOM + CSS 变量主题）。
- 标记层：第二个常驻脚本渲染编号圆标和弹层，把编辑/删除事件回传给应用。
- 组合：`conversation.input.dock` 卡片读取客户端 store，变更再推回标记层。
- 发送：reference source codec 把紧凑 chip 展开为完整文本；客户端 `userText` 规则把消息渲染成卡片。不新增 Host 服务、工具、路由或会话事件类型。

## 已知限制

- 仅 Desktop；Web 模式 iframe 无法批注。
- 仅 light DOM；跨域 iframe 内元素不可选，shadow DOM 元素退化为宿主。
- 批注保存在客户端内存、按浏览器 tab 区分：页面跳转/刷新或应用重启会清空。
- 圆标/区块编辑只改说明；属性/文本差异在创建批注时捕获，需删除后重新批注才能改。
- 已插入的 chip 是快照；修改后需「重新加入」并手动删除旧 chip。
- 对话中的卡片是客户端渲染；模型收到带稳定标记的完整文本。卸载插件后消息回退为原始文本。
- 侧栏私有 DOM 标记和 Electron webview API 可能随 DSH/Electron 升级变化。

## 开发

```bash
# 语法检查
node --check dsh-browser-annotation/client.js
node --check dsh-browser-annotation/index.js

# JSON 元数据
node -e "JSON.parse(require('fs').readFileSync('dsh-browser-annotation/package.json','utf8'))"

# 本地验收页（Python 3）
python dev/serve-fixture.py
# 在 DSH 内置浏览器打开 http://127.0.0.1:8123/
```

没有构建步骤：客户端是 module-loader 格式的普通 JavaScript；Host 半边是空壳。

## 隐私与安全

- 只读取被点选元素的 DOM 属性/文本和框架运行时元数据；不读取 cookie/Local Storage，不发起网络请求。
- 批注文本先进入你自己的草稿，审阅后再发送。
- 页面脚本可以读取注入的全局对象；它只是防冲突，不是针对恶意页面的安全边界。
- 请只在信任的页面上使用。

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。欢迎 Issue 和 PR；如果能提供 UI 截图/GIF 会非常有帮助。

## 许可证

[MIT](LICENSE) © 2026 Enterdada and contributors.
