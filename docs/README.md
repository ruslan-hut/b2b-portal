# Documentation Index

Documentation for the B2B Portal frontend and for every API surface the
platform exposes to the outside world. Integration documents (Client API,
webhooks, chat service) are published in full — they are contracts, not
internals.

## Integration APIs

Start here if you are connecting your own system to the portal.

- **[Client API](./api/client-api.md)** — key-authenticated machine-to-machine API
  (`/api/client/v1`): catalog, quotes, orders, invoices, profile. The OpenAPI
  document is served live at `GET /api/client/v1/openapi.yaml` and rendered in
  the portal under `/api-docs`.
- **[Client API Manual (UK)](./api/client-api-manual-uk.html)** — the same contract
  as a standalone integrator manual in Ukrainian.
- **[Webhooks](./api/webhooks.md)** — outbound event delivery, signing, retries.
- **[Invoice Request](./api/invoice-request.md)** — invoice request and issue flow.
- **[Chat Service Integration](./api/chat-service-integration.md)** — external chat
  service protocol.

## Internal APIs

Consumed by the portal's own frontend and by staff tooling.

- [Authentication and Common Patterns](./api/authentication-and-common-patterns.md)
- [API Structure](./api/structure.md) — complete endpoint index
- [Frontend API](./api/frontend-api.md) — client-facing session endpoints
- [Frontend API Integration](./api/frontend-integration.md)
- [Data Management API](./api/data-management-api.md) — staff endpoints
- [Admin API](./api/admin-api.md) — admin zone endpoints

## Getting Started

- [Main README](../README.md) — project overview and setup
- [Frontend Quickstart](./getting-started/frontend-quickstart.md)
- [Frontend Local Development](./getting-started/frontend-local-development.md)
- [Frontend Overview](./architecture/frontend-overview.md)

## Development

- [Frontend Development Guide](../CLAUDE.md) — architecture and working patterns
- [Frontend Coding Policy](./development/frontend-coding-policy.md)
- [Frontend Design Policy](./development/frontend-design-policy.md) — see also the
  root [DESIGN_POLICY.md](../DESIGN_POLICY.md)
- [Frontend Build and Deployment](./development/frontend-build-deployment.md)
- [Theming Contract](./development/theming-contract.md) — `THEME` / `THEME_COLOR`,
  `src/brand/`, `branding/`
- [Translation Implementation](./development/translation-implementation.md)
- [Translation Quick Start](./development/translation-quick-start.md)
- [Mobile List Pattern](./development/mobile-list-pattern.md)
- [Mock Data](./development/mock-data.md)
- [Countries Data](./development/countries-data.md)

## Deployment

- [Deployment Overview](./deployment/overview.md)
- [Deployment Scenarios](./deployment/scenarios.md)
- [Nginx Deployment](./deployment/nginx.md)
- [Docker Deployment](./deployment/docker.md)
- [GitHub Actions Deployment](./deployment/github-actions.md)
- [GitHub Secrets](./deployment/github-secrets.md)

## Troubleshooting

- [Frontend](./troubleshooting/frontend.md)
- [Nginx](./troubleshooting/nginx.md)
- [Systemd](./troubleshooting/systemd.md)
