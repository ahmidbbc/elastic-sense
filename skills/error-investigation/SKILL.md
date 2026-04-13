---
name: error-investigation
description: Investigate application or platform errors in Elasticsearch data with a cautious, evidence-first workflow.
compatibility:
  tools: [elastic-agent-builder]
  requirements:
    - "Agent Builder mode is preferred."
    - "Legacy direct mode requires searchable error logs in Elasticsearch."
trigger_patterns:
  - "investigate error"
  - "root cause analysis"
  - "why are we getting errors"
  - "troubleshoot errors"
  - "analyze error"
---

# Error Investigation

Use this skill when the user is asking for why errors happened, when they started, or how broad the impact is.

## Preferred workflow

1. Confirm the time range, service, and index pattern if the user already hints at them.
2. Use `search` or `esql` to isolate the error pattern.
3. Group by message, service, status code, or environment only when those fields are present.
4. Compare recent data with a baseline window if the user asks for change over time.
5. End with the strongest supported hypothesis, plus the gaps that remain.

## Output expectations

- The dominant error pattern
- First observed time in the requested window
- Which services, indices, or environments are affected
- A short list of likely causes based on returned evidence
- Next checks to run when the current tools are insufficient

## Legacy direct mode

Legacy direct mode is enough for evidence gathering, but not for deep cross-system correlation. Stay honest about that limit and avoid over-claiming root cause when only log text is available.
