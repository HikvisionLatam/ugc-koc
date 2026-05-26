#!/usr/bin/env bash
# scripts/deploy.sh
# Deploy de ugc-koc al servidor hikvisionlatam.tech
# Requiere: SSH key autorizada + cloudflared en PATH

set -euo pipefail

SSH_KEY=~/.ssh/claude_ed25519
SSH_HOST="marketing-digital@ssh.hikvisionlatam.tech"
SSH_PROXY='/c/cloudflare/cloudflared access ssh --hostname ssh.hikvisionlatam.tech'

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ProxyCommand=\"$SSH_PROXY\" $SSH_HOST"

echo "🚀 Deploying ugc-koc to hikvisionlatam.tech\n"

# 1. Build local
echo "📦 Construyendo admin (Next.js)..."
cd "$(dirname "$0")/.."
npm install --prefix src/admin
npm run build --prefix src/admin

echo "📦 Construyendo iframe (Vite)..."
npm install --prefix src/iframe
npm run build --prefix src/iframe

# 2. Subir archivos al servidor
echo "📤 Subiendo admin al servidor..."
$SSH_CMD "mkdir -p /home/marketing-digital/apps/ugc-koc"
scp -i $SSH_KEY \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="$SSH_PROXY" \
  -r src/admin/{.next,next.config.js,package.json,.env.local.example} \
  "$SSH_HOST:/home/marketing-digital/apps/ugc-koc/admin/" || true

echo "📤 Subiendo iframe dist al servidor..."
scp -i $SSH_KEY \
  -o StrictHostKeyChecking=no \
  -o ProxyCommand="$SSH_PROXY" \
  -r src/iframe/dist \
  "$SSH_HOST:/var/www/kocassets/ugc/iframe/" || true

# 3. Reiniciar PM2
echo "🔄 Reiniciando ugc-api en PM2..."
$SSH_CMD "cd /home/marketing-digital/apps/ugc-koc/admin && pm2 restart ugc-api || pm2 start 'npx next start -p 3000' --name ugc-api"

# 4. Verificar
echo "✅ Verificando..."
$SSH_CMD "curl -s http://localhost:3000/api/ugc/websites | head -c 100"

echo "\n🎉 Deploy completado!"
echo "   Admin: https://ugc-admin.hikvisionlatam.tech"
echo "   Iframe: https://kocassets.hikvisionlatam.tech/ugc/iframe/embed.html"