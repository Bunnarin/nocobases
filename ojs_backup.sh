#!/bin/bash
export PATH=/root/bin:$PATH
# --- backup db ---
BACKUP_FILE="$(date +"%m-%d").sql.br"
mysqldump -u "ojs" -p "159357" --single-transaction "ojs" | brotli --best | \
   aws --profile backblaze-b2 s3 cp - "s3://rua-ojs/db_dump/${BACKUP_FILE}"

# --- sync files folder ---
aws --profile backblaze-b2 s3 sync /www/wwwroot/ojs/files s3://rua-ojs/files --exclude "temp/*"