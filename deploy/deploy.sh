#!/usr/bin/env bash
# deploy.sh — 一键部署：本地构建 → 同步到服务器 → 重启容器
#
# 前置：
#   - 已配置 SSH 免密（别名 code-academy，见 ~/.ssh/config）
#   - 服务器已装 Docker + docker compose
#
# 用法： bash deploy/deploy.sh

set -euo pipefail

SSH_HOST="${SSH_HOST:-code-academy}"      # SSH 别名或 user@ip
REMOTE_DIR="${REMOTE_DIR:-/opt/code-academy}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

echo "==> 1/4 本地构建"
npm run build

echo "==> 2/4 同步文件到 $SSH_HOST:$REMOTE_DIR"
ssh "$SSH_HOST" "mkdir -p $REMOTE_DIR/deploy $REMOTE_DIR/docs/.vitepress"
# 同步构建产物
rsync -az --delete docs/.vitepress/dist/ "$SSH_HOST:$REMOTE_DIR/docs/.vitepress/dist/"
# 同步部署配置
rsync -az deploy/nginx.conf deploy/docker-compose.yml "$SSH_HOST:$REMOTE_DIR/deploy/"

echo "==> 3/4 启动/重启容器"
ssh "$SSH_HOST" "cd $REMOTE_DIR && docker compose -f deploy/docker-compose.yml up -d"

echo "==> 4/4 校验"
ssh "$SSH_HOST" "curl -sI -m5 http://127.0.0.1:80 | head -1 || echo '本地 80 暂无响应，检查容器与端口'"

echo "✓ 部署完成。对外访问取决于 Cloudflare 指向服务器 80 端口。"
