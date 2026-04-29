# Zoiko sema — GCP Deployment Notes

The v3 refactor assumes the following GCP resources. Everything else
(legacy API, legacy WS) continues to run on whatever host the existing
deploy pipeline targets — the strangler-fig additions only need the
infrastructure listed here.

## Managed services

| Purpose                           | Service                                | Notes                                       |
|-----------------------------------|----------------------------------------|---------------------------------------------|
| Compute                           | GKE Autopilot                          | uvicorn pods, 2+ replicas for HA            |
| Primary DB                        | Cloud SQL for PostgreSQL 15 (HA)       | CMEK, private IP, automated backups         |
| Cache + pub/sub + presence        | Memorystore for Redis (Standard HA)    | TLS, private IP                             |
| Object storage                    | GCS bucket, CMEK                       | attachments, recordings                     |
| Image registry                    | Artifact Registry                      | replaces GHCR for private pulls             |
| Secrets                           | Secret Manager                         | `JWT_SECRET`, `DATABASE_URL`, LiveKit keys  |
| Event bus (async)                 | Pub/Sub                                | outbox dispatcher fans events out           |
| Scheduled jobs                    | Cloud Scheduler → Cloud Run job        | partition roll-forward, outbox GC           |
| Cold audit                        | BigQuery (partitioned table)           | daily export from connect_audit_events      |
| WAF                               | Cloud Armor                            | attached to Global L7 HTTPS LB              |
| Observability                     | Cloud Trace + Monitoring + Logging     | OTel sidecar                                |

## Required env vars (on top of existing .env)

```
# Redis (Memorystore private IP)
REDIS_URL=rediss://10.0.0.5:6379/0

# Media provider
MEDIA_PROVIDER=livekit            # or `null` for non-meeting envs
LIVEKIT_API_KEY=...               # from Secret Manager
LIVEKIT_API_SECRET=...            # from Secret Manager
LIVEKIT_WS_URL=wss://livekit.prod.example.com

# Tenant isolation
POSTGRES_APP_ROLE=connect_app     # role whose RLS policy reads current_setting('app.tenant_id')
```

## Database migration

Run the DDL **once** as a dedicated job (never from app startup):

```bash
psql "$DATABASE_URL" -f server/migrations/connect_v3_001_init.sql
```

On GKE, add a `kubectl apply` for a `Job` manifest that runs the above
against Cloud SQL Proxy. Application pods do NOT need to perform DDL —
remove `init_db()` from lifespan once the Connect schema is live (the
legacy `app.models.*` tables are already provisioned).

## Monthly partition roll (required)

`connect_messages`, `connect_outbox`, and `connect_audit_events` are
partitioned by month. Schedule a monthly Cloud Scheduler job that runs:

```sql
-- Create next month's partition for each table
SELECT connect_roll_partitions();   -- helper to be added
```

The bootstrap migration creates the current + next month; the scheduled
job must run before the 25th each month to stay ahead of inserts.

## WebSocket affinity

Global L7 LB → GKE Service → pod. Enable **session affinity** (`ClientIP`
or cookie-based) so a reconnecting WS client returns to the same pod
while the JWT is still valid. Redis pub/sub means cross-pod delivery
already works even without affinity; affinity just avoids the
reconnect-handshake tax.

## Outbox dispatcher

Runs as a separate Deployment (not in the request-path pods). Reads
`connect_outbox WHERE dispatched_at IS NULL ORDER BY created_at LIMIT N
FOR UPDATE SKIP LOCKED`, publishes to Pub/Sub, stamps `dispatched_at`.
To be added under `server/app/connect/ops/outbox_dispatcher.py` in a
follow-up PR.

## Existing deploy.yml compatibility

The existing `.github/workflows/deploy.yml` targets a single VM via SSH +
docker compose. That pipeline still works — adding connect_* does not
change the container entrypoint. For full GCP readiness the pipeline
needs to switch to:

1. `gcloud auth` + `gcloud artifacts docker push`
2. `gcloud run deploy` (or `kubectl set image` for GKE)
3. Cloud SQL Proxy sidecar in the pod spec
4. Migration job before rolling the deployment

That pipeline rewrite is a separate work item.

## Cloud Run Dockerfile path (common failure)

If you deploy from repository root, Cloud Run / Cloud Build will not find a
Dockerfile unless you point to the `server/` location explicitly.

Use one of these patterns:

```bash
# Option A: Deploy source directly from the server folder
gcloud run deploy zoiko-server \
	--source ./server \
	--region <REGION> \
	--allow-unauthenticated
```

```bash
# Option B: Build explicitly from the server folder, then deploy image
cd server
gcloud builds submit . \
	--tag <REGION>-docker.pkg.dev/<PROJECT_ID>/<REPO>/zoiko-server:latest

gcloud run deploy zoiko-server \
	--image <REGION>-docker.pkg.dev/<PROJECT_ID>/<REPO>/zoiko-server:latest \
	--region <REGION> \
	--allow-unauthenticated
```

`server/Dockerfile` expects its build context to include `requirements.txt`
and `app/` at the context root. If you use custom build tooling, set build
context to `server/` (or equivalent) to match that layout.
