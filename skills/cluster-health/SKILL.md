---
name: cluster-health
description: Review cluster and index health using the Elastic tools exposed to Claude Code.
compatibility:
  tools: [elastic-agent-builder]
  requirements:
    - "Agent Builder mode is preferred."
    - "Legacy direct mode is limited to low-level Elasticsearch MCP tools."
trigger_patterns:
  - "cluster health"
  - "cluster status"
  - "index status"
  - "shard status"
  - "health check"
---

# Cluster Health

Use this skill when the user wants a quick but reliable health check of an Elastic environment.

## Preferred tool sequence

1. List the target indices.
2. Check shard distribution for the affected index or index pattern.
3. Inspect mappings only if the user asks for field-level explanation or query constraints.
4. Use `search` or `esql` only to confirm a symptom seen in health data.

## What to report

- Overall status of the indices examined
- Any yellow or red state and the likely operational meaning
- Shard imbalance or allocation issues when visible
- Missing information if the current tool surface cannot answer fully

## Agent Builder mode

In Agent Builder mode, use any richer health or observability tools that Kibana exposes and summarize them in operational terms.

## Legacy direct mode

In legacy direct mode, stay grounded in the tools that actually exist:

- `list_indices`
- `get_shards`
- `get_mappings`
- `search`
- `esql`

Do not claim node-level health, capacity forecasts, or remediation certainty unless the returned data supports it.
