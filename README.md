# 🧬 ElasticSense

ElasticSense is a Claude Code plugin for Elastic workflows. It uses Elastic Agent Builder as the primary integration path and offers a deprecated `legacy_direct` fallback for environments that cannot expose the Agent Builder MCP endpoint yet.

For end users, the setup flow stays the same in both modes: install the plugin, fill the Claude `userConfig` prompts, then ask Claude for Elastic investigations in natural language. The mode only changes which backend the plugin starts behind the scenes.

## ⚙️ Modes

### Primary mode: Agent Builder

This is the recommended path for new installations.

- Connects Claude to Kibana's Agent Builder MCP endpoint
- Authenticates with an Elastic API key sent as `Authorization: ApiKey ...`
- Uses `mcp-remote` locally and stores the bridge dependency in `${CLAUDE_PLUGIN_DATA}`

### Compatibility fallback: legacy direct mode

This mode exists only for older stacks or environments where Agent Builder is not available.

- Uses the deprecated `elastic/mcp-server-elasticsearch` server
- Starts the server through `docker.elastic.co/mcp/elasticsearch`
- Connects directly to Elasticsearch with `ES_URL`, and optionally `ES_API_KEY`
- Requires Docker on the local machine

Elastic has deprecated this MCP server and recommends Agent Builder instead:

- https://github.com/elastic/mcp-server-elasticsearch
- https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/mcp-server

## 📋 Prerequisites

- Claude Code with plugin support
- Node.js 18 or newer
- For Agent Builder mode:
  - an Elastic deployment with Agent Builder enabled
  - an API key with `feature_agentBuilder.read`, `read`, `view_index_metadata`, and `monitor_inference`
- For legacy direct mode:
  - a reachable Elasticsearch cluster
  - Docker available locally
  - optionally an Elasticsearch API key with read-only access to the target indices

Reference docs:

- Anthropic plugins: https://code.claude.com/docs/fr/plugins
- Anthropic marketplaces: https://code.claude.com/docs/fr/plugin-marketplaces
- Anthropic plugin reference: https://code.claude.com/docs/fr/plugins-reference
- Elastic Agent Builder MCP server: https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/mcp-server
- Elastic Agent Builder permissions: https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/permissions
- Deprecated Elasticsearch MCP server: https://github.com/elastic/mcp-server-elasticsearch

## 🛠 Installation

### Local validation

```bash
npm run validate
npm run test:smoke
```

### Marketplace test

```bash
npm run validate
claude plugin marketplace add ./
claude plugin install elastic-sense@elastic-sense-marketplace --scope local
```

For development-only loading without installation:

```bash
claude --plugin-dir .
```

Claude asks for:

- `use_legacy_direct_mode`
- `elastic_mcp_url`
- `elastic_api_key`
- `legacy_es_url`
- `legacy_es_ssl_skip_verify`

For new installations:

- set `use_legacy_direct_mode` to `false`
- fill `elastic_mcp_url`
- fill `elastic_api_key`
- ignore legacy fields

For compatibility mode:

- set `use_legacy_direct_mode` to `true`
- fill `legacy_es_url`
- fill `elastic_api_key` only if your cluster requires it
- optionally enable `legacy_es_ssl_skip_verify`
- ignore `elastic_mcp_url`

## 👤 User setup flow

### Agent Builder flow

1. In Kibana, open Agent Builder and copy the MCP URL.
2. Create an API key with the documented Kibana + index privileges.
3. Install and enable the plugin in Claude Code.
4. Set `use_legacy_direct_mode=false`.
5. Paste the MCP URL and API key when Claude asks for `userConfig`.

### Legacy direct flow

1. Confirm Agent Builder is not available and that you are intentionally using a deprecated fallback.
2. Create a read-only Elasticsearch API key.
3. Ensure Docker is installed locally.
4. Install and enable the plugin in Claude Code.
5. Set `use_legacy_direct_mode=true`.
6. Paste the direct Elasticsearch URL.
7. Paste an API key only if your cluster requires one.

## 🎯 Use Cases

ElasticSense is most useful when Claude needs to turn raw Elastic data into a short investigation workflow rather than a single low-level query.

### 1. Cluster health overview

Use this when you want a quick operational summary of index and shard health.

Example prompt:

```text
Give me a health overview of the Elasticsearch cluster for k8s-fiaas-app-morpheus-*
```

Typical output:

- matching indices and their health state
- yellow or red indices worth investigating first
- shard allocation clues if available
- recommended next check

`legacy_direct` note:
This works well as long as index and shard data are enough. It will not magically provide rich node-level telemetry.

### 2. Investigate recent errors

Use this when a service is returning errors and you want Claude to isolate the dominant pattern quickly.

Example prompt:

```text
Investigate recent errors in logs-* for the payment service during the last hour
```

Typical output:

- main error messages or status codes
- first and last occurrence in the requested window
- affected services or environments when fields are present
- likely next step for deeper investigation

`legacy_direct` note:
This is strongest when your logs are already well structured and searchable.

### 3. Analyze logs for a service

Use this for broad exploration before going into a specific incident or root-cause analysis.

Example prompt:

```text
Analyze logs for checkout-service from today and summarize the main issues
```

Typical output:

- dominant patterns in the selected time range
- notable spikes or transitions
- representative log examples
- suggested drill-down query

`legacy_direct` note:
Prefer simple ES|QL summaries and targeted searches. Advanced correlation remains limited.

### 4. Check index or shard issues

Use this when an index is unhealthy, slow, or suspected to be misconfigured.

Example prompt:

```text
Check shard information for k8s-fiaas-app-morpheus-001789 and explain why it is yellow
```

Typical output:

- shard layout and health clues
- whether the issue looks like allocation, replication, or data-layout related
- immediate operational next steps

`legacy_direct` note:
This is one of the strongest fallback scenarios because the deprecated MCP server exposes shard and index tools directly.

## 👥 Perfect For

### SRE and platform teams

- triaging index and shard health issues
- exploring recent log anomalies
- validating whether a problem needs deeper Elastic investigation

### Application teams

- checking service-specific logs without writing DSL from scratch
- getting a first-pass explanation of recent errors
- narrowing investigation scope before involving Elastic specialists

### Non-expert users with Agent Builder access

- turning Elastic data into guided investigation steps
- getting concise summaries instead of raw query output
- using Claude as a front door to common observability questions

This audience fit is much weaker in `legacy_direct` mode, which remains a technical compatibility fallback.

## 🧰 Helper commands

Agent Builder:

```bash
node scripts/auth-setup.js build-url https://kibana.example.com default
node scripts/auth-setup.js print-role default "logs-*,metrics-*"
node scripts/auth-setup.js doctor https://kibana.example.com/api/agent_builder/mcp
```

Legacy direct:

```bash
node scripts/auth-setup.js print-legacy-role "logs-*,metrics-*"
node scripts/auth-setup.js doctor-legacy https://elasticsearch.example.com:9200
```

## 🧠 Skills and capability gaps

- `log-analysis`
- `error-investigation`
- `performance-monitoring`
- `cluster-health`

These skills remain more effective in Agent Builder mode. In `legacy_direct` mode, the available tool surface is smaller because the deprecated Elasticsearch MCP server mainly exposes low-level tools such as `list_indices`, `get_mappings`, `search`, `esql`, and `get_shards`.

That means:

- Agent Builder mode is the recommended experience
- legacy direct mode is a compatibility fallback
- some workflow outputs may become more advisory than executable in legacy mode

## 📦 Bundling model

Anthropic marketplace plugins are copied into Claude's cache, so they cannot rely on files outside the plugin root. ElasticSense uses two runtime paths:

- Agent Builder mode:
  - plugin metadata in `.claude-plugin/plugin.json`
  - MCP definition in `config/mcp.json`
  - `scripts/start-mcp.js` bootstraps `mcp-remote` into `${CLAUDE_PLUGIN_DATA}`
- legacy direct mode:
  - `scripts/start-mcp.js` starts the deprecated Docker image `docker.elastic.co/mcp/elasticsearch`
  - no separate MCP bridge install is required, but Docker must be available

## ✅ Verification

Run:

```bash
npm run validate
npm run test:smoke
```

`validate` checks manifests and required files. `test:smoke` validates both runtime branches locally:

- Agent Builder mode with a fake `mcp-remote`
- legacy direct mode with a fake `docker` executable

If you update an already installed local plugin, run:

```bash
claude plugin update elastic-sense@elastic-sense-marketplace --scope local
```

Then restart Claude Code so the new version is applied.
