#!/bin/sh
export ENVIRONMENT="local"
export PORT=8080
export CLOUD_SQL_INSTANCE_IDENTIFIER=""
export ACCESSOR_PATH="../../../data-accessor"

export SQL_DB_USERNAME="your-local-db-username"
export SQL_DB_PASSWORD="your-local-db-password"
export SQL_DB_DATABASE="your-entries-db-name"

export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="your-secret-admin-password"
export ADMIN_SESSION_EXPIRY_IN_SECONDS=2592000

export SECRET_KEY: "your-dialogflow-webhook-authorization-bearer-header-value"

