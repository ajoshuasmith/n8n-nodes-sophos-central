# Sophos Central Node for n8n

[![npm version](https://img.shields.io/npm/v/@joshuanode/n8n-nodes-sophos-central?style=flat-square)](https://www.npmjs.com/package/@joshuanode/n8n-nodes-sophos-central)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub-ajoshuasmith-181717?logo=github)](https://github.com/ajoshuasmith)
[![n8n community](https://img.shields.io/badge/n8n-community%20node-ff6d5a?style=flat-square)](https://n8n.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Community node for the **Sophos Central Firewall Management API** — built for MSPs and Organizations.

> **Note**: This node currently focuses on **Sophos Firewalls** only, as that is the hardware I have access to for development and testing. Sophos Central supports additional products (Endpoints, Email, etc.) — contributions to expand the nodes are welcome!
>
> **Region Testing**: This node has been tested with **US data regions** (`api-us01`, `api-us03`). Non-US regions should work via the dynamic region routing, but have not been verified.

---

## Features

| Feature             | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| **Multi-Tenant**    | Execute operations across all managed tenants in a single run     |
| **Dynamic Regions** | Auto-routes to correct data region (`api-us01`, `api-eu01`, etc.) |
| **Firewall Mgmt**   | List, retrieve, and monitor firewall status                       |
| **Firmware Ops**    | Check compliance, schedule upgrades, cancel pending               |
| **Alerting**        | Get alerts, acknowledge, resolve — with batch support             |
| **Health Checks**   | Retrieve connection and managing status                           |

---

## Installation

**Community Nodes (Recommended)**

1. In n8n, go to **Settings → Community Nodes → Install**
2. Enter: `@joshuanode/n8n-nodes-sophos-central`
3. Click **Install**

**Manual Installation**

```bash
npm install @joshuanode/n8n-nodes-sophos-central
```

---

## Credentials

### Partner (MSP)

For managing multiple tenant accounts:

| Field              | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| Client ID & Secret | From [Sophos Partner Portal](https://partnerportal.sophos.com/) |
| Account Type       | `Partner`                                                       |
| Tenant ID          | Leave empty                                                     |

> **Tip**: Leave the **Tenant** field empty in operations to aggregate data from **all managed tenants**.

### Organization

For managing a single account:

| Field              | Value                         |
| ------------------ | ----------------------------- |
| Client ID & Secret | From Sophos Central Admin     |
| Account Type       | `Organization`                |
| Tenant ID          | Your Tenant API ID (required) |

---

## Operations

### Firewall

| Operation    | Description                                          |
| ------------ | ---------------------------------------------------- |
| **Get**      | Retrieve a specific firewall                         |
| **Get Many** | List firewalls with filters (Name, Serial, Firmware) |

### Firmware

| Operation          | Description                                  |
| ------------------ | -------------------------------------------- |
| **Check Upgrades** | Check current version and available upgrades |
| **Upgrade**        | Schedule or trigger immediate upgrade        |
| **Cancel Upgrade** | Cancel a scheduled upgrade                   |

### Firewall Groups

| Operation           | Description                  |
| ------------------- | ---------------------------- |
| **Get**             | Retrieve a firewall group    |
| **Get Many**        | List all groups              |
| **Get Sync Status** | Check synchronization status |

### Alerts

| Operation          | Description                                        |
| ------------------ | -------------------------------------------------- |
| **Get**            | Retrieve a specific alert                          |
| **Get Many**       | List alerts with filters (Severity, Product, Date) |
| **Perform Action** | Acknowledge or Resolve (supports batch)            |

### Health

| Operation      | Description                   |
| -------------- | ----------------------------- |
| **Get Health** | Retrieve status for firewalls |

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   n8n       │ ──▶ │  This Node   │ ──▶ │  Sophos Central │
│  Workflow   │     │  (OAuth2)    │     │  API v1         │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              Token Cache    Region Cache
              (5 min TTL)    (per tenant)
```

- **Automatic Region Routing**: Caches tenant-to-region mapping
- **Token Caching**: Caches OAuth tokens for 5 minutes

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Lint
npm run lint
```

---

## License

[MIT](LICENSE)
