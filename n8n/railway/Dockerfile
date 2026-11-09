# n8n for Railway with the LendLoop workflows baked in.
# Build context is the repo root (Railway: RAILWAY_DOCKERFILE_PATH=n8n/railway/Dockerfile).
FROM docker.n8n.io/n8nio/n8n:2.46.6

COPY --chown=node:node n8n/workflows /opt/lendloop/workflows
COPY --chown=node:node n8n/railway/start.sh /opt/lendloop/start.sh

EXPOSE 5678
ENTRYPOINT ["tini", "--", "/bin/sh", "/opt/lendloop/start.sh"]
