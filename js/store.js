import { emptyState, mergeStates } from "./model.js";

/* Local-first state: saved in this browser under one key. Every change goes through commit() so it is saved
   and (later) synced; entities carry their own timestamps so two devices can be merged safely. */
const KEY = "atria-v1";
let state = emptyState();
const subs = new Set();
let saveTimer = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = mergeStates(emptyState(), JSON.parse(raw));
  } catch (e) { /* private mode: run in memory */ }
  return state;
}
export const get = () => state;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

export function commit(mutator, why = "change") {
  mutator(state);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 120);
  subs.forEach(fn => fn(why));
}
export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}
addEventListener("pagehide", persist);

export function replace(next, why = "remote") {
  state = next;
  persist();
  subs.forEach(fn => fn(why));
}
export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !parsed.tasks) throw new Error("Not an Atria backup file");
  replace(mergeStates(state, parsed), "import");
}
export const exportJSON = () => JSON.stringify(state, null, 1);
export function resetAll() { state = emptyState(); persist(); subs.forEach(fn => fn("reset")); }

/* Small helpers every view uses; each stamps t so the change wins a later merge. */
export function putTask(task) { commit(s => { s.tasks[task.id] = Object.assign({}, task, { t: Date.now() }); }); }
export function patchTask(id, fields) {
  commit(s => { const t = s.tasks[id]; if (t) Object.assign(t, fields, { t: Date.now() }); });
}
export function removeTask(id) { commit(s => { const t = s.tasks[id]; if (t) s.tasks[id] = { id, del: true, rule: t.rule, rdate: t.rdate, t: Date.now() }; }); }
export function putRule(rule) { commit(s => { s.rules[rule.id] = Object.assign({}, rule, { t: Date.now() }); }); }
