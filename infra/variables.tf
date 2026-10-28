variable "access_key" {
  description = "Scaleway access key (falls back to SCW_ACCESS_KEY env var or ~/.scaleway/config)"
  type        = string
  default     = null
  sensitive   = true
}

variable "secret_key" {
  description = "Scaleway secret key (falls back to SCW_SECRET_KEY env var or ~/.scaleway/config)"
  type        = string
  default     = null
  sensitive   = true
}

variable "project_id" {
  description = "Scaleway project ID (falls back to SCW_DEFAULT_PROJECT_ID)"
  type        = string
  default     = null
}

variable "region" {
  description = "Scaleway region for the bucket"
  type        = string
  default     = "fr-par"
}

variable "bucket_name" {
  description = "Name of the Object Storage bucket (globally unique)"
  type        = string
  default     = "image-variation-site"
}

variable "pipeline_name" {
  description = "Name of the Edge Services pipeline"
  type        = string
  default     = "image-variation"
}

variable "domain" {
  description = "Custom domain to serve (CNAME required). Empty string uses the default <pipeline-id>.svc.edge.scw.cloud endpoint"
  type        = string
  default     = ""
}

variable "edge_services_plan" {
  description = "Edge Services subscription plan (billing add-on)"
  type        = string
  default     = "starter"
}
