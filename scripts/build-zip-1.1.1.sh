#!/bin/bash
# Build the versioned AniKuoshi v1.1.1 source ZIP (deliverable + /download asset).
set -e
cd /home/z/my-project/work/anikuoshi

STAGE=$(mktemp -d)
NAME="anikuoshi"
VER="1.1.1"
OUT="anikuoshi-v${VER}-source.zip"

mkdir -p "$STAGE/$NAME"

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
  --exclude public/download \
  --exclude .git \
  ./ "$STAGE/$NAME/"

mkdir -p public/download
cd "$STAGE"
zip -qr "$STAGE/$OUT" "$NAME"

cd /home/z/my-project/work/anikuoshi
cp "$STAGE/$OUT" "public/download/$OUT"
cp "$STAGE/$OUT" "/home/z/my-project/download/$OUT"
echo "ZIP built:"
ls -la "public/download/$OUT" "/home/z/my-project/download/$OUT"
unzip -l "$STAGE/$OUT" | tail -3
rm -rf "$STAGE"
