---
close_reason: Fixed empty prompt Enter to erase prompt line instead of showing duplicate prompts
closed_at: 2026-02-04T23:07:21.361Z
created_at: 2026-02-04T22:50:07.073Z
dependencies: []
id: is-01kgndjgb230wptdr0k6v086q5
kind: bug
labels: []
priority: 2
status: closed
title: Empty prompt Enter should erase prompt line, not show two blank prompts
type: is
updated_at: 2026-02-04T23:07:21.362Z
version: 3
---
When pressing Enter on an empty prompt (or whitespace-only), the prompt should be erased and just show a newline. Currently it shows two blank prompts in a row which looks messy.
