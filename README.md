# Atria

Plan your day honestly. A daily planner that assumes things take longer than you think, and learns by how much.

- **Today** — your tasks grouped by morning / afternoon / evening, next to a timeline of the day. Drag tasks onto the timeline to give them a time; drag or resize blocks to adjust.
- **Timers** — tap ▶ when you start something. Atria records how long it really took and learns a per-category "you usually take 1.4× longer" factor, then suggests realistic estimates.
- **When the day stops fitting** — it tells you and asks what should give: push the task that ran long, push a later task, or keep everything. It never moves anything on its own.
- **Repeating tasks** with streaks (daily, weekdays, or chosen days); edit or delete one occurrence or all future ones.
- **Week**, **Inbox** and **Insights** (planned vs actually tracked, per category).
- **Quick add** understands plain text: `gym 6pm 45m #health`, `study 2h tomorrow morning`, `standup 9:30am weekdays 15m #work`.
- Works offline and installs to your phone's home screen. Data is stored in your browser (sync between devices is planned).

Keyboard: `N` new task · `Ctrl/⌘ K` search · `T` today · `W` week · `I` inbox.

Static site (plain ES modules, no build step). Logic tests: `node tests/model.test.mjs`.
