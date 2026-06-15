# 部署指南

把本地构建的静态站部署到服务器（Docker + nginx），并经 Cloudflare 对外。

## 架构

```
访客 ──► Cloudflare（缓存/防护/HTTPS/隐藏源站）──► 你的服务器 nginx(Docker) ──► 静态文件
```

- 访客只接触 Cloudflare，看不到源站 IP。
- 静态文件无后端、无数据库，攻击面极小。
- 后台（admin）只在服务器本地跑，不对公网开放。

## 一、首次准备

### 1. 服务器装 Docker（若未装）

```bash
# Debian/Ubuntu
curl -fsSL https://get.docker.com | sh
docker compose version   # 确认 compose 可用
```

### 2. 配置 SSH 免密（本地）

公钥已生成在 `~/.ssh/code_academy_deploy.pub`，上传到服务器：

```bash
cat ~/.ssh/code_academy_deploy.pub | ssh root@<服务器IP> \
  'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
```

本地 `~/.ssh/config` 已配别名 `code-academy`，之后 `ssh code-academy` 即可。

## 二、部署

本地一条命令：

```bash
bash deploy/deploy.sh
```

它会：本地 `npm run build` → rsync 同步 dist 与配置到 `/opt/code-academy` → 启动 nginx 容器（宿主机 **8080** 端口）。

### 端口与对外

容器默认监听宿主机 `8080`，**避开现有项目的 80/443**。对外有两种接法：

- **A. 80 空闲**：把 `deploy/docker-compose.yml` 里 `8080:80` 改成 `80:80`，Cloudflare 直接指向服务器 IP。
- **B. 已有反代**：让现有 nginx/Caddy 把笔记站子域名 `proxy_pass` 到 `127.0.0.1:8080`。

## 三、Cloudflare 配置

### 1. DNS

在 Cloudflare 加一条记录指向你的子域名（如 `notes.example.com`）：

| 类型 | 名称 | 内容 | 代理状态 |
|---|---|---|---|
| A | notes | 服务器IP | 已代理（橙色云☁️）|

**必须开橙色云**——这样才隐藏源站 IP、走 CF 缓存与防护。

### 2. SSL/TLS

- 模式选 **Full**（若源站有自签证书）或 **Flexible**（源站仅 80，最简单，先用这个）。
- 开启 **Always Use HTTPS**。

### 3. 缓存（省服务器带宽的关键）

- Caching → 缓存级别：**Standard**
- 创建缓存规则：对 `notes.example.com/*` 设 Edge Cache TTL，静态资源交给 CF 边缘缓存。

### 4. 安全防护

- **Security → WAF**：开启免费版托管规则。
- **限速规则（Rate Limiting）**：对同一 IP 高频请求做限制，防恶意刷量。
- **Bots**：开启 Bot Fight Mode（免费）。

### 5. 只允许 Cloudflare 回源（强加固，可选但推荐）

让源站只接受 Cloudflare IP 段的连接，别人直连 IP 一律拒绝。在服务器防火墙（ufw/iptables）只放行 [Cloudflare IP 段](https://www.cloudflare.com/ips/) 访问 80/443。

## 四、安全加固清单

- [ ] SSH 改密钥登录，关闭密码登录（`/etc/ssh/sshd_config` 设 `PasswordAuthentication no`）
- [ ] 服务器防火墙只放行必要端口（22 限来源 IP，80/443 限 CF 段）
- [ ] 后台 admin 不对公网开放（只本地 `127.0.0.1:4321`，远程经 SSH 隧道）
- [ ] 定期 `docker pull nginx:1.27-alpine` 更新基础镜像

## 五、后台上传（管理内容）

后台只在服务器本地运行，通过 SSH 隧道从本地浏览器访问：

```bash
# 本地开隧道
ssh -L 4321:127.0.0.1:4321 code-academy
# 服务器上启动后台（在项目目录）
ADMIN_PASSWORD=你的密码 npm run admin
# 本地浏览器开 http://127.0.0.1:4321
```

上传内容后，在后台点"重建站点"，或本地重新 `bash deploy/deploy.sh`。
