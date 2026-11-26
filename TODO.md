# TODO: agent instructions cleanup

- Remove the 3 rules in AGENTS.md that repeat the owner's global agent rules: no em-dashes, pixel-level UI quality,
  and "tell the user at once if something unrelated looks broken".
- "Never run git commands" in AGENTS.md conflicts with the global rule (the agent may commit and push after the user
  OKs the message). Pick one and update AGENTS.md.
- "Environment facts" in AGENTS.md describe one Windows 11 + WSL2 machine. Development now also happens on native
  Ubuntu. Keep only facts true on every machine, and move per-machine facts out of this repo.
