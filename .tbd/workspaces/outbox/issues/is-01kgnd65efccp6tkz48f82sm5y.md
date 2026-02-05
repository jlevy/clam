---
close_reason: Implemented nothing mode detection in async validation
closed_at: 2026-02-04T23:02:30.531Z
created_at: 2026-02-04T22:43:22.702Z
dependencies:
  - target: is-01kgnd65xefm0gnj41qy3vge0j
    type: blocks
id: is-01kgnd65efccp6tkz48f82sm5y
kind: task
labels: []
parent_id: is-01kgnd5e1cf55qyz9sdta9zdn0
priority: 2
status: closed
title: Detect invalid shell-like input (nothing mode)
type: is
updated_at: 2026-02-04T23:02:30.532Z
version: 4
---
When input has shell operators but first word fails 'which', return 'nothing'. Examples: 'gti status', 'asdfas | grep'
