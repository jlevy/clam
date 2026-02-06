---
created_at: 2026-02-04T22:50:07.073Z
dependencies: []
id: is-01kgndjgb230wptdr0k6v086q5
kind: bug
labels: []
priority: 2
status: open
title: Empty prompt Enter should erase prompt line, not show two blank prompts
type: is
updated_at: 2026-02-06T01:30:44.312Z
version: 8
---
When pressing Enter on an empty prompt (or whitespace-only), the prompt should be erased and just show a newline. Currently it shows two blank prompts in a row which looks messy.
