# Copy to terraform.tfvars and adjust.
# Credentials can also come from SCW_ACCESS_KEY / SCW_SECRET_KEY env vars
# or the Scaleway configuration file (~/.scaleway/config).

project_id    = "5d10235f-8990-4b23-a8ea-93ed55afc769"
region        = "fr-par"
bucket_name   = "wip-site"
pipeline_name = "wip"

# Custom domain, or "" for the default <pipeline-id>.svc.edge.scw.cloud endpoint.
# If the domain is registered with Scaleway, the zone is adopted automatically
# and the CNAME is created by the Edge Services pipeline. For an external
# domain you must create the CNAME yourself (target: edge_endpoint output).
domain = "wip.vangkeosay.fr"

edge_services_plan = "starter"
