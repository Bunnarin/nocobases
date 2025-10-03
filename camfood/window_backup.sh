#!/bin/bash
DB_URL="postgresql://nocobase:159357@localhost:5432/camfood"

INVOICE_CONDITION="invoice.done = TRUE AND "invoice".\"test\" < CURRENT_DATE - INTERVAL '1 month'"
ITEM_CONDITION="invoice_item.invoice_id IN (SELECT id FROM invoice WHERE $INVOICE_CONDITION)"
CUSTOMER_CONDITION="id in (SELECT customer_id FROM invoice WHERE $INVOICE_CONDITION)"
PRODUCT_CONDITION="id in (SELECT product_id FROM invoice_item WHERE $ITEM_CONDITION)"

# ONETIME SETUP: SET client_encoding = 'UTF8'; if on window
export_to_s3() {
    local table_name=$1
    local condition=$2
    "/mnt/c/Program Files/PostgreSQL/17/bin/psql.exe" $DB_URL CLIENT_ENCODING=UTF8 -c "\COPY (SELECT * FROM $table_name WHERE $condition) TO STDOUT WITH (FORMAT CSV, HEADER TRUE)" | \
    "/mnt/c/Program Files/Amazon/AWSCLIV2/aws.exe" --profile=backblaze-b2 s3 cp - "s3://nocobase/camfood/$table_name/$(date +%Y_%m_%d).csv"
}

export_to_s3 "invoice_item" "$ITEM_CONDITION"
export_to_s3 "invoice" "$INVOICE_CONDITION"
export_to_s3 "customer" "$CUSTOMER_CONDITION"
export_to_s3 "product" "$PRODUCT_CONDITION"
exit 0
"/mnt/c/Program Files/PostgreSQL/17/bin/psql.exe" $DB_URL << EOF
    BEGIN;
    DELETE FROM invoice_item WHERE $ITEM_CONDITION;
    DELETE FROM invoice WHERE $INVOICE_CONDITION;
    COMMIT;
EOF