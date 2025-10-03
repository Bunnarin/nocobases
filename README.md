this is for the nocobase multiapp on a single vps. to setup just migrate the .sql.tar file (which defines the app config) to the respective sub app db

apt update
apt install certbot python3-certbot-nginx docker.io nginx git

<!-- setup nginx config -->
nginx -t
systemctl reload nginx
certbot --nginx -d your_domain.com

<!-- restore the db -->
pg_restore -U nocobase -d nocobase ./path/to/your_backup_file.tar