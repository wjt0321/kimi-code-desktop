# 参与贡献

感谢你改进 Kimi Code Desktop。

## 开发流程

1. Fork 本仓库并从 `main` 创建功能分支。
2. 使用 Node.js 24.11.1 或更高版本、pnpm 10.33.0 安装依赖。
3. 保持桌面端与上游 Kimi Code 源码解耦，不要复制上游运行时代码或提交认证信息。
4. 界面文案优先使用中文；代码、类型和提交信息使用清晰的英文。
5. 提交前运行：

   ```powershell
   pnpm typecheck
   pnpm test
   pnpm exec electron-vite build
   ```

6. 提交信息使用 Conventional Commits，例如 `fix: keep composer visible on small windows`。

## 设计原则

- Windows 优先，同时避免无必要的平台锁定。
- CLI 是能力来源，桌面端不改变 CLI 的行为语义。
- 明确呈现运行、等待、审批、失败和完成状态。
- 新功能应优先复用现有本地服务契约，并在主进程与渲染进程边界进行输入校验。
- 不在 issue、测试数据或截图中提交 token、真实私有路径和其他敏感信息。
