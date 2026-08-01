# Suria Tools 扩展说明

当前站点采用稳定核心与工具注册模块分离的结构：

- `index.html`：固定页面骨架及第三方浏览器库
- `final.css`：统一视觉、桌面端和移动端布局
- `final.js`：首页、搜索、分类、收藏、最近使用、常用算法、工作台、PWA 注册及首批工具
- `tools-extra.js`：后续工具扩展模块
- `sw.js`：离线缓存清单

## 新增工具

在 `tools-extra.js` 中调用 `X()` 注册：

```js
X(
  'tool-id',
  '文本工具',
  '图标',
  '工具名称',
  '一句话说明',
  '中文 英文 搜索关键词',
  renderTool
);

function renderTool(container) {
  container.innerHTML = '<div class="panel">工具界面</div>';
}
```

注册后会自动获得：

- 分类导航
- 全局搜索
- 收藏
- 最近使用
- 我的常用
- 加入工作台
- URL 直达参数
- 手机端布局
- 深色模式

不需要修改首页、导航或本地存储逻辑。

## 发布前检查

```bash
node --check final.js
node --check tools-extra.js
```

新增静态文件时，需要同时加入 `sw.js` 的 `ASSETS` 数组并更新缓存版本号。仅新增普通工具逻辑时，修改 `tools-extra.js` 即可。