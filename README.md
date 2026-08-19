# Hexo Markdown

跨平台 Electron 桌面应用，用于编写 Hexo 博客：左侧编辑、右侧实时预览；粘贴或拖入图片会自动上传到 **Cloudflare R2**，并插入公开 URL。

支持 **Windows / macOS / Linux**。

## 功能

- 实时渲染 GFM（表格、任务列表、代码高亮）
- 识别常见 Hexo 标签：`asset_img`、`img`、`blockquote`、`codeblock`、`raw`
- 读取 / 新建 / 保存 / 删除 `source/_posts` 与 `source/_drafts`
- 系统菜单：`Ctrl/Cmd+S` 保存，`Ctrl/Cmd+N` 新建，`Ctrl/Cmd+,` 设置
- 设置里可用系统对话框选择 Hexo 根目录
- 粘贴、拖放、工具栏选图 → 上传 R2
- 未配置 R2 时，回退到当前文章资源目录（`post.md` → `post/image.png`）
- **SFTP**：从远程服务器拉取 / 推送 `source/_posts`、`source/_drafts` 中的 Markdown 及文章资源目录
- **SSH**：在远程博客目录执行 `hexo generate` / `hexo deploy`

## 准备 Cloudflare R2

1. 在 Cloudflare 控制台创建 R2 存储桶。
2. 开启公开访问：绑定自定义域名，或使用 `r2.dev` 公开子域。
3. 创建 **R2 API Token**（Object Read & Write），记下 Account ID、Access Key、Secret、Bucket、公开 URL（不要末尾斜杠）。

## 远程 SSH / SFTP

博客如果在服务器上，可在 **设置 → SSH / SFTP** 填写：

- 主机、端口、用户名
- 密码，或私钥文件（可再填私钥口令）
- 远程 Hexo 根目录，例如 `/home/ubuntu/blog`（必须是绝对路径）
- 生成 / 部署命令，默认 `npx hexo generate` 与 `npx hexo deploy`

然后使用工具栏或菜单 **远程**：

1. 连接 SSH
2. **拉取**：把服务器上的文章下载到本地 Hexo 目录
3. 本地编辑；可选「保存后自动上传」
4. **推送当前 / 全部**：把 Markdown 和同名资源目录上传回服务器
5. **生成 / 部署 / 生成并部署**：在服务器上 `cd` 到博客目录后执行命令

命令通过 `bash -lc` 运行，并会先执行「登录初始化」（默认尝试 `nvm` / `.bashrc`），以便找到 `node` 和 `hexo`。输出在底部远程日志里。

快捷键：`Ctrl/Cmd+Shift+U` 推送当前文章，`Ctrl/Cmd+Shift+D` 生成并部署。

## 开发

需要 Node.js 18+。

```bash
npm install
npm run dev
```

会同时启动 Vite 和 Electron 窗口。在应用 **设置** 里填写本地 Hexo 根目录、R2 和 SSH。

配置保存在系统用户目录，不会进 git：

- Windows: `%APPDATA%\hexo-markdown\data\config.json`
- macOS: `~/Library/Application Support/Hexo Markdown/data/config.json`
- Linux: `~/.config/hexo-markdown/data/config.json`

项目根目录的 `.env` 可作为初始默认值，见 `.env.example`。

## 打包

```bash
# 当前系统安装包
npm run dist

# 指定平台
npm run dist:win
npm run dist:mac
npm run dist:linux
```

产物在 `release/`：

- Windows: NSIS 安装包
- macOS: DMG
- Linux: AppImage

跨平台打包通常要在对应系统上执行（例如在 macOS 上打 dmg）。GitHub Actions 会在每次推送 `main` 时自动编译三个平台，打 `v*` 标签时还会发布 Release。

## GitHub 自动编译

推送到 `main` 或提交 Pull Request 后，[Build](.github/workflows/build.yml) 会在 Windows / macOS / Linux 上分别打包：

- Windows: NSIS 安装包
- macOS: DMG（未签名）
- Linux: AppImage

产物出现在仓库 **Actions** 对应运行的 Artifacts 里。

发布安装包到 GitHub Releases：

```bash
git tag v1.0.1
git push origin v1.0.1
```

## 使用提示

- Hexo 根目录需包含 `_config.yml` 与 `source/_posts`
- 粘贴截图后会先插入占位图，上传成功再替换为 R2 URL
- 预览里的相对路径图片按 Hexo 文章资源目录解析
- 预览中的外链会用系统默认浏览器打开
