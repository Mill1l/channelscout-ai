# 人工 GitHub 发布步骤

建议名称：`channelscout-ai`。

建议描述：`Evidence-led overseas channel development portfolio: Chile company research, channel qualification, bilingual outreach drafts and local follow-up. Mock by default.`

本目录从 Phase 4B 已审核源码压缩包重新解压，只补充授权、发布文档与忽略规则；没有复制原始工作目录或旧 .git。已准备新的本地 `main` 分支仓库和待提交文件，但没有提交、远程或推送。原业务源码、七企业/15来源和测试与源码包一致。许可证元数据添加不改变依赖或锁文件。

## 最后检查

在本目录执行：

```sh
git status --short
git diff --cached --stat
git diff --cached --name-only
git diff --cached --check
git remote -v
```

待提交文件必须恰好匹配 `PUBLIC-FILES.txt`。不应有 `.env.local`、`.local`、node_modules、.next、私有导出或历史机器日志。当前无旧提交可继承，也不等于未来提交自动安全。阅读 LICENSE、THIRD_PARTY_NOTICES.md，特别注意企业内容未取得明确再发布许可、依赖和实体表不属于本项目 MIT 授权。

## 由作者创建并推送

以下步骤仅供作者审核后**自行执行**，交付过程没有执行：

1. 在 GitHub 新建空仓库，名称使用 `channelscout-ai` 或自选名称；由作者明确选择 Public。不要让 GitHub 自动创建 README、License 或 .gitignore，以免产生额外首提交。
2. 检查本地 Git 提交身份。不要为发布暴露私人邮箱；可使用本人 GitHub Settings → Emails 中显示的准确 noreply 地址，不要照抄他人的地址。
3. 将下面两个占位值替换为自己的公开署名和准确 noreply 地址，仓库 URL 替换成实际刚创建的空仓库。

```sh
git config --local user.name "YOUR_PUBLIC_NAME"
git config --local user.email "YOUR_GITHUB_NOREPLY_ADDRESS"
git diff --cached --check
git commit -m "Initial release: ChannelScout AI portfolio"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/channelscout-ai.git
git remote -v
git push -u origin main
```

使用 GitHub 的浏览器/凭证管理器认证，不要把 Token 写进 URL、命令、README 或环境示例。若 GitHub 推送保护提示潜在密钥，先停止并处理，不绕过检查；真实凭证泄露须撤销/轮换，删除最新文件不能清除历史。

本地已暂存文件；如作者继续改动，重新检查并逐项暂存，避免无审查的 `git add .`。首提交之前没有可扫描的提交历史，创建提交后可再次检查 `git show --stat` 和 `git log --all --oneline`。不得接入无法审查的旧历史。

官方操作参考：[将本地代码添加到 GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)。

## 面试官运行

Node.js 24.11.0、pnpm 12.16.1 为已验证组合，macOS arm64 实测。其他平台未实测。

```sh
npm install --global pnpm@12.16.1
git clone https://github.com/YOUR_USERNAME/channelscout-ai.git
cd channelscout-ai
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

打开 `http://127.0.0.1:3100/outreach`，按 README 三分钟步骤初始化隔离模拟案例。不需要 API Key；默认 Mock，真实 DeepSeek API 尚未完成系统性评测，不会因为克隆、安装或演示而要求开启付费。应用仅监听本机，不是公网部署方案。
