# dsh-browser-annotation

在 DSH Desktop 的内置右侧浏览器中直接点选页面元素，把**精确的元素定位信息 + 批注 + 属性修改**加入当前对话；页面和输入框同步显示带编号的批注，支持修改/删除；发送后对话里渲染成紧凑卡片，模型拿到完整批注后定位源码并修改该元素。

> 状态：v1.2（Desktop / webview）。已实现：多批注编号标记、页内标记弹层编辑/删除、输入框上方批注区块编辑/删除、批注块 chip、发送后紧凑卡片、Apple 风浅/深配色、点击外部退出。

## 功能

- **入口**：对话输入框左侧「批注」按钮（桌面版常驻），或右键浏览器标签页 →「批注模式」（内置浏览器没有「⋯」按钮，标签页菜单是右键菜单）。
- **多次批注**：每次点选元素并提交后，批注进入列表，页面元素旁出现**带序号的小圆标**（1、2、3…），删除后自动重排。
- **页内标记**：
  - 点击序号圆标 → 弹出 Apple 风小卡片，显示该元素的批注说明、属性变更摘要。
  - 可直接**编辑说明并保存**，或**删除**该批注；结果实时同步到输入框上方的批注区块。
- **输入框上方批注区块**（`页面批注 · N 处`）：
  - 列出当前浏览器页面的全部批注：序号、元素、说明、属性/文本变更摘要。
  - 支持逐条**编辑说明**、**删除**、**清空**。
  - 与页内编号圆标双向同步：页内改/删会更新区块，区块改/删会更新页内标记。
  - 点「加入对话框」把当前批注集合插入为一个紧凑 **chip**；批注变更后按钮变为「重新加入」（旧 chip 需手动删除）。
- **发送后的紧凑卡片**：发送时 chip 展开为完整批注文本（含稳定标记），对话中的用户消息由客户端规则渲染成一张**可展开的紧凑卡片**（标题、数量、页面 URL；展开看完整批注）。模型拿到的仍是完整文本，不受展示层影响。
- **页内选取面板（Apple 风）**：自动浅/深色、☾/☀ 手动切换、可编辑元素属性和文本、点击页面外/`Esc` 退出。
- **退出**：点击页面外、点击应用其它位置、`Esc`、面板「取消」、再点一次「批注」按钮均可退出。

## 使用

1. 在右侧栏打开一个 http(s) 页面（建议源码在当前工作区，例如本地开发服务器）。
2. 点输入框左侧 **「批注」**（或右键浏览器标签页 →「批注模式」）。
3. 点选元素，填写说明/属性/文本；点「加入对话框」后该批注进入列表。
4. 继续点选其它元素可添加更多批注；在页内序号圆标或输入框上方区块中修改/删除。
5. 确认后点区块的 **「加入对话框」**，输入框出现批注 chip；发送后对话中显示紧凑卡片，模型拿到完整批注。

## 验证记录

- `plugin_manager install_bundle` 返回 `application: applied`，无 warnings；插件行 `include:browser-annotation` 为 `enabled / active`。
- Client 槽位均为 `browser-annotation`（active）：`conversation.input.left`（批注按钮）、`conversation.input.dock`（批注区块）、`sidebar.right.tab.menu.item`（右键菜单）、`shell.overlay`（提示）、`conversation.user.text.node` 的 key `browser-annotation`（发送后卡片渲染器）。
- 页内选取器：注入成功；合成点击后 `phase=selected`、`hasInfo=1`、`attributeList` 有 7 项；再点页面空白处 `phase=cancelled&silent=1`（点击外部退出）。
- 编号标记层：测试批注加入后 `layer=1&badges=1&markerItems=1`（编号圆标渲染成功）。
- 页内标记弹层与同步：`popover=1`；页内触发 update 事件后应用状态 `updated=1`；页内触发 delete 后 `deleted=1`（页内 ↔ 输入框区块双向同步）。
- 发送后卡片规则：`annotationTextRule` 在合并批注文本上匹配到 `browser-annotation:0-418`（用户消息会被渲染为紧凑卡片）。
- 批注 chip 通道：`conversation.input.shell(sessionId).insertReference` 返回 `true`，草稿出现 chip，序列化返回完整批注块，测试后草稿清理（`chip=1&shell=1&draftHasToken=1&serLen=10&cleaned=1`）。
- 备注：验证页面源码不在工作区，只验证“精确定位、标记、编辑/删除、入对话”；实际改源码需在源码位于当前工作区的页面上使用。
- 本次编号标记/批注区块/发送后卡片的**视觉与真实鼠标交互**需用户在真实页面确认。

## 安装与卸载

本包是 workspace 内的本地 bundle。安装：通过 `plugin_manager` 的 `install_bundle`，`target` 指向本目录绝对路径。

卸载：`plugin_manager` 的 `remove_bundle`，目标为本包名 `dsh-browser-annotation`。插件不写磁盘、不写 localStorage、不注册会话事件。

## 工作原理（实现摘要）

- 入口：`conversation.input.left` 按钮 + `sidebar.right.tab.menu.item` 右键菜单，均从标准 props 获得 `inputActions`/`sessionId`。
- 目标页面：Desktop 内置浏览器是 Electron `<webview>`；按 tabId 在应用 DOM 中定位 `webview[data-sidebar-browser-frame="webview"]`。
- 每次「批注」用 `webview.executeJavaScript` 注入自包含的选取器（closed shadow root + CSSOM + CSS 变量配色）；提交后批注进入客户端 store。
- 标记层：另一个自包含脚本按元素选择器渲染编号圆标 + 弹层；弹层内的修改/删除以事件队列方式由应用轮询同步到 store，store 变化再推回标记层。
- 输入框区块：`conversation.input.dock` React 卡片读取 store；编辑/删除直接改 store，标记层通过 store 订阅同步。
- 发送：区块把全部批注合并成带稳定标记的文本，包成 `browser-annotation` reference chip 插入草稿（失败退回文本）；发送时 codec 展开为完整文本。
- 发送后卡片：注册 `uiConversation.userText` 规则匹配稳定标记，注册 `conversation.user.text.node` key `browser-annotation` 渲染紧凑卡片；原始完整文本仍在会话日志中供模型使用。
- 不新增 Host 服务、工具、Remote、路由或会话事件类型。

## 已知限制

- 仅 Desktop（webview）。Web 模式的 iframe 受同源策略限制，入口不显示。
- 仅支持顶层文档 light DOM；页面 shadow DOM 内元素会退化为宿主元素；跨域 iframe 内元素无法点选。
- 批注集合保存在客户端内存中（按浏览器 tab 区分）：页面跳转/刷新会清空该页批注；应用重启后不会恢复。
- 页内标记弹层和输入框区块只编辑**批注说明**；要改属性/文本差异，请删除该批注后重新点选。
- 批注集合变更后，已插入的 chip 仍是旧快照；需要点「重新加入」并把旧 chip 手动删除。
- 发送后的用户消息在**模型侧**是完整文本（含 `⟦DSH-BROWSER-ANNOTATION⟧` 稳定标记）；对话中显示为客户端规则渲染的紧凑卡片；插件卸载后该消息回退为原始文本显示。
- 源码线索（React fiber / Vue 文件）来自运行时，只有开发构建才较可靠。
- 依赖内置浏览器的私有 DOM 标记定位 webview；DSH 升级后若标记变化，插件会给出明确失败提示而不是静默出错。
- 应用内错误提示使用 `shell.overlay`；右侧栏全屏时该层可能被浏览器面板遮挡，因此主要反馈都在页内。

## 安全

- 只读取被点选元素的 DOM 属性/文本和框架运行时元数据；不读取 cookie、localStorage，不发起任何网络请求。
- 页内脚本使用随机 token 区分本次注入与残留/冲突对象；它只是碰撞保护，不是对恶意页面的安全边界。

## 版本

- 目标 DSH：`>=0.2.1-rc.2 <0.3.0`（当前 Desktop 0.2.1-rc.2 / Electron 44.7.0）。
