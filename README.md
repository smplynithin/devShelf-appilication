# DevShelf — Application & CI Pipeline

A personal developer bookmark and code-snippet manager, built as an end-to-end DevOps capstone: containerized 3-tier app, Jenkins CI pipeline with quality/security gates, and GitOps-based delivery to Kubernetes via ArgoCD.

This repo holds the **application code and the Jenkins pipeline** (build → test → scan → push). Actual Kubernetes/Helm configuration lives in a separate repo, [`devshelf-manifests`](#related-repos), by design — see below.

---

## Architecture

```
Internet
    │
    ▼ (LoadBalancer)
┌─────────────────────────────────────┐
│  Nginx + React (frontend)           │
│  Serves UI, proxies /api/* → backend│
└─────────────────┬───────────────────┘
                  │  (ClusterIP, internal)
┌─────────────────▼───────────────────┐
│  FastAPI Backend                    │
│  CRUD for bookmarks and snippets    │
│  Redis cache → PostgreSQL fallback  │
└──────────┬──────────────────┬───────┘
┌──────────▼──────┐  ┌────────▼───────┐
│  PostgreSQL     │  │  Redis         │
└─────────────────┘  └────────────────┘
```

Deployed twice, independently, in the same EKS cluster: **`devshelf-staging`** and **`devshelf-prod`** namespaces — not two separate clusters (see manifest repo README for the cost/isolation reasoning).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, served via Nginx |
| Backend | FastAPI (Python 3.12), SQLAlchemy |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Containers | Docker, multi-stage builds |
| CI | Jenkins (master + agent on separate EC2, Amazon Linux 2023) |
| Code quality | SonarQube |
| Security scanning | Trivy |
| Registry | Amazon ECR |
| CD | ArgoCD (GitOps, pull-based) |
| Infrastructure | Terraform (VPC + EKS), `terraform-aws-modules` |

---

## CI Pipeline — 12 Stages

Defined in `Jenkinsfile` at repo root. Jenkins does **build, test, scan, and push** only — it never deploys directly to the cluster or touches the Kubernetes API. Deployment is entirely ArgoCD's responsibility, triggered by a git commit this pipeline makes to the manifest repo. This split is deliberate: it means the CI system holds zero cluster credentials, minimizing blast radius if the Jenkins agent were ever compromised.

1. **Checkout** — pulls the triggering commit.
2. **Backend Test** — installs dependencies, runs `pytest`. *(Currently scaffolded only — no real test cases exist yet; this is a known gap, not a finished state. `|| true` is present so the stage doesn't hard-fail on zero collected tests while this is being built out.)*
3. **Frontend Build** — `npm install` + `npm run build`, catches JS/build errors early.
4. **Code Quality (SonarQube)** — static analysis for bugs, code smells, duplication, sent to a self-hosted SonarQube instance (Community Edition, running as a Docker container on the Jenkins agent — see known limitations below).
5. **Quality Gate** — blocks the pipeline if SonarQube's quality gate fails. Wired via a webhook back to Jenkins so this doesn't poll blindly for 5 minutes every run.
6. **Docker Build** — multi-stage builds for both backend and frontend, tagged with the short git commit SHA (not `latest` — every image is traceable to an exact commit).
7. **Security Scan (Trivy)** — scans both images for known CVEs (HIGH/CRITICAL). **Currently informational only, not a hard gate** (see known limitations).
8. **Push to ECR** — authenticates via the Jenkins agent's IAM instance role (no static AWS keys stored anywhere), pushes both images.
9. **Update Staging Manifest** — clones the `devshelf-manifests` repo, bumps the image tag in `values-staging.yaml` via `sed`, commits, pushes. This is the actual "deploy trigger" — ArgoCD picks up this commit and syncs staging automatically.
10. **Smoke Test - Staging** — a plain HTTP `curl` against the staging frontend's public LoadBalancer endpoint (`/api/health`). Deliberately **not** using `kubectl` from the agent — see [Why no kubectl on the Jenkins agent](#why-no-kubectl-on-the-jenkins-agent) below.
11. **Approval Gate - Production** — pipeline pauses, waits for a human to click "Deploy" in the Jenkins UI. 30-minute timeout auto-fails if unattended.
12. **Update Production Manifest** — same pattern as stage 9, targeting `values-production.yaml`. ArgoCD syncs production independently.

### Why no kubectl on the Jenkins agent

Early in this project the smoke test used `kubectl run` from the agent, which required granting the agent's IAM role cluster access via an EKS access entry. This was deliberately reverted: giving a CI build agent read/write access to the Kubernetes API is a larger attack surface than necessary for what a smoke test actually needs to prove. A plain HTTP request against the app's real public endpoint (through the LoadBalancer → nginx → backend, the same path a real user takes) is a *stronger* correctness signal than `kubectl get pods` (which only proves a container process is technically alive, not that the app works end-to-end) — and it needs zero cluster credentials on the CI system at all.

---

## Known Limitations (honest, not hidden)

These are deliberate, time-boxed simplifications for a capstone under deadline pressure — not oversights. Documented here rather than glossed over:

- **No real backend tests yet.** The `pytest` stage runs but collects 0 tests. Real coverage (at minimum: bookmark/snippet CRUD endpoints) is a pending task.
- **Trivy scan does not block the pipeline.** `--exit-code 1` was removed so the pipeline can proceed with 22 known vulnerabilities in the backend's base image (mostly OS-level Debian packages, a few fixable via a `starlette`/`fastapi` version bump). The frontend image scans clean (0 vulnerabilities, Alpine-based). Re-enabling the hard gate, plus a `.trivyignore` for genuinely unfixable findings, is a pending task.
- **Postgres uses `emptyDir` storage, not a real PersistentVolumeClaim.** The EBS CSI driver addon was never installed on the EKS cluster, so PVCs couldn't provision. Data does **not** survive a pod restart in the current setup. Installing the addon and reverting to real PVC-backed storage is a pending task.
- **Secrets are base64-encoded values committed directly in `values-*.yaml` files.** Base64 is encoding, not encryption — anyone with repo read access can trivially decode it. The correct production pattern (Sealed Secrets, or External Secrets Operator pulling from AWS Secrets Manager) was scoped out for time. This is acceptable for a capstone in a private repo, not for real production.
- **No ingress controller installed.** The `Ingress` resource in the Helm chart is inert — nothing is watching for it. External access currently goes through the frontend Service's own `LoadBalancer`, not a shared ingress. Adding `ingress-nginx` (and real DNS/TLS) is a pending task.

---

## Related Repos

- **[`devshelf-manifests`](https://github.com/smplynithin/devshelf-manifests.git)** — Helm chart, environment values, ArgoCD `Application` definitions. Kept separate on purpose: ArgoCD watches this repo continuously, and it should only ever change when a deployment is actually intended, not on every app code commit.

## Local Development

```bash
docker compose up --build
```
See `docker-compose.yml` for the full 4-container local dev stack (Postgres, Redis, backend, frontend + nginx).
