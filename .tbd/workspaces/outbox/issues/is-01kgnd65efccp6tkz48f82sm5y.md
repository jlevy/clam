---
created_at: 2026-02-04T22:43:22.702Z
dependencies:
  - target: is-01kgnd65xefm0gnj41qy3vge0j
    type: blocks
id: is-01kgnd65efccp6tkz48f82sm5y
kind: task
labels: []
parent_id: is-01kgnd5e1cf55qyz9sdta9zdn0
priority: 2
status: open
title: Detect invalid shell-like input (nothing mode)
type: is
updated_at: 2026-02-05T11:11:02.499Z
version: 7
---
When input has shell operators but first word fails 'which', return 'nothing'. Examples: 'gti status', 'asdfas | grep'
