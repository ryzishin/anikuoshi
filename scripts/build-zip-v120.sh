#!/bin/bash
# Build the AniKuoshi v1.2.0 source ZIP (deliverable + /download page asset).
set -e
SRC=/home/z/my-project/work/anikuoshi
STAGE=$(mktemp -d)
NAME="anikuoshi-v1.2.0-source"
OUT_PUBLIC="$SRC/public/download/$NAME.zip"
OUT_DL="/home/z/my-project/download/$NAME.zip"

mkdir -p "$STAGE/$NAME" "$SRC/public/download" /home/z/my-project/download

cd "$SRC"
# Bump exclusions: dev artifacts, runtime data, previously shipped zips.
rsync -a \
  --exclude node_modules \
  --exclude .next \
  --exclude .research \
  --exclude agent-ctx \
  --exclude .zscripts \
  --exclude skills \
  --exclude dev.log \
  --exclude server.log \
  --exclude "*.db" \
  --exclude db/ \
  --exclude "public/download/anikuoshi-*-source.zip" \
  --exclude .git \
  ./ "$STAGE/$NAME/"

cd "$STAGE"
zip -qr "$NAME.zip" "$NAME"

mkdir -p "$SRC/public/download" /home/z/my-project/download
cp "$NAME.zip" "$OUT_PUBLIC"
cp "$NAME.zip" "$OUT_DL"

echo "ZIP built:"
ls -la "$OUT_PUBLIC" "$OUT_DL"
unzip -l "$OUT_PUBLIC" | tail -3
unzip -l "$OUT_PUBLIC" | grep -c "player-engine\|api.ts" || true
rm -rf "$STAGE"
