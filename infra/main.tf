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

resource "scaleway_domain_zone" "site" {
  count     = var.domain != "" ? 1 : 0
  domain    = var.domain
  subdomain = ""
}

resource "scaleway_edge_services_dns_stage" "site" {
  pipeline_id  = scaleway_edge_services_pipeline.site.id
  tls_stage_id = scaleway_edge_services_tls_stage.site.id
  fqdns        = var.domain != "" ? [var.domain] : []
  # With a Scaleway-managed domain, setting fqdns makes Scaleway
  # auto-create the CNAME pointing at the pipeline's standard
  # endpoint. Do NOT manage that CNAME with scaleway_domain_record:
  # the Edge Services pipeline owns it.
  depends_on = [scaleway_domain_zone.site]
}

resource "scaleway_edge_services_head_stage" "site" {
  pipeline_id   = scaleway_edge_services_pipeline.site.id
  head_stage_id = scaleway_edge_services_dns_stage.site.id
}
