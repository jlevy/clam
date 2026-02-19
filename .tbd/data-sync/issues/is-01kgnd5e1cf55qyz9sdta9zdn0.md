---
child_order_hints:
  - is-01kgnd5sdwddaaw3emn0d8zd71
  - is-01kgnd5swk45nc7qd03yk1ak1j
  - is-01kgnd5tb1w9e3bt7ajvk7xkx2
  - is-01kgnd65096v7cvhdccpbb3qc8
  - is-01kgnd65efccp6tkz48f82sm5y
  - is-01kgnd65xefm0gnj41qy3vge0j
created_at: 2026-02-04T22:42:58.731Z
dependencies: []
id: is-01kgnd5e1cf55qyz9sdta9zdn0
kind: epic
labels: []
priority: 2
status: closed
title: "Enhanced mode detection: ambiguous and nothing modes"
type: is
updated_at: 2026-02-06T01:30:44.271Z
version: 14
---
Add two new detection modes to improve UX:
1. 'ambiguous' - For words like 'who', 'date' that are both shell commands AND English
2. 'nothing' - For invalid input like typos ('gti status')

Test cases already documented in mode-detection-cases.ts (160 cases).
