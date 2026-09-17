#!/bin/bash
# Build the AniKuoshi source ZIP (deliverable + /download page asset).
set -e
cd /home/z/my-project

STAGE=$(mktemp -d)
NAME="anikuoshi"
OUT_PUBLIC="public/anikuoshi-source.zip"
OUT_DL="download/anikuoshi-source.zip"

mkdir -p "$STAGE/$NAME"

# Copy everything except runtime/irrelevant artifacts.
rsync -a \
  --exclude node_modules \
  --exclude .next \
  --exclude .research \
  --exclude download \
  --exclude agent-ctx \
  --exclude .zscripts \
  --exclude skills \
  --exclude dev.log \
  --exclude server.log \
  --exclude tool-results \
  --exclude "*.db" \
  --exclude db/ \
  --exclude public/anikuoshi-source.zip \
  --exclude .git \
  ./ "$STAGE/$NAME/"

mkdir -p download
cd "$STAGE"
zip -qr "$STAGE/$NAME.zip" "$NAME"
cd /home/z/my-project
cp "$STAGE/$NAME.zip" "$OUT_PUBLIC"
cp "$STAGE/$NAME.zip" "$OUT_DL"
echo "ZIP built:"
ls -la "$OUT_PUBLIC" "$OUT_DL"
unzip -l "$OUT_PUBLIC" | tail -3
rm -rf "$STAGE"
