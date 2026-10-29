#!/usr/bin/env bash
#
# deploy.sh — build, provision, and publish the static site.
#
# Steps:
#   1. build.sh  -> stage exactly the site files in dist/ (whitelist)
#   2. terraform -> idempotently create/update:
#        - Object Storage bucket + website configuration
#        - Edge Services pipeline (dns -> tls -> cache -> S3 backend)
#        - domain zone adoption + CNAME (if var.domain is set)
#   3. aws s3 sync -> upload dist/ into the bucket
#
# Requirements:
#   - terraform >= 1.5, aws (AWS CLI v2), curl
#   - a .secrets.scw file next to this script, containing exports like:
#       export SCW_ACCESS_KEY="SCWXXXXXXXXXXXXXXXX"
#       export SCW_SECRET_KEY="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
#     (the file is gitignored and must exist; it is sourced on every run)
#
# The Scaleway S3 API is used through the AWS CLI with --endpoint-url,
# so no aws config/profile is needed; credentials come from SCW keys.
#
# Usage: ./deploy.sh
#
# After a deploy, changed files may be served stale from the edge cache
# for up to fallback_ttl (3600s, see infra/main.tf); that is normal.
set -euo pipefail

# Absolute paths, independent of the caller's working directory
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA="$ROOT/infra"

# Fail early with a clear message if a required tool is missing
for cmd in terraform aws curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: '$cmd' not found in PATH" >&2
    exit 1
  fi
done

# Load Scaleway credentials (gitignored file, not committed) and export
# them so the checks below and the terraform provider can see them.
# set -a makes every variable sourced from the file exported.
set -a; source "$ROOT/.secrets.scw"; set +a;

if [ -z "${SCW_ACCESS_KEY:-}" ] || [ -z "${SCW_SECRET_KEY:-}" ]; then
  echo "error: SCW_ACCESS_KEY and SCW_SECRET_KEY must be set" >&2
  exit 1
fi

# The Scaleway object storage API is S3-compatible: reuse the same
# keypair as AWS credentials for the sync step.
export AWS_ACCESS_KEY_ID="$SCW_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$SCW_SECRET_KEY"

echo "==> build"
# Stage the deployable files in dist/; fails if a whitelisted file is absent.
bash "$ROOT/build.sh"

echo "==> terraform apply"
# -chdir keeps the state in infra/.terraform without cd'ing; -auto-approve
# runs non-interactively (CI-friendly); init is re-run on every deploy so
# the provider is present without manual setup.
terraform -chdir="$INFRA" init -input=false -no-color
terraform -chdir="$INFRA" apply -auto-approve -input=false -no-color

# Read the deployed topology back from state instead of duplicating it
# from tf vars, so the script always targets what was actually created.
BUCKET="$(terraform -chdir="$INFRA" output -raw bucket_name)"
REGION="$(terraform -chdir="$INFRA" output -raw bucket_region)"
URL="$(terraform -chdir="$INFRA" output -raw url)"
ENDPOINT="https://s3.${REGION}.scw.cloud"

echo "==> syncing dist/ to s3://${BUCKET} via ${ENDPOINT}"
# Only dist/ is synced (never the repo root), and --delete removes objects
# that exist in the bucket but not in this build, so the bucket always
# mirrors dist/ exactly. New/changed files are uploaded; unchanged ones
# (same size) are skipped.
aws s3 sync "$ROOT/dist" "s3://${BUCKET}" \
  --endpoint-url "$ENDPOINT" \
  --acl "public-read" \
  --delete

echo
echo "Done. Site is live at: $URL"
echo "Note: updated files may be served from the edge cache for up to" \
  "3600s after a deploy (fallback_ttl); wait or purge the cache in the console."
