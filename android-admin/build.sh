#!/bin/bash
set -euo pipefail
admin_root="$(cd "$(dirname "$0")" && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -d /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ]]; then
    export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
  else
    export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
  fi
fi
admin_output="${BYTESTORE_ADMIN_BUILD_DIR:-/private/tmp/bytestore-admin-build}"
"$admin_root/gradlew" -p "$admin_root" --project-cache-dir /private/tmp/bytestore-admin-gradle-cache "-PbyteStoreBuildDir=$admin_output" assembleDebug assembleDebugAndroidTest lintDebug
