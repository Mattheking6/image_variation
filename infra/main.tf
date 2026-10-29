terraform {
  required_version = ">= 1.5"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = ">= 2.30"
    }
  }
}

provider "scaleway" {
  access_key = var.access_key
  secret_key = var.secret_key
  project_id = var.project_id
  region     = var.region
}

resource "scaleway_edge_services_plan" "main" {
  name = var.edge_services_plan
}

resource "scaleway_edge_services_pipeline" "site" {
  name        = var.pipeline_name
  description = "Static website: ${var.bucket_name}"
  depends_on  = [scaleway_edge_services_plan.main]
}

resource "scaleway_object_bucket" "site" {
  name   = var.bucket_name
  region = var.region
}

# The Edge Services origin fetches this bucket anonymously, so the bucket
# must be public-read or every request is passed through as S3 403.
resource "scaleway_object_bucket_acl" "site" {
  bucket = scaleway_object_bucket.site.name
  acl    = "public-read"
}

resource "scaleway_object_bucket_website_configuration" "site" {
  bucket = scaleway_object_bucket.site.name

  index_document {
    suffix = "index.html"
  }
}

resource "scaleway_edge_services_backend_stage" "site" {
  pipeline_id = scaleway_edge_services_pipeline.site.id

  s3_backend_config {
    bucket_name   = scaleway_object_bucket.site.name
    bucket_region = var.region
    is_website    = true
  }
}

resource "scaleway_edge_services_cache_stage" "site" {
  pipeline_id      = scaleway_edge_services_pipeline.site.id
  backend_stage_id = scaleway_edge_services_backend_stage.site.id
  fallback_ttl     = 3600
}

resource "scaleway_edge_services_tls_stage" "site" {
  pipeline_id         = scaleway_edge_services_pipeline.site.id
  cache_stage_id      = scaleway_edge_services_cache_stage.site.id
  managed_certificate = true
}

resource "scaleway_edge_services_dns_stage" "site" {
  pipeline_id  = scaleway_edge_services_pipeline.site.id
  tls_stage_id = scaleway_edge_services_tls_stage.site.id
  fqdns        = var.domain != "" ? [var.domain] : []
  # DNS zone / CNAME for the domain are managed in the Scaleway console:
  # the Edge Services pipeline owns the CNAME, and root zones cannot be
  # created through the Domain API (subdomain is always required).
}

resource "scaleway_edge_services_head_stage" "site" {
  pipeline_id   = scaleway_edge_services_pipeline.site.id
  head_stage_id = scaleway_edge_services_dns_stage.site.id
}
