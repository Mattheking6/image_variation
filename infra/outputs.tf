output "url" {
  description = "Public URL of the site"
  value       = "https://${var.domain != "" ? var.domain : scaleway_edge_services_dns_stage.site.default_fqdn}"
}

output "edge_endpoint" {
  description = "Standard Edge Services endpoint, CNAME target for a custom domain"
  value       = scaleway_edge_services_dns_stage.site.default_fqdn
}

output "bucket_name" {
  description = "Object Storage bucket name"
  value       = scaleway_object_bucket.site.name
}

output "bucket_region" {
  description = "Object Storage bucket region"
  value       = scaleway_object_bucket.site.region
}

output "s3_endpoint" {
  description = "S3 API endpoint, e.g. for aws cli --endpoint-url"
  value       = "https://s3.${var.region}.scw.cloud"
}
