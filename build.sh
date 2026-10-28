#!/usr/bin/env bash
#
# build.sh — assemble the deployable site in dist/
#
# The site has no build step (no bundler, no transpilation): "build" here
# means staging exactly the files the browser will request — and nothing
# else — into dist/, so that deploy.sh can sync dist/ to the bucket with
# --delete and the bucket never holds docs, unused assets, or tooling.
#
# The file list below is a hard whitelist. It is derived from every
# static reference in the code (index.html, style.css, app.js, effects.js,
# constants.js). There are no dynamic asset paths (no fetch(), no
# string-built URLs), so this list is complete.
#
# Whenever you add a file the site serves, add it to the matching list
# below as well — the build fails early if a listed file is missing.
#
# Usage: ./build.sh   (also called automatically by deploy.sh)
set -euo pipefail

# Absolute paths, independent of the caller's working directory
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$ROOT/dist"

# Leaflet version vendored in leaflet/dist (gitignored — see the
# fallback download below). Bump this when you upgrade Leaflet in the repo.
LEAFLET_VERSION="1.9.4"

# Rebuild from scratch every time so dist/ can never contain leftovers
# from a previous build (e.g. an image you removed from the whitelist).
rm -rf "$DIST"
mkdir -p "$DIST"

# Copy a single file (repo-relative path) into dist/, creating parent
# directories as needed. Aborts the whole build if the source is missing,
# so a typo in the whitelist fails loudly instead of shipping a broken site.
copy() {
  local rel="$1"
  if [ ! -f "$ROOT/$rel" ]; then
    echo "error: required file not found: $rel" >&2
    exit 1
  fi
  mkdir -p "$DIST/$(dirname "$rel")"
  cp "$ROOT/$rel" "$DIST/$rel"
}

# --- Core: the app itself (referenced by <link>/<script> in index.html) ---
for f in index.html style.css app.js effects.js constants.js; do
  copy "$f"
done

# --- Leaflet (map library, loaded from leaflet/dist by index.html) -------
# leaflet/ is in .gitignore, so on a fresh clone (or CI) the directory may
# be absent: in that case fetch the pinned version from unpkg so the build
# stays reproducible without the vendored copy.
if [ ! -f "$ROOT/leaflet/dist/leaflet.js" ]; then
  echo "leaflet/dist not found, downloading Leaflet $LEAFLET_VERSION"
  mkdir -p "$ROOT/leaflet/dist/images"
  for f in leaflet.js leaflet.css; do
    curl -fsSL "https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/$f" \
      -o "$ROOT/leaflet/dist/$f"
  done
  for img in layers.png layers-2x.png marker-icon.png marker-icon-2x.png marker-shadow.png; do
    curl -fsSL "https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images/$img" \
      -o "$ROOT/leaflet/dist/images/$img"
  done
fi

# leaflet.css references url(images/...) relative to itself, so the images
# must keep the leaflet/dist/images layout inside dist/ as well. Map marker
# and layer-control icons are the only files leaflet.css can request.
copy leaflet/dist/leaflet.js
copy leaflet/dist/leaflet.css
for img in layers.png layers-2x.png marker-icon.png marker-icon-2x.png marker-shadow.png; do
  copy "leaflet/dist/images/$img"
done

# --- Puzzle images --------------------------------------------------------
# The 8 portrait photos and their 8 "psrc" puzzle images (constants.js),
# plus wip3.png (success dialog, index.html) and wip4.png (app.js).
# Files present in image/ but NOT listed here are intentionally not shipped:
# wip1.png, wip2.png, wip_cheers.gif, WIP_focus.png, coffret-*.webp.
IMAGES=(
  image/1.jpg
  image/2.png
  image/3.png
  image/4.jpg
  image/5.png
  image/6.png
  image/7.jpg
  image/8.jpg
  "image/Bébé Hortense.jpg"
  "image/Cousin Lewis.jpg"
  "image/Dame Pétunia.jpg"
  "image/Grand mère Anémone.jpg"
  "image/Grand père Cornelius.jpg"
  "image/Hannibal le Chat.jpg"
  "image/Mélusine.jpg"
  "image/Silex le chien.jpg"
  image/wip3.png
  image/wip4.png
)

for f in "${IMAGES[@]}"; do
  copy "$f"
done

# --- Summary ---------------------------------------------------------------
# Printed so deploy.sh output shows what is about to be uploaded.
count=$(find "$DIST" -type f | wc -l)
size=$(du -sh "$DIST" | cut -f1)
echo "build done: $count files, $size -> $DIST"
