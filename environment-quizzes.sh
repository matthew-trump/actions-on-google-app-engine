#!/bin/sh
export ENVIRONMENT="local"
export PORT=8083
export CLOUD_SQL_INSTANCE_IDENTIFIER=""
export ACCESSOR_PATH="../../../data-accessor"
export CONFIG_SCHEMA_PATH="../../config-quizzes.json"

export SQL_DB_USERNAME="root"
export SQL_DB_PASSWORD="eagle1"
export SQL_DB_DATABASE="trivia_assistant_1"

export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="BjPBdMnC5qd2j55C"
export ADMIN_SESSION_EXPIRY_IN_SECONDS=2592000

export SECRET_KEY="1B24A72B14D94AFBB27D94E384FDC"
export LOADER_TIMER_INTERVAL_SECONDS=1800
export SESSION_NO_REPEAT_ENTRIES=1

export IMMERSIVE_URL="http://localhost:4206/"
export AUDIO_STORAGE_URL="https://storage.googleapis.com/hqu-alpha.appspot.com/"
#export SKIP_MEDIA_INTRO=1

