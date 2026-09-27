/* Atria core: pure data logic (no DOM), so it can be unit-tested with node.

   State shape (every entity carries t = last change in ms, and deletes are tombstones {del: true} so a
   future sync can merge two devices without resurrecting deleted items):
     tasks:    { id: { id, title, cat, est, day|null, part|null, at|null, done, doneAt, sessions:[{s,e}],
                       order, rule|null, rdate|null, detached, notes, t, del } }
     rules:    { id: { id, title, cat, est, part|null, at|null, freq, days:[1..7], start, end|null,
                       skip:{date:true}, t, del } }
     cats:     { id: { id, label, hue|null, order, t, del } }
     settings: { dayStart, noon, evening, dayEnd, buffer, t }
     dismissed:{ date: minutesAccepted }   "keep everything" answers to the overrun question */

export const PARTS = [["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]];
export const DEFAULT_CATS = [["study", "Study"], ["work", "Work"], ["health", "Health"], ["errands", "Errands"], ["personal", "Personal"], ["chores", "Chores"], ["other", "Other"]];
export const WD = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DEFAULT_EST = 30;

export function emptyState() {
  const cats = {};
  DEFAULT_CATS.forEach(([id, label], i) => { cats[id] = { id, label, hue: null, order: i, t: 0 }; });
  return { v: 1, tasks: {}, rules: {}, cats, settings: { dayStart: "07:00", noon: "12:00", evening: "17:00", dayEnd: "23:00", buffer: 15, t: 0 }, dismissed: {} };
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------------------------------------------------------------- dates and times (local calendar) */
export const pad = n => String(n).padStart(2, "0");
export const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const weekday = s => { const w = parse(s).getDay(); return w === 0 ? 7 : w; };        // Mon=1 .. Sun=7
export const mondayOf = s => addDays(s, -(weekday(s) - 1));
export const todayISO = (now = Date.now()) => iso(new Date(now));
export const hm = s => { if (!s) return null; const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };
export const toHM = min => { min = Math.round(min); return pad(Math.floor(min / 60) % 24) + ":" + pad(min % 60); };
export const minOfDay = (ms = Date.now()) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };

export function clock(min) {                                   // 870 -> "2:30 pm"
  min = Math.round(min);                                        // round first, or 12:59.7 shows as "12:60"
  const h = Math.floor(min / 60) % 24, m = min % 60;
  return ((h + 11) % 12 + 1) + (m ? ":" + pad(m) : "") + (h < 12 ? " am" : " pm");
}
export function dur(min) {                                     // 95 -> "1h 35m"
  min = Math.max(0, Math.round(min));
  if (min < 60) return min + "m";
  const h = Math.floor(min / 60), m = min % 60;
  return h + "h" + (m ? " " + m + "m" : "");
}
export function dayLabel(date, today) {
  const d = diffDays(today, date);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return parse(date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/* ---------------------------------------------------------------- tasks */
export const live = obj => Object.values(obj || {}).filter(x => !x.del);
export const tasksOn = (s, date) => live(s.tasks).filter(t => t.day === date);
export const inboxTasks = s => live(s.tasks).filter(t => !t.day && !t.done);

export function actualMin(task, now = Date.now()) {
  let ms = 0;
  for (const x of task.sessions || []) ms += (x.e || now) - x.s;
  return ms / 60000;
}
export const isRunning = t => !!t && !!(t.sessions || []).length && t.sessions[t.sessions.length - 1].e == null;
export const runningTask = s => live(s.tasks).find(isRunning) || null;
export const hasTime = t => (t.sessions || []).length > 0;

/* Minutes a task still needs: its estimate minus what's already been spent (a task that has run over still
   needs a little -- we can't know how much, so assume 10% more of the estimate, at least 5 minutes). */
export function remaining(task, now = Date.now()) {
  if (task.done) return 0;
  const est = task.est || DEFAULT_EST, a = actualMin(task, now);
  return a < est ? est - a : Math.max(5, est * 0.1);
}

export function makeTask(fields, now = Date.now()) {
  return Object.assign({ id: uid(), title: "Untitled", cat: "other", est: DEFAULT_EST, day: null, part: null, at: null, done: false, doneAt: null, sessions: [], order: now, rule: null, rdate: null, detached: false, notes: "", t: now }, fields, { t: now });
}

/* ---------------------------------------------------------------- recurring rules */
export function ruleOccurs(rule, date) {
  if (rule.del || date < rule.start || (rule.end && date > rule.end) || (rule.skip && rule.skip[date])) return false;
  const wd = weekday(date);
  if (rule.freq === "daily") return true;
  if (rule.freq === "weekdays") return wd <= 5;
  return (rule.days || []).includes(wd);                          // weekly / custom
}
export const occId = (ruleId, date) => "r_" + ruleId + "_" + date;

/* Occurrences are created lazily for the dates a view looks at. Ids are deterministic, so this is idempotent,
   and an occurrence that was deleted (tombstone) or moved to another day is never created again. */
export function materialize(s, from, to, now = Date.now()) {
  const out = [];
  for (const rule of live(s.rules)) {
    let d = from < rule.start ? rule.start : from;
    for (let guard = 0; d <= to && guard < 400; guard++, d = addDays(d, 1)) {
      if (!ruleOccurs(rule, d) || s.tasks[occId(rule.id, d)]) continue;
      out.push(makeTask({ id: occId(rule.id, d), title: rule.title, cat: rule.cat, est: rule.est, part: rule.part || null, at: rule.at || null, day: d, rule: rule.id, rdate: d, order: hm(rule.at || "") ?? 0 }, now));
    }
  }
  return out;
}

export function ruleText(rule) {
  const when = rule.freq === "daily" ? "Every day" : rule.freq === "weekdays" ? "Weekdays"
    : (rule.days || []).length === 7 ? "Every day" : (rule.days || []).slice().sort().map(d => WD[d]).join(", ") || "No days";
  const slot = rule.at ? " at " + clock(hm(rule.at)) : rule.part ? " · " + rule.part : "";
  return when + slot;
}

export function nextOccurrence(rule, from) {
  let d = from;
  for (let i = 0; i < 400; i++, d = addDays(d, 1)) if (ruleOccurs(rule, d)) return d;
  return null;
}

/* Consecutive scheduled occurrences completed, counting back from today (today only counts once done). */
export function streak(s, rule, today) {
  let n = 0, d = today;
  for (let i = 0; i < 400 && d >= rule.start; i++, d = addDays(d, -1)) {
    if (!ruleOccurs(rule, d)) continue;
    const t = s.tasks[occId(rule.id, d)];
    if (t && t.done) n++;
    else if (d === today) continue;
    else break;
  }
  return n;
}

export function ruleStats(s, rule, today, days = 30) {
  let due = 0, done = 0;
  for (let i = 1; i <= days; i++) {
    const d = addDays(today, -i);
    if (d < rule.start) break;
    if (!ruleOccurs(rule, d)) continue;
    due++;
    const t = s.tasks[occId(rule.id, d)];
    if (t && t.done) done++;
  }
  return { due, done };
}

/* ---------------------------------------------------------------- the day: parts, capacity, timeline */
export function windowOf(settings) {
  const st = settings || {};
  return { start: hm(st.dayStart || "07:00"), noon: hm(st.noon || "12:00"), eve: hm(st.evening || "17:00"), end: hm(st.dayEnd || "23:00") };
}
/* A task's part can be one part ("morning") or a span of adjacent parts ("morning-afternoon"),
   for work that runs from one part of the day into the next. */
export const PART_IDS = ["morning", "afternoon", "evening"];
export const spanOf = part => (part ? String(part).split("-").filter(x => PART_IDS.includes(x)) : []);
export const isSpan = part => spanOf(part).length > 1;
export function makeSpan(ids) {                                 // any set of parts -> the contiguous span covering them
  const ix = ids.map(x => PART_IDS.indexOf(x)).filter(i => i >= 0);
  if (!ix.length) return null;
  const a = Math.min(...ix), b = Math.max(...ix);
  return a === b ? PART_IDS[a] : PART_IDS[a] + "-" + PART_IDS[b];
}
export const partLabel = part => spanOf(part).map(x => x[0].toUpperCase() + x.slice(1)).join(" – ") || "Anytime";
export function partRange(settings, part) {
  const w = windowOf(settings), one = p => (p === "morning" ? [w.start, w.noon] : p === "afternoon" ? [w.noon, w.eve] : [w.eve, w.end]);
  const sp = spanOf(part);
  if (!sp.length) return [w.start, w.end];
  return [one(sp[0])[0], one(sp[sp.length - 1])[1]];
}
export function partAt(settings, min) {
  const w = windowOf(settings);
  return min < w.noon ? "morning" : min < w.eve ? "afternoon" : "evening";
}
/* Which list section a task belongs to: a fixed time wins, then its part of day, else "anytime". */
export const sectionOf = (task, settings) => (task.at ? partAt(settings, hm(task.at)) : spanOf(task.part)[0] || "anytime");

/* Time still free today (or on a future day), after keeping the buffer aside. */
export function capacity(s, date, now = Date.now()) {
  const w = windowOf(s.settings), today = todayISO(now);
  if (date < today) return 0;
  const from = date === today ? Math.max(w.start, minOfDay(now)) : w.start;
  const free = Math.max(0, w.end - from);
  return free * (1 - (s.settings.buffer ?? 15) / 100);
}
export function partCapacity(s, date, part, now = Date.now()) {
  const [a, b] = partRange(s.settings, part), today = todayISO(now);
  if (date < today) return 0;
  const from = date === today ? Math.max(a, minOfDay(now)) : a;
  return Math.max(0, b - from);
}

/* Work still to do on a day vs time left for it. over > 0 means the day no longer fits. */
export function dayLoad(s, date, now = Date.now()) {
  const list = tasksOn(s, date);
  const need = list.reduce((a, t) => a + remaining(t, now), 0);
  const planned = list.reduce((a, t) => a + (t.est || DEFAULT_EST), 0);
  const spent = list.reduce((a, t) => a + actualMin(t, now), 0);
  const cap = capacity(s, date, now);
  return { need, planned, spent, cap, over: date >= todayISO(now) ? Math.max(0, need - cap) : 0, done: list.filter(t => t.done).length, total: list.length };
}

/* Where each task sits on the day's timeline. Fixed-time tasks sit at their time; finished or running tasks sit
   where they really happened; the rest flow into the first free gap in their part of the day (starting from
   "now" today), so the picture is always a realistic forecast of the rest of the day. */
export function layoutDay(s, date, now = Date.now()) {
  const w = windowOf(s.settings), today = todayISO(now), nowMin = date === today ? minOfDay(now) : null;
  const busy = [], blocks = [];
  const put = (task, start, len, kind) => {
    const b = { task, start, end: start + Math.max(len, 10), kind, over: Math.max(0, actualMin(task, now) - (task.est || DEFAULT_EST)) };
    blocks.push(b); busy.push([b.start, b.end]);
    return b;
  };
  const list = tasksOn(s, date).sort((a, b) => (a.order || 0) - (b.order || 0));
  const sameDay = ms => todayISO(ms) === date;
  const flex = [];
  for (const t of list) {
    const a = actualMin(t, now), first = (t.sessions || [])[0];
    if (t.at) put(t, hm(t.at), t.done ? (a || t.est || DEFAULT_EST) : Math.max(t.est || DEFAULT_EST, a), isRunning(t) ? "running" : t.done ? "done" : "fixed");
    else if ((t.done || isRunning(t)) && first && sameDay(first.s)) put(t, minOfDay(first.s), isRunning(t) ? Math.max(t.est || DEFAULT_EST, a) : a, isRunning(t) ? "running" : "done");
    else if (t.done) flex.push([t, true]);
    else flex.push([t, false]);
  }
  const fits = (from, len) => {
    let x = from;
    for (let moved = true, g = 0; moved && g < 200; g++) {
      moved = false;
      for (const [a, b] of busy) if (x < b && x + len > a) { x = b; moved = true; }
    }
    return x;
  };
  const order = { morning: 0, afternoon: 1, evening: 2, anytime: 3 };
  flex.sort((x, y) => order[sectionOf(x[0], s.settings)] - order[sectionOf(y[0], s.settings)] || (x[0].order || 0) - (y[0].order || 0));
  for (const [t, done] of flex) {
    const sec = sectionOf(t, s.settings);
    let from = sec === "anytime" ? w.start : partRange(s.settings, t.part)[0];
    if (nowMin != null && !done) from = Math.max(from, Math.ceil(nowMin / 5) * 5);
    const len = done ? (actualMin(t, now) || t.est || DEFAULT_EST) : remaining(t, now);
    const b = put(t, fits(from, len), len, done ? "done" : "plan");
    if (sec !== "anytime" && b.end > partRange(s.settings, t.part)[1]) b.spill = true;
  }
  return { blocks: blocks.sort((a, b) => a.start - b.start), nowMin, win: w };
}

/* ---------------------------------------------------------------- learning how long things really take */
export function factors(s, limit = 20) {
  const by = {};
  const done = live(s.tasks).filter(t => t.done && t.est > 0 && hasTime(t)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  for (const t of done) {
    const a = actualMin(t);
    if (a < 1) continue;
    const list = by[t.cat] || (by[t.cat] = []);
    if (list.length < limit) list.push(a / t.est);
  }
  const out = {};
  for (const [cat, rs] of Object.entries(by)) {
    const r = rs.slice().sort((a, b) => a - b), mid = r.length >> 1;
    const med = r.length % 2 ? r[mid] : (r[mid - 1] + r[mid]) / 2;
    out[cat] = { f: Math.min(3, Math.max(0.5, med)), n: r.length };
  }
  return out;
}
/* A realistic estimate once there are at least 3 timed tasks in the category and the habit is clear (>= 10% off). */
export function suggest(s, cat, est, fs = factors(s)) {
  const f = fs[cat];
  if (!f || f.n < 3 || Math.abs(f.f - 1) < 0.1 || !est) return null;
  return { est: Math.max(5, Math.round(est * f.f / 5) * 5), f: f.f, n: f.n };
}

/* ---------------------------------------------------------------- quick add: "gym 6pm 45m #health" */
const DAYNAMES = { mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sun: 7, sunday: 7 };
const DAYRX = "(?:mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)";

export function parseQuick(text, s, today) {
  let t = " " + String(text || "") + " ";
  const out = { title: "", cat: null, newCat: null, est: null, day: today, part: null, at: null, repeat: null };
  const take = (rx, fn) => { const m = rx.exec(t); if (m) { fn(m); t = t.replace(m[0], " "); } return !!m; };

  // repeat first ("every mon, wed" also contains day names)
  take(new RegExp("\\s(?:every\\s*day|daily)(?=\\s)", "i"), () => { out.repeat = { freq: "daily", days: [] }; });
  take(new RegExp("\\s(?:weekdays|every\\s*weekday)(?=\\s)", "i"), () => { out.repeat = { freq: "weekdays", days: [] }; });
  take(new RegExp("\\severy\\s+(" + DAYRX + "(?:\\s*(?:,|and|&)?\\s*" + DAYRX + ")*)(?=\\s)", "i"), m => {
    const days = [...new Set(m[1].toLowerCase().match(new RegExp(DAYRX, "g")).map(d => DAYNAMES[d]))].sort();
    out.repeat = { freq: "custom", days };
  });
  take(/\s(?:weekly|every\s*week)(?=\s)/i, () => { out.repeat = { freq: "custom", days: [weekday(today)] }; });

  // category
  take(/\s#([\w-]+)(?=\s)/, m => {
    const k = m[1].toLowerCase(), cats = live(s.cats);
    const hit = cats.find(c => c.id === k || c.label.toLowerCase() === k) || cats.find(c => c.id.startsWith(k) || c.label.toLowerCase().startsWith(k));
    if (hit) out.cat = hit.id; else out.newCat = m[1];
  });
  // duration: 1h30m, 1.5h, 90m, 45 min, 2 hours
  take(/\s(\d+)\s*h(?:rs?|ours?)?\s*(\d+)\s*m(?:in(?:ute)?s?)?(?=\s)/i, m => { out.est = +m[1] * 60 + +m[2]; });
  if (out.est == null) take(/\s(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?(?=\s)/i, m => { out.est = Math.round(+m[1] * 60); });
  if (out.est == null) take(/\s(\d+)\s*m(?:in(?:ute)?s?)?(?=\s)/i, m => { out.est = +m[1]; });
  // exact time: 6pm, 6:30 pm, at 18:30, @9
  take(/\s(?:at\s+|@)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s)/i, m => {
    let h = +m[1] % 12; if (m[3].toLowerCase() === "pm") h += 12;
    out.at = pad(h) + ":" + pad(+(m[2] || 0));
  });
  if (!out.at) take(/\s(?:at\s+|@)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/i, m => { out.at = pad(+m[1]) + ":" + m[2]; });
  if (!out.at) take(/\s(?:at\s+|@)(\d{1,2})(?=\s)/i, m => { const h = +m[1]; out.at = pad(h < 7 ? h + 12 : h) + ":00"; });
  // part of day
  const P = s2 => (s2 === "tonight" || s2 === "night" ? "evening" : s2);
  take(/\s(?:all\s*day|whole\s*day)(?=\s)/i, () => { out.part = "morning-evening"; });
  take(/\s(morning|afternoon|evening|tonight|night)\s*(?:to|-|–|through|till|until|into)\s*(morning|afternoon|evening|tonight|night)(?=\s)/i, m => { out.part = makeSpan([P(m[1].toLowerCase()), P(m[2].toLowerCase())]); });
  if (!out.part) take(/\s(morning|afternoon|evening|tonight|night)(?=\s)/i, m => { out.part = P(m[1].toLowerCase()); });
  // day
  take(/\s(?:in\s*)?(inbox|someday|later)(?=\s)/i, () => { out.day = null; });
  take(/\s(today|tod)(?=\s)/i, () => { out.day = today; });
  take(/\s(tomorrow|tmrw?|tmw)(?=\s)/i, () => { out.day = addDays(today, 1); });
  take(new RegExp("\\s(?:on\\s+|next\\s+)?(" + DAYRX + ")(?=\\s)", "i"), m => {
    const want = DAYNAMES[m[1].toLowerCase()];
    let d = today;
    for (let i = 0; i < 7 && weekday(d) !== want; i++) d = addDays(d, 1);
    out.day = d;
  });
  out.title = t.replace(/\s+/g, " ").trim().replace(/^(?:at|on|for)\s+|\s+(?:at|on|for)$/gi, "") || "Untitled";
  if (out.repeat && !out.day) out.day = today;
  return out;
}

/* ---------------------------------------------------------------- merge two states (import now, sync later) */
function mergeMap(a = {}, b = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k], y = b[k];
    out[k] = !x ? y : !y ? x : ((y.t || 0) > (x.t || 0) ? y : x);
  }
  return out;
}
export function mergeStates(a, b) {
  a = a || emptyState(); b = b || emptyState();
  return {
    v: 1,
    tasks: mergeMap(a.tasks, b.tasks), rules: mergeMap(a.rules, b.rules), cats: mergeMap(a.cats, b.cats),
    settings: ((b.settings || {}).t || 0) > ((a.settings || {}).t || 0) ? b.settings : a.settings,
    dismissed: Object.assign({}, a.dismissed, b.dismissed),
  };
}
