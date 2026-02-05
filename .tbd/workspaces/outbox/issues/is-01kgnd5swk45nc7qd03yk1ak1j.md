---
created_at: 2026-02-04T22:43:10.866Z
dependencies:
  - target: is-01kgnd5tb1w9e3bt7ajvk7xkx2
    type: blocks
id: is-01kgnd5swk45nc7qd03yk1ak1j
kind: task
labels: []
parent_id: is-01kgnd5e1cf55qyz9sdta9zdn0
priority: 2
status: open
title: Update detection rules to return 'ambiguous' for conflict words
type: is
updated_at: 2026-02-05T11:11:02.470Z
version: 7
---
Modify DETECTION_RULES to return 'ambiguous' instead of 'nl' for words like 'who', 'date', 'time' when used alone
