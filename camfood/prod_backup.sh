#!/bin/bash
export PATH=/root/bin:$PATH

DB_URL="postgresql://nocobase:159357@postgres:5432/camfood"

INVOICE_CONDITION="invoice.done = TRUE AND "invoice".\"updatedAt\" < CURRENT_DATE - INTERVAL '1 month'"
ITEM_CONDITION="invoice_item.invoice_id IN (SELECT id FROM invoice WHERE $INVOICE_CONDITION)"
CUSTOMER_CONDITION="id in (SELECT customer_id FROM invoice WHERE $INVOICE_CONDITION)"
PRODUCT_CONDITION="id in (SELECT product_id FROM invoice_item WHERE $ITEM_CONDITION)"

# ONETIME SETUP: SET client_encoding = 'UTF8'; if on window
export_to_s3() {
    local table_name=$1
    local condition=$2
    psql $DB_URL CLIENT_ENCODING=UTF8 -c "\COPY (SELECT * FROM $table_name WHERE $condition) TO STDOUT WITH (HEADER TRUE)" | brotli | \
    aws --profile=backblaze-b2 s3 cp - "s3://nocobase/camfood/$table_name/$(date +%Y_%m_%d).csv.br"
}

export_to_s3 "invoice_item" "$ITEM_CONDITION"
export_to_s3 "invoice" "$INVOICE_CONDITION"
export_to_s3 "customer" "$CUSTOMER_CONDITION"
export_to_s3 "product" "$PRODUCT_CONDITION"

psql $DB_URL << EOF
    BEGIN;
    DELETE FROM invoice_item WHERE $ITEM_CONDITION;
    DELETE FROM invoice WHERE $INVOICE_CONDITION;
    COMMIT;
EOF