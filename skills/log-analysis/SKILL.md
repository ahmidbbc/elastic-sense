---
name: log-analysis
description: Analyze Elasticsearch log data with concise summaries, clear filters, and practical follow-up steps.
compatibility:
  tools: [elastic-agent-builder]
  requirements:
    - "The selected Elastic environment must expose relevant indices or log tools."
trigger_patterns:
  - "analyze logs"
  - "log analysis"
  - "what happened in the logs"
  - "show error trends"
  - "recent logs"
---

# Log Analysis

Use this skill for broad log exploration before narrowing to a deeper investigation.

## Preferred workflow

1. Identify the likely index pattern and time range.
2. Use `esql` for quick summaries when possible.
3. Use `search` when the user needs raw examples or DSL filters.
4. Highlight only the dominant patterns, not every message variant.
5. Suggest the next drill-down if the result points to a specific service or failure mode.

## Good outputs

- Volume over the requested window
- Main services or components represented
- Dominant warning or error patterns
- A short timeline of spikes or notable transitions
- One or two concrete next actions

## Legacy direct mode

Prefer simple ES|QL and targeted searches. Avoid promising advanced correlation, anomaly detection, or automated impact scoring unless the environment already exposes those capabilities through Agent Builder.
