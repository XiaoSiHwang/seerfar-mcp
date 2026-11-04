# 维护指南

面向研发与运维：文档基线同步、版本对照、验证流程。使用者请看 [README](../README.md)。

## 文档来源

以官方页面实际加载的三份 JSON 作为唯一来源：

- [接口配置](http://doc.seerfar.cn/api-docs.config.json)：请求、响应、示例和说明
- [更新记录](http://doc.seerfar.cn/api-updates.json)：上游按日期发布的变化
- [费用与频率](http://doc.seerfar.cn/api-pricing.example.json)：各接口积分和调用频率

初始基线抓取于 **2026-10-25**，页面标注版本 **v1.1**，最新更新日期 **2026-10-15**。页面版本号可能不随每次更新而变化，因此用三份数据的 SHA-256 内容哈希识别实际更新，并分别记录每个接口的请求、响应、说明及费用哈希。

## 检查官方更新

```sh
npm run api:check
```

生成 `reports/api-diff.json` 与 `reports/api-diff.md`，报告新增、删除、修改的接口及字段路径；JSON 包含修改前后的值，同时检测基础地址、公共说明、上游更新记录和定价变化。

退出码：`0` 无更新，`2` 有更新，`1` 获取或校验失败。检查不会修改当前基线。

## 采用新文档并更新基线

```sh
npm run api:sync
npm run check
```

同步会保存不可覆盖的历史快照、更新当前清单与工具 Schema，并将版本差异写入 `docs/changes/`。接口工具由快照生成，通常无需手写新接口；未支持的参数类型会阻止同步。

同步后仍需：

1. 审阅 `docs/changes/` 中的差异；
2. 验证业务兼容性；
3. 若上游改用文件上传等新请求编码，补充适配；
4. 重启 MCP 服务（运行中的服务继续使用启动时加载的快照）。

## 比较任意两个已保存版本

```sh
npm run api:diff -- <旧快照ID> <新快照ID>
```

## 离线导入或检查

将官方三份 JSON 保存为同一目录下的 `config.json`、`updates.json`、`pricing.json`，再执行：

```sh
npm run api:sync  -- --from-dir /绝对路径
npm run api:check -- --from-dir /绝对路径
```

## 文件说明

| 路径 | 内容 |
| --- | --- |
| `api/current.json` | 当前版本及每个接口的哈希 |
| `api/snapshots/` | 完整历史原文，不可覆盖 |
| `api/catalog.json` | 生成的工具 Schema |
| `docs/API_COVERAGE.md` | 面向使用者的接口清单 |
| `docs/changes/` | 每次同步产生的版本差异 |

建议将以上文件与代码一并纳入版本管理。

## 网络与安全约定

- 业务 API 默认 `https://api.seerfar.cn`，已验证可访问；优先使用同域 HTTPS。
- 文档站点 HTTPS 证书目前不匹配，同步按官方链接使用 HTTP，且不携带 API Key。
- 工具参数不能更换请求目标，不跟随上游重定向。
- HTTP 模式无状态、仅监听 `127.0.0.1`，并校验 Host 与 Origin；公网部署需自行补充反向代理鉴权与 TLS。

## 验证

```sh
npm run check
```

覆盖：全部 41 个官方请求示例与转发路径、动态 Key 隔离、鉴权/业务/限流错误、超时、版本差异，以及官方 MCP 客户端通过两版协议（2025 版与 2026-07-28 版）连接 stdio 与 HTTP。

真实账号权限、积分扣费和业务返回数据需使用有效 API Key 后另行验收。
