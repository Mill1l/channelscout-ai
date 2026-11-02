# 本地保存、初始化、备份与恢复

这是仅监听127.0.0.1的单用户学习系统；没有账号、团队权限或跨进程写锁，不应公开暴露。

- 首次保存自动创建 `CHANNELSCOUT_DATA_DIR`（默认项目 `.local/`）。`workspace.json`保存研究版本，`outreach.json`保存策略/邮件/跟进，版本均为1；不改变不可变的`data/*.json`。
- 两个模块共用单进程串行写队列，保存到同目录临时文件再原子rename，文件权限0600。乐观revision防止旧页面覆盖新草稿和跟进；损坏JSON报告失败，不用空状态覆盖。策略1000、邮件1000、企业500、每企业活动2000及outreach文件5MB上限；达到上限先备份后在单独数据目录继续，不自动删除历史。
- 演示需手动切换“隔离模拟演示”并初始化；研究和看板均存在 `.local/phase3-demo/`，所有活动带simulated=true，不向主工作区迁移。
- JSON/CSV业务导出是脱敏的企业与跟进报告，不是完整恢复备份；CSV防公式注入。导出仍应保密，不包含收件人邮箱或私人联系方式。

## 完整备份（先关闭本地服务）

```sh
node scripts/outreach-backup.mjs backup --dir .local --to /你的私有备份目录/channel-scout-2026-11-01 --server-stopped
```

目录必须是新的备份目录；manifest记录两个固定文件的SHA256、版本和缺失状态。不复制API Key或`.env.local`。系统无法识别任意语义敏感内容，完整私有备份保留原工作区内容，勿上传或公开分享。演示另外以`--dir .local/phase3-demo`备份，建议主/演示使用不同备份目录。

## 恢复（保持服务关闭）

```sh
node scripts/outreach-backup.mjs restore --dir .local --from /你的私有备份目录/channel-scout-2026-11-01 --server-stopped --confirm
```

先校验manifest哈希/JSON/容量，保存当前文件到 `.local/backups/before-restore-UUID/`，再逐文件原子替换。若备份缺文件而当前存在该文件，拒绝恢复，避免误删当前记录。双文件替换不是跨文件数据库事务：若中途断电，先保留所有文件，服务保持关闭，使用同一已验证备份再次恢复；恢复前副本也可按同样步骤恢复。不要同时启动多个指向同一目录的服务器；`--server-stopped`是操作者声明，不会自动停止进程。

重启前保持 `RESEARCH_PROVIDER=mock`、`ALLOW_PAID_AI=false`，打开研究/开发页面检查版本和数量。恢复旧研究时，策略/邮件指纹不匹配会提示过期，需要重新生成确认；已经人工记录的联系历史不会被自动改写。关闭标签页、刷新浏览器或重启同目录服务不会丢失已保存记录；未点保存的编辑不作保证。
