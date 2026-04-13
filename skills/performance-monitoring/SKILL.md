---
name: performance-monitoring
description: Investigate search and indexing performance issues with a practical, tool-constrained workflow.
compatibility:
  tools: [elastic-agent-builder]
  requirements:
    - "Agent Builder mode is preferred for deeper performance analysis."
trigger_patterns:
  - "performance issues"
  - "slow queries"
  - "bottlenecks"
  - "optimize performance"
  - "elasticsearch slow"
---

# Performance Monitoring

Use this skill when the user is asking why searches are slow, why an index is hot, or whether shard layout may explain poor performance.

## Preferred workflow

1. Confirm the index or query scope.
2. Inspect shard layout and index list first.
3. Use `search` or `esql` to validate hotspots, heavy result sets, or suspicious query patterns visible in the data.
4. Separate observed facts from optimization ideas.

## What to report

- The most plausible bottleneck visible in current data
- Whether the issue looks query-related, shard-related, or data-shape-related
- Any index or shard outlier worth examining first
- Immediate low-risk next steps

## Legacy direct mode

Legacy direct mode does not expose full cluster performance telemetry by default. Keep the analysis focused on what Elasticsearch MCP can actually show, and state when JVM, node CPU, or cache-level visibility is missing.
