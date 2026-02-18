#!/bin/bash
export PATH=/root/bin:$PATH
# --- backup db ---
BACKUP_FILE="$(date +%Y-%m-%d).sql.br"
mysqldump -u "ojs" -p "159357" --single-transaction "ojs" | brotli --best | \
   aws --profile backblaze-b2 s3 cp - "s3://rua-backup/ojs/dump/${BACKUP_FILE}"

# --- sync files folder ---
aws --profile backblaze-b2 s3 sync /www/wwwroot/ojs/files s3://rua-backup/ojs/files --exclude "temp/*"

curl -fsS --retry 3 https://hc-ping.com/54bd6bef-296a-4287-80c2-be7f0553d643