import * as store from "./store.js";
import * as M from "./model.js";

/* ---------------------------------------------------------------- timer: one task runs at a time */
export function start(id) {
  const now = Date.now();
  store.commit(s => {
    for (const t of M.live(s.tasks)) if (M.isRunning(t)) { t.sessions[t.sessions.length - 1].e = now; t.t = now; }
    const t = s.tasks[id];
    if (!t) return;
    t.sessions = (t.sessions || []).concat({ s: now, e: null });
    if (t.done) { t.done = false; t.doneAt = null; }
    t.t = now;
  });
}
export function stop(id) {
  const now = Date.now();
  store.commit(s => {
    const t = s.tasks[id];
    if (!t || !M.isRunning(t)) return;
    t.sessions[t.sessions.length - 1].e = now;
    t.t = now;
  });
}
export function complete(id) {
  const now = Date.now();
  store.commit(s => {
    const t = s.tasks[id];
    if (!t) return;
    if (M.isRunning(t)) t.sessions[t.sessions.length - 1].e = now;
    t.done = true; t.doneAt = now; t.t = now;
  });
}
export function reopen(id) { store.patchTask(id, { done: false, doneAt: null }); }

/* ---------------------------------------------------------------- moving */
export function moveTo(id, day, fields = {}) {
  store.patchTask(id, Object.assign({ day, order: Date.now() }, fields));
}
export function moveMany(ids, day) {
  const now = Date.now();
  store.commit(s => { ids.forEach((id, i) => { const t = s.tasks[id]; if (t) Object.assign(t, { day, order: now + i, t: now }); }); });
}

/* ---------------------------------------------------------------- creating from a form / quick add */
const RULE_FIELDS = ["title", "cat", "est", "part", "at"];

export function ensureCat(label) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
  const s = store.get();
  if (!s.cats[id] || s.cats[id].del) {
    const order = Math.max(0, ...M.live(s.cats).map(c => c.order || 0)) + 1;
    store.commit(x => { x.cats[id] = { id, label: label.charAt(0).toUpperCase() + label.slice(1), hue: null, order, t: Date.now() }; });
  }
  return id;
}

/* fields: { title, cat, est, day, part, at, notes, repeat: null | { freq, days } } */
export function create(fields) {
  const now = Date.now();
  if (fields.repeat) {
    const rule = { id: M.uid(), title: fields.title, cat: fields.cat, est: fields.est, part: fields.part || null, at: fields.at || null,
      freq: fields.repeat.freq, days: fields.repeat.days || [], start: fields.day || M.todayISO(now), end: null, skip: {}, t: now };
    store.putRule(rule);
    const occ = M.materialize(store.get(), rule.start, M.addDays(rule.start, 7), now);
    store.commit(s => { for (const t of occ) if (t.rule === rule.id) { t.notes = fields.notes || ""; s.tasks[t.id] = t; } });
    return { rule };
  }
  const task = M.makeTask({ title: fields.title, cat: fields.cat, est: fields.est, day: fields.day, part: fields.at ? null : fields.part || null, at: fields.at || null, notes: fields.notes || "", order: fields.at ? M.hm(fields.at) : now }, now);
  store.putTask(task);
  return { task };
}

/* Save edits to an existing task. For a repeating task, scope decides whether the change applies to this
   occurrence only (it is detached from the rule) or to the rule and every future, unfinished occurrence. */
export function update(id, fields, scope = "one") {
  const now = Date.now(), s = store.get(), t = s.tasks[id];
  if (!t) return;
  const own = Object.assign({}, fields); delete own.repeat;
  if (own.at) own.part = null;
  if (t.rule && scope === "future") {
    const rule = s.rules[t.rule];
    store.commit(x => {
      const r = x.rules[t.rule];
      for (const k of RULE_FIELDS) if (k in own) r[k] = own[k];
      if (fields.repeat) { r.freq = fields.repeat.freq; r.days = fields.repeat.days || []; }
      r.t = now;
      for (const o of M.live(x.tasks)) {
        if (o.rule !== t.rule || o.detached || o.done || (o.rdate || "") < (t.rdate || "")) continue;
        for (const k of RULE_FIELDS) if (k in own) o[k] = own[k];
        o.t = now;
      }
      Object.assign(x.tasks[id], own, { t: now });
      if (fields.repeat && rule) {
        // occurrences that no longer match the new days are dropped (only future, unfinished ones)
        const today = M.todayISO(now);
        for (const o of M.live(x.tasks)) if (o.rule === t.rule && !o.done && o.rdate >= today && !M.ruleOccurs(r, o.rdate)) x.tasks[o.id] = { id: o.id, del: true, rule: o.rule, rdate: o.rdate, t: now };
      }
    });
    return;
  }
  if (!t.rule && fields.repeat) {
    // turning a one-off task into a repeating one: the rule starts on the task's day, and this task becomes
    // that day's occurrence (same deterministic id the rule would use, so it is never created twice)
    const day = own.day || t.day || M.todayISO(now);
    const rule = { id: M.uid(), title: own.title ?? t.title, cat: own.cat ?? t.cat, est: own.est ?? t.est, part: own.part ?? t.part, at: own.at ?? t.at,
      freq: fields.repeat.freq, days: fields.repeat.days || [], start: day, end: null, skip: {}, t: now };
    store.commit(x => {
      x.rules[rule.id] = rule;
      const merged = Object.assign({}, x.tasks[id], own, { id: M.occId(rule.id, day), day, rule: rule.id, rdate: day, t: now });
      x.tasks[id] = { id, del: true, t: now };
      if (M.ruleOccurs(rule, day)) x.tasks[merged.id] = merged;
      else x.tasks[id + "_k"] = Object.assign(merged, { id: id + "_k", rule: null, rdate: null });
    });
    return;
  }
  store.patchTask(id, Object.assign(own, t.rule ? { detached: true } : {}));
}

/* Delete; for a repeating task "one" skips just this date, "future" ends the rule before this date. */
export function remove(id, scope = "one") {
  const now = Date.now(), s = store.get(), t = s.tasks[id];
  if (!t) return;
  if (!t.rule) return store.removeTask(id);
  store.commit(x => {
    const r = x.rules[t.rule];
    if (scope === "future" && r) {
      r.end = M.addDays(t.rdate, -1); r.t = now;
      if (r.end < r.start) { r.del = true; }
      for (const o of M.live(x.tasks)) if (o.rule === t.rule && o.rdate >= t.rdate && !o.done) x.tasks[o.id] = { id: o.id, del: true, rule: o.rule, rdate: o.rdate, t: now };
    } else {
      if (r) { r.skip = Object.assign({}, r.skip, { [t.rdate]: true }); r.t = now; }
      x.tasks[id] = { id, del: true, rule: t.rule, rdate: t.rdate, t: now };
    }
  });
}

export function deleteRule(ruleId) {
  const now = Date.now(), today = M.todayISO(now);
  store.commit(x => {
    const r = x.rules[ruleId]; if (!r) return;
    x.rules[ruleId] = Object.assign({}, r, { del: true, t: now });
    for (const o of M.live(x.tasks)) if (o.rule === ruleId && !o.done && o.rdate >= today) x.tasks[o.id] = { id: o.id, del: true, rule: o.rule, rdate: o.rdate, t: now };
  });
}

/* Create repeating-task occurrences for the dates a view shows (never more than ~2 months ahead). */
export function ensureRange(from, to) {
  const cap = M.addDays(M.todayISO(), 60);
  const occ = M.materialize(store.get(), from, to < cap ? to : cap);
  if (occ.length) store.commit(s => { for (const t of occ) s.tasks[t.id] = t; }, "silent");
}
