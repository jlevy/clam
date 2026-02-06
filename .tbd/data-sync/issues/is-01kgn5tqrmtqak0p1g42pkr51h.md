---
close_reason: null
closed_at: 2026-02-04T20:37:32.078Z
created_at: 2026-02-04T20:34:48.211Z
dependencies: []
id: is-01kgn5tqrmtqak0p1g42pkr51h
kind: bug
labels: []
parent_id: is-01kgn4svk4ry68w01kew9wevg2
priority: 2
status: closed
title: Mode detection fails for request patterns like 'can you...'
type: is
updated_at: 2026-02-06T01:30:44.258Z
version: 9
---
Phrases like 'can you give me an overview' turn white because 'overview' isn't in NL_ONLY_WORDS. Need to recognize request patterns (can you, could you, would you, etc.) as NL.
