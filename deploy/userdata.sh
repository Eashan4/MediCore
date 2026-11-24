#!/bin/bash
exec > /var/log/medicore-deploy.log 2>&1
set -ex
B=medicore-deploy-REPLACE_ACCOUNT_ID
# 1GB swap: t3.micro only has 1GB RAM
fallocate -l 1G /swapfile; chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile
dnf install -y nginx docker nodejs20 nodejs20-npm awscli 2>&1 | tail -3 || dnf install -y nginx docker nodejs npm
systemctl enable --now docker
mkdir -p /opt/medicore && cd /opt/medicore
aws s3 cp s3://$B/medicore.tgz . && tar xzf medicore.tgz
DBPW=$(openssl rand -hex 12); JWT=$(openssl rand -hex 32)
docker run -d --name medicore-mysql --restart unless-stopped -e MYSQL_ROOT_PASSWORD=$DBPW -e MYSQL_DATABASE=medicore \
  -p 127.0.0.1:3306:3306 -v medicore-mysql-data:/var/lib/mysql mysql:8.0 --innodb-buffer-pool-size=128M --performance-schema=OFF
cat > backend/.env <<ENV
PORT=5000
NODE_ENV=production
CLIENT_ORIGIN=http://localhost
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=$DBPW
DB_NAME=medicore
JWT_SECRET=$JWT
JWT_EXPIRES_IN=8h
ENV
chmod 600 backend/.env
cd backend && npm ci --omit=dev
for i in $(seq 1 60); do node -e "require('mysql2/promise').createConnection({host:'127.0.0.1',user:'root',password:'$DBPW'}).then(c=>c.end())" 2>/dev/null && break; sleep 3; done
node ../database/setup.js
cat > /etc/systemd/system/medicore.service <<UNIT
[Unit]
Description=MediCore API
After=network.target docker.service
[Service]
WorkingDirectory=/opt/medicore/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/nginx/conf.d/medicore.conf <<NGX
server {
  listen 80 default_server;
  root /opt/medicore/frontend/dist;
  index index.html;
  location /api/ { proxy_pass http://127.0.0.1:5000; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; }
  location / { try_files \$uri /index.html; }
}
NGX
sed -i '/^\s*server {/,/^\s*}/{/listen/d}' /etc/nginx/nginx.conf 2>/dev/null || true
systemctl daemon-reload; systemctl enable --now medicore nginx
# nightly DB backup to S3
cat > /etc/cron.daily/medicore-backup <<CRON
#!/bin/bash
docker exec medicore-mysql mysqldump -uroot -p$DBPW medicore | gzip | aws s3 cp - s3://$B/backups/medicore-\$(date +%F).sql.gz
CRON
chmod +x /etc/cron.daily/medicore-backup
echo DEPLOY_DONE
