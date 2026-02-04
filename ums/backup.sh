#!/bin/bash
export PATH=/root/bin:$PATH

LOCAL_BACKUP_DIR="/root/lms-docker/backup/dump"
TIMESTAMP=$(date +%Y-%m-%d)
LOG_FILE="/root/lms-docker/log/db_backup.log"
# create if not exist
mkdir -p $LOCAL_BACKUP_DIR
mkdir -p /root/lms-docker/log
touch $LOG_FILE

FINAL_FILE="$LOCAL_BACKUP_DIR/$TIMESTAMP.sql.br"

pg_dump -U postgres -h localhost -d lms -Z 0 | brotli --best > "$FINAL_FILE"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "$(date): dump FAILED." >> $LOG_FILE
    exit 1
fi

find $LOCAL_BACKUP_DIR -type f -mtime +30 -name "*.br" -delete

aws --profile backblaze-b2-lms s3 cp "$FINAL_FILE" "s3://rua-lms/dump/$TIMESTAMP.sql.br"

if [ $? -ne 0 ]; then
    echo "$(date): upload FAILED." >> $LOG_FILE
    exit 1
fi

curl -fsS --retry 3 https://hc-ping.com/cqasv55yxlwxoretrhbg8w/rua-backup