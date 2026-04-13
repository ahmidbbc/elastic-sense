# ElasticSense Installation Guide

ElasticSense supports two modes:

- `agent_builder`: recommended and aligned with the current Elastic documentation
- `legacy_direct`: deprecated compatibility fallback based on `elastic/mcp-server-elasticsearch`

Use `legacy_direct` only if Agent Builder is not available in your environment.

## 1. Choose a mode

### Recommended: Agent Builder

Use this mode when your Kibana deployment exposes:

- `https://<kibana>/api/agent_builder/mcp`
- `https://<kibana>/s/<space>/api/agent_builder/mcp`

### Compatibility fallback: legacy direct

Use this only when you cannot rely on Agent Builder yet and are willing to run the deprecated MCP server through Docker.

## 2. Prepare credentials

### Agent Builder API key

Elastic documents these permissions for the Agent Builder MCP endpoint:

- Kibana application privilege `feature_agentBuilder.read`
- index privileges `read` and `view_index_metadata`
- cluster privilege `monitor_inference`

Helper commands:

```bash
node scripts/auth-setup.js build-url https://kibana.example.com default
node scripts/auth-setup.js print-role default "logs-*,metrics-*"
node scripts/auth-setup.js doctor https://kibana.example.com/api/agent_builder/mcp
```

Template file:

- `config/agent-builder-api-key-role.template.json`

### Legacy direct API key

For the deprecated direct mode, keep the key read-only on the target indices when your cluster requires authentication. If the cluster is reachable without HTTP auth, you can leave the API key empty for a temporary test.

Helper commands:

```bash
node scripts/auth-setup.js print-legacy-role "logs-*,metrics-*"
node scripts/auth-setup.js doctor-legacy https://elasticsearch.example.com:9200
```

Template file:

- `config/legacy-direct-api-key-role.template.json`

## 3. Validate the plugin

```bash
npm run validate
npm run test:smoke
```

This runs:

- `claude plugin validate .claude-plugin/plugin.json`
- `claude plugin validate .claude-plugin/marketplace.json`
- a local smoke test for Agent Builder mode
- a local smoke test for legacy direct mode

## 4. Install locally

```bash
claude plugin marketplace add ./
claude plugin install elastic-sense@elastic-sense-marketplace --scope local
```

For development-only loading without installing into the marketplace cache:

```bash
claude --plugin-dir .
```

Claude prompts for:

- `use_legacy_direct_mode`
- `elastic_mcp_url`
- `elastic_api_key`
- `legacy_es_url`
- `legacy_es_ssl_skip_verify`

## 5. Fill user configuration

### Agent Builder mode

Set:

- `use_legacy_direct_mode=false`
- `elastic_mcp_url=<kibana agent builder mcp url>`
- `elastic_api_key=<agent builder api key>`

Ignore:

- `legacy_es_url`
- `legacy_es_ssl_skip_verify`

### Legacy direct mode

Set:

- `use_legacy_direct_mode=true`
- `legacy_es_url=<direct elasticsearch url>`
- `elastic_api_key=<elasticsearch api key>` only if required by the cluster

Optional:

- `legacy_es_ssl_skip_verify=true` only for controlled non-production cases

Ignore:

- `elastic_mcp_url`

## 6. Runtime behavior

### Agent Builder mode

`scripts/start-mcp.js` installs `mcp-remote` into `${CLAUDE_PLUGIN_DATA}` if needed and forwards traffic to the Kibana MCP endpoint with:

- `Authorization: ApiKey <key>`

Requirements:

- Node.js 18+
- `npm` in `PATH`
- network access to the npm registry on first startup

### Legacy direct mode

`scripts/start-mcp.js` starts:

```bash
docker run -i --rm -e ES_URL [-e ES_API_KEY] docker.elastic.co/mcp/elasticsearch stdio
```

Requirements:

- Docker installed locally
- network access to pull the image on first startup

## 7. Known limitations

### Agent Builder not configured

Use `legacy_direct` only as a compatibility fallback. It is not the preferred product path.

### Legacy direct tool surface

The deprecated MCP server exposes lower-level tools than Agent Builder. Some ElasticSense skills can still guide the investigation, but their execution depth is reduced in this mode.

### TLS issues

- Agent Builder mode: set `NODE_EXTRA_CA_CERTS` before launching Claude if you need a custom CA for `mcp-remote`
- legacy direct mode: use proper cluster certificates whenever possible; only set `legacy_es_ssl_skip_verify=true` in controlled environments

## 8. Updating a local install

```bash
claude plugin update elastic-sense@elastic-sense-marketplace --scope local
```

Restart Claude Code after the update so the new plugin version is loaded.
