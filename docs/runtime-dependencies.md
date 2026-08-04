# 运行时依赖清单

Suria Tools 的第三方运行时依赖必须随仓库部署，不允许工具功能依赖 CDN。

## 已本地化

| 功能 | 依赖 | 本地路径 |
|---|---|---|
| 二维码生成 | qrcode | `vendor/qrcode.min.js` |
| 二维码识别 | jsQR | `vendor/jsQR.min.js` |
| YAML / JSON | js-yaml | `vendor/js-yaml.min.js` |
| Markdown 预览 | marked | `vendor/marked.min.js` |
| JPEG 压缩 | @jsquash/jpeg / MozJPEG WASM | `vendor/jsquash/jpeg/` |
| WebP 压缩 | @jsquash/webp / libwebp WASM | `vendor/jsquash/webp/` |
| WebAssembly 能力检测 | wasm-feature-detect | `vendor/jsquash/node_modules/wasm-feature-detect/` |

## 约束

- 页面脚本、样式、字体、图片、WASM 和工具库均使用仓库相对路径。
- 不允许新增 `jsDelivr`、`unpkg`、`esm.sh`、`cdnjs`、Google Fonts 等运行时依赖。
- 外部链接只能用于用户主动跳转，例如 GitHub 项目入口、许可证地址或工具示例文本。
- 图片、文本和编码数据不得上传到第三方服务。
