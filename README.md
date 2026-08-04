# Suria Tools

轻量实用、即开即用的纯前端在线工具箱。

Suria Tools 提供图片、文本、编码、开发、时间、设计、网络和 AI 辅助工具。大部分内容直接在浏览器中处理，无需账号，也不需要把业务数据上传到服务端。

## 主要特点

- 纯 HTML、CSS、JavaScript，无构建步骤
- 适合部署到 EdgeOne Pages、Cloudflare Pages、GitHub Pages 等静态平台
- 70+ 实用工具，统一的输入、处理、结果和下载体验
- 图片压缩、尺寸调整、格式转换、图标尺寸生成
- JSON、YAML、XML、SQL、Base64、URL、Unicode 等常用处理
- 二维码、正则、哈希、JWT、时间戳、日期与工作日计算
- 收藏、最近使用、搜索、分类锚点和移动端适配
- 二维码、YAML、Markdown 等依赖按需加载，不阻塞首页
- 数据优先保留在当前浏览器本地

## 使用方式

直接打开 `index.html`，或将仓库连接至静态托管平台即可。

项目无需环境变量、数据库或服务端接口。

## 项目结构

- `final.js`：核心工具注册与基础页面逻辑
- `tools-extra.js`：扩展工具集合
- `tool-quality.js`：高频工具的专项交互与逻辑优化
- `tool-experience.js`：全部工具共用的统一工作台体验
- `navigation-fix.js`：顶部、侧栏、最近使用和分类锚点
- `compression-fix.js`：批量图片压缩与体积保护逻辑
- `*.css`：基础样式、导航样式和统一工具设计系统

## 隐私说明

图片、文本和编码内容优先在当前设备的浏览器中处理。项目本身不提供账号系统、业务数据库或文件上传服务。

## 仓库

GitHub：`https://github.com/liu-suria/Suria-Tools`
