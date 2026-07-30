# 安全策略

## 报告安全问题

请不要在公开 issue 中披露可被利用的漏洞、认证信息或本机敏感数据。请通过 GitHub 仓库的 Security Advisory 私下报告，并包含：

- 受影响版本；
- 可复现步骤；
- 预期影响；
- 可行的缓解建议（如有）。

## 安全边界

Kimi Code Desktop 只应连接本机 loopback 上的 Kimi Code 服务。认证 token 保留在 Electron 主进程内，不应发送给渲染进程、写入前端日志或包含在错误提示中。外部导航和新窗口默认被阻止。
