import * as store from "./store.js";
import * as M from "./model.js";
import * as A from "./actions.js";
import { esc, $, $$ } from "./util.js";
import { icon, hue } from "./ui.js";

/* ---------------------------------------------------------------- generic modal */
export function modal(html, { cls = "", onClose } = {}) {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = '<div class="modal ' + cls + '" role="dialog">' + html + "</div>";
  document.body.appendChild(bg);
  const onKey = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    document.removeEventListener("keydown", onKey, true);
    bg.classList.add("out");
    setTimeout(() => bg.remove(), 180);
    if (onClose) onClose();
  };
  document.addEventListener("keydown", onKey, true);
  bg.addEventListener("mousedown", e => { if (e.target === bg) close(); });
  $$("[data-close]", bg).forEach(b => b.onclick = close);
  return { el: bg, close };
}

/* Pick one of a few options; resolves with the chosen value (or null). */
export function choose(title, text, options) {
  return new Promise(res => {
    let picked = null;
    const m = modal('<div class="modal-h"><div><h3>' + esc(title) + '</h3>' + (text ? '<p class="small muted">' + esc(text) + "</p>" : "") + "</div></div>" +
      '<div class="choice">' + options.map((o, i) => '<button class="btn ' + (o.cls || "") + '" data-i="' + i + '">' + esc(o.label) + "</button>").join("") + '<button class="btn ghost" data-close>Cancel</button></div>',
      { cls: "sm", onClose: () => res(picked) });
    $$("[data-i]", m.el).forEach(b => b.onclick = () => { picked = options[+b.dataset.i].value; m.close(); });
  });
}

export const catChip = (s, id) => {
  const c = s.cats[id] || { label: id };
  return '<span class="cchip hued" style="--h:' + (c.hue ?? hue(id)) + '">' + esc(c.label) + "</span>";
};

/* ---------------------------------------------------------------- the task editor */
const EST = [15, 30, 45, 60, 90, 120, 180, 240];
/* "150", "2.5h", "3h 30m", "3h30", "45m" -> minutes (null if unreadable) */
export function parseLen(v) {
  const t = String(v || "").trim().toLowerCase().replace(/\s+/g, "");
  let m;
  if ((m = /^(\d+(?:\.\d+)?)$/.exec(t))) return Math.round(+m[1]);
  if ((m = /^(\d+(?:\.\d+)?)h(?:rs?|ours?)?(?:(\d+)m?(?:in(?:ute)?s?)?)?$/.exec(t))) return Math.round(+m[1] * 60 + +(m[2] || 0));
  if ((m = /^(\d+)m(?:in(?:ute)?s?)?$/.exec(t))) return +m[1];
  return null;
}
const REPEATS = [["none", "Doesn't repeat"], ["daily", "Every day"], ["weekdays", "Weekdays"], ["custom", "Custom days"]];

/* opts: { task } to edit, or { rule } to edit a repeating task's rule, or { defaults } for a new task */
export function openTask(ctx, opts = {}) {
  const s = store.get(), today = M.todayISO();
  const task = opts.task ? s.tasks[opts.task] : null;
  const rule = opts.rule ? s.rules[opts.rule] : task && task.rule ? s.rules[task.rule] : null;
  const ruleMode = !!opts.rule;
  const src = ruleMode ? rule : task || {};
  const f = {
    title: src.title || (opts.defaults || {}).title || "",
    cat: src.cat || (opts.defaults || {}).cat || "other",
    est: src.est || (opts.defaults || {}).est || M.DEFAULT_EST,
    day: ruleMode ? null : task ? task.day : ((opts.defaults || {}).day !== undefined ? opts.defaults.day : today),
    part: src.part || (opts.defaults || {}).part || null,
    at: src.at || (opts.defaults || {}).at || null,
    notes: (task && task.notes) || (opts.defaults || {}).notes || "",
    repeat: rule ? { freq: rule.freq, days: (rule.days || []).slice() } : (opts.defaults || {}).repeat || null,
  };
  const when = () => (f.at ? "at" : f.part || "anytime");
  let scope = ruleMode ? "future" : "one";
  const cats = M.live(s.cats).sort((a, b) => (a.order || 0) - (b.order || 0));
  const fs = M.factors(s);

  const draw = () => {
    const sug = M.suggest(s, f.cat, f.est, fs);
    const tracked = task ? M.actualMin(task) : 0;
    const rep = f.repeat ? f.repeat.freq : "none";
    return '<div class="modal-h"><div><h3>' + (ruleMode ? "Repeating task" : task ? "Edit task" : "New task") + "</h3>" +
      (rule ? '<p class="small muted">' + icon("repeat", 12) + " " + esc(M.ruleText(rule)) + "</p>" : "") + '</div><button class="iconbtn" data-close aria-label="Close">' + icon("close", 18) + "</button></div>" +
      '<input class="tinput" id="f-title" placeholder="What needs doing?" value="' + esc(f.title) + '" autocomplete="off">' +
      '<label class="field-l">Category</label><div class="chips" id="f-cat">' + cats.map(c => '<button class="chip cat hued' + (c.id === f.cat ? " on" : "") + '" data-v="' + c.id + '" style="--h:' + (c.hue ?? hue(c.id)) + '"><i></i>' + esc(c.label) + "</button>").join("") + "</div>" +
      '<label class="field-l">How long</label><div class="chips" id="f-est">' + EST.map(m => '<button class="chip' + (m === f.est ? " on" : "") + '" data-v="' + m + '">' + M.dur(m) + "</button>").join("") +
      '<label class="chip num"><input type="text" inputmode="text" id="f-estn" value="' + (EST.includes(f.est) ? "" : M.dur(f.est)) + '" placeholder="e.g. 5h"></label></div>' +
      (sug ? '<div class="hint">' + icon("clock", 14) + "<span>You usually take <b>" + sug.f.toFixed(1) + "×</b> as long on " + esc((s.cats[f.cat] || {}).label || f.cat) + " (" + sug.n + " tasks). " + M.dur(f.est) + " → <b>" + M.dur(sug.est) + '</b>?</span><button class="linkbtn" id="f-sug">Use ' + M.dur(sug.est) + "</button></div>" : "") +
      (ruleMode ? "" : '<label class="field-l">Day</label><div class="chips" id="f-day">' +
        [[today, "Today"], [M.addDays(today, 1), "Tomorrow"], ["", "Inbox"]].map(([v, l]) => '<button class="chip' + ((f.day || "") === v ? " on" : "") + '" data-v="' + v + '">' + l + "</button>").join("") +
        '<label class="chip num"><input type="date" id="f-date" value="' + esc(f.day || "") + '"></label></div>') +
      '<label class="field-l">When</label><div class="seg mini" id="f-when">' + [["anytime", "Anytime"], ["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"], ["at", "At a time"]].map(([v, l]) => {
        const on = v === "at" ? f.at != null : v === "anytime" ? f.at == null && !f.part : f.at == null && M.spanOf(f.part).includes(v);
        return '<button class="' + (on ? "on" : "") + '" data-v="' + v + '">' + l + "</button>";
      }).join("") + "</div>" +
      (f.at == null && f.part ? '<p class="small muted whenhint">' + (M.isSpan(f.part) ? "Runs across " + esc(M.partLabel(f.part)) + ". Tap an end to shorten it." : "Tap another part to let it run on into that part too.") + "</p>" : "") +
      (f.at != null ? '<input class="input" type="time" id="f-at" value="' + esc(f.at || "09:00") + '" step="300">' : "") +
      '<label class="field-l">Repeat</label><div class="seg mini" id="f-rep">' + REPEATS.map(([v, l]) => '<button class="' + (rep === v ? "on" : "") + '" data-v="' + v + '">' + l + "</button>").join("") + "</div>" +
      (rep === "custom" ? '<div class="chips days" id="f-days">' + [1, 2, 3, 4, 5, 6, 7].map(d => '<button class="chip' + (f.repeat.days.includes(d) ? " on" : "") + '" data-v="' + d + '">' + M.WD[d] + "</button>").join("") + "</div>" : "") +
      (ruleMode ? "" : '<label class="field-l">Notes</label><textarea class="input" id="f-notes" rows="2" placeholder="Optional">' + esc(f.notes) + "</textarea>") +
      (task && tracked > 0 ? '<div class="tracked">' + icon("clock", 14) + "<span>Tracked <b>" + M.dur(tracked) + "</b> in " + task.sessions.length + " session" + (task.sessions.length === 1 ? "" : "s") + " · estimate " + M.dur(task.est) + (tracked > task.est ? ' · <span class="over">' + M.dur(tracked - task.est) + " over</span>" : "") + "</span></div>" : "") +
      (task && task.rule && !ruleMode ? '<div class="scope"><span class="small muted">Apply changes to</span><div class="seg mini" id="f-scope"><button class="' + (scope === "one" ? "on" : "") + '" data-v="one">This one</button><button class="' + (scope === "future" ? "on" : "") + '" data-v="future">This and future</button></div></div>' : "") +
      '<div class="modal-f">' + (task || ruleMode ? '<button class="btn ghost danger" id="f-del">' + icon("trash", 15) + "Delete</button>" : "<span></span>") +
      '<div class="row"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="f-save">' + icon("check", 16) + (task || ruleMode ? "Save" : "Add task") + "</button></div></div>";
  };

  const m = modal(draw(), { cls: "task" });
  const box = m.el.querySelector(".modal");
  const read = () => {
    const tt = $("#f-title", box); if (tt) f.title = tt.value;
    const n = $("#f-notes", box); if (n) f.notes = n.value;
    const at = $("#f-at", box); if (at && f.at != null) f.at = at.value || "09:00";
  };
  const redraw = () => { read(); box.innerHTML = draw(); bind(); };
  const bind = () => {
    $$("[data-close]", box).forEach(b => b.onclick = m.close);
    $$("#f-cat [data-v]", box).forEach(b => b.onclick = () => { f.cat = b.dataset.v; redraw(); });
    $$("#f-est [data-v]", box).forEach(b => b.onclick = () => { f.est = +b.dataset.v; redraw(); });
    const en = $("#f-estn", box); if (en) en.onchange = () => { const v = parseLen(en.value); if (v > 0 && v <= 24 * 60) { f.est = v; redraw(); } else if (en.value.trim()) ctx.toast("Couldn’t read that length — try 5h, 2.5h or 3h 30m."); };
    const sg = $("#f-sug", box); if (sg) sg.onclick = () => { f.est = M.suggest(s, f.cat, f.est, fs).est; redraw(); };
    $$("#f-day [data-v]", box).forEach(b => b.onclick = () => { f.day = b.dataset.v || null; redraw(); });
    const dt = $("#f-date", box); if (dt) dt.onchange = () => { f.day = dt.value || null; redraw(); };
    $$("#f-when [data-v]", box).forEach(b => b.onclick = () => {
      const v = b.dataset.v;
      if (v === "at") { f.at = f.at || "09:00"; f.part = null; }
      else if (v === "anytime") { f.at = null; f.part = null; }
      else {
        const cur = f.at == null ? M.spanOf(f.part) : [];
        f.at = null;
        if (!cur.length) f.part = v;                                   // first pick
        else if (!cur.includes(v)) f.part = M.makeSpan(cur.concat(v));  // extend to cover it
        else if (cur.length === 1) f.part = null;                       // tapping the only part again clears it
        else if (v === cur[0] || v === cur[cur.length - 1]) f.part = M.makeSpan(cur.filter(x => x !== v)); // shorten from an end
        else f.part = v;                                                // middle of a span: just that part
      }
      redraw();
    });
    $$("#f-rep [data-v]", box).forEach(b => b.onclick = () => { const v = b.dataset.v; f.repeat = v === "none" ? null : { freq: v, days: v === "custom" ? (f.repeat && f.repeat.days.length ? f.repeat.days : [M.weekday(f.day || today)]) : [] }; redraw(); });
    $$("#f-days [data-v]", box).forEach(b => b.onclick = () => { const d = +b.dataset.v, ds = f.repeat.days; f.repeat.days = ds.includes(d) ? ds.filter(x => x !== d) : ds.concat(d).sort(); redraw(); });
    $$("#f-scope [data-v]", box).forEach(b => b.onclick = () => { scope = b.dataset.v; redraw(); });
    $("#f-title", box).onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); save(); } };
    $("#f-save", box).onclick = save;
    const del = $("#f-del", box); if (del) del.onclick = remove;
  };
  const save = () => {
    read();
    f.title = f.title.trim() || "Untitled";
    if (f.repeat && f.repeat.freq === "custom" && !f.repeat.days.length) { ctx.toast("Pick at least one day to repeat on."); return; }
    const fields = { title: f.title, cat: f.cat, est: f.est, part: f.at ? null : f.part, at: f.at, notes: f.notes };
    if (ruleMode) {
      const now = Date.now();
      store.commit(x => { Object.assign(x.rules[rule.id], { title: f.title, cat: f.cat, est: f.est, part: fields.part, at: f.at, freq: f.repeat ? f.repeat.freq : rule.freq, days: f.repeat ? f.repeat.days : rule.days, t: now }); });
      const today2 = M.todayISO();
      store.commit(x => {
        const r = x.rules[rule.id];
        for (const o of M.live(x.tasks)) {
          if (o.rule !== rule.id || o.done || o.detached || o.rdate < today2) continue;
          if (!M.ruleOccurs(r, o.rdate)) { x.tasks[o.id] = { id: o.id, del: true, rule: o.rule, rdate: o.rdate, t: now }; continue; }
          Object.assign(o, { title: r.title, cat: r.cat, est: r.est, part: r.part, at: r.at, t: now });
        }
      });
      ctx.toast("Repeating task updated.");
    } else if (task) {
      fields.day = f.day;
      const repeatChanged = task.rule ? scope === "future" && JSON.stringify(f.repeat) !== JSON.stringify({ freq: rule.freq, days: rule.days || [] }) : !!f.repeat;
      A.update(task.id, Object.assign(fields, repeatChanged ? { repeat: f.repeat } : {}), task.rule ? scope : "one");
      ctx.toast("Saved.");
    } else {
      A.create(Object.assign(fields, { day: f.day, repeat: f.repeat }));
      ctx.toast(f.repeat ? "Repeating task added." : f.day ? "Added to " + M.dayLabel(f.day, today).toLowerCase() + "." : "Added to inbox.");
    }
    m.close();
    ctx.rerender();
  };
  const remove = async () => {
    if (ruleMode) {
      const ok = await choose("Delete this repeating task?", "Past occurrences you finished stay in your history.", [{ label: "Delete", value: true, cls: "danger" }]);
      if (!ok) return;
      A.deleteRule(rule.id);
    } else if (task.rule) {
      const sc = await choose("Delete a repeating task", "Delete only this one, or this and all future ones?", [{ label: "Only this one", value: "one" }, { label: "This and future", value: "future", cls: "danger" }]);
      if (!sc) return;
      A.remove(task.id, sc);
    } else A.remove(task.id);
    m.close();
    ctx.toast("Deleted.");
    ctx.rerender();
  };
  bind();
  if (!task && !ruleMode) setTimeout(() => { const t = $("#f-title", box); if (t && matchMedia("(pointer: fine)").matches) t.focus(); }, 50);
}

/* ---------------------------------------------------------------- quick add */
export function quickAdd(ctx, defaults = {}) {
  const s = store.get(), today = M.todayISO();
  const m = modal('<div class="qa"><div class="qa-in">' + icon("plus", 18) + '<input id="qa" placeholder="Add a task — try “gym 6pm 45m #health”" autocomplete="off" spellcheck="false"><kbd>↵</kbd></div>' +
    '<div class="qa-prev" id="qa-prev"></div><div class="qa-f"><span class="small muted">Dates: today, tomorrow, mon… · time: 6pm, 18:30 · part: morning, evening, morning to afternoon, all day · length: 45m, 1h30m · #category · every day / weekdays / every mon wed · inbox</span>' +
    '<button class="btn sm ghost" id="qa-more">More options</button></div></div>', { cls: "qa-modal" });
  const inp = $("#qa", m.el), prev = $("#qa-prev", m.el);
  const parsed = () => {
    const p = M.parseQuick(inp.value, s, today);
    if (defaults.day !== undefined && !/\b(today|tod|tomorrow|tmrw?|tmw|inbox|someday|later|mon|tue|wed|thu|fri|sat|sun)/i.test(inp.value)) p.day = defaults.day;
    if (defaults.part && !p.part && !p.at) p.part = defaults.part;
    return p;
  };
  const show = () => {
    const p = parsed();
    if (!inp.value.trim()) { prev.innerHTML = ""; return; }
    const chips = [];
    chips.push('<span class="pv">' + icon("week", 13) + (p.day ? M.dayLabel(p.day, today) : "Inbox") + "</span>");
    if (p.at) chips.push('<span class="pv">' + icon("clock", 13) + M.clock(M.hm(p.at)) + "</span>");
    else if (p.part) chips.push('<span class="pv">' + icon(p.part === "evening" ? "sunset" : "sunrise", 13) + esc(M.partLabel(p.part)) + "</span>");
    chips.push('<span class="pv">' + icon("clock", 13) + M.dur(p.est || M.DEFAULT_EST) + (p.est ? "" : " (default)") + "</span>");
    chips.push(p.cat ? catChip(s, p.cat) : p.newCat ? '<span class="pv">#' + esc(p.newCat) + " (new)</span>" : catChip(s, defaults.cat || "other"));
    if (p.repeat) chips.push('<span class="pv">' + icon("repeat", 13) + (p.repeat.freq === "daily" ? "Every day" : p.repeat.freq === "weekdays" ? "Weekdays" : p.repeat.days.map(d => M.WD[d]).join(", ")) + "</span>");
    prev.innerHTML = '<b>' + esc(p.title) + "</b>" + chips.join("");
  };
  const fields = () => {
    const p = parsed();
    const cat = p.cat || (p.newCat ? A.ensureCat(p.newCat) : defaults.cat || "other");
    return { title: p.title, cat, est: p.est || M.DEFAULT_EST, day: p.day, part: p.at ? null : p.part, at: p.at, notes: "", repeat: p.repeat };
  };
  inp.oninput = show;
  inp.onkeydown = e => {
    if (e.key !== "Enter" || !inp.value.trim()) return;
    e.preventDefault();
    const f = fields();
    A.create(f);
    ctx.toast(f.repeat ? "Repeating task added." : f.day ? "Added to " + M.dayLabel(f.day, today).toLowerCase() + "." : "Added to inbox.");
    ctx.rerender();
    if (e.shiftKey) { inp.value = ""; show(); } else m.close();
  };
  $("#qa-more", m.el).onclick = () => { const f = inp.value.trim() ? fields() : { day: defaults.day, part: defaults.part }; m.close(); setTimeout(() => openTask(ctx, { defaults: f }), 60); };
  setTimeout(() => inp.focus(), 30);
}

/* ---------------------------------------------------------------- "today no longer fits" */
/* Always asks; never moves anything on its own. culprit = the task that just ran long, if any. */
export function resolveDay(ctx, date, culpritId = null) {
  const s = store.get(), now = Date.now(), load = M.dayLoad(s, date, now);
  if (load.over <= 0) return;
  const tomorrow = M.addDays(date, 1);
  const culprit = culpritId ? s.tasks[culpritId] : M.runningTask(s);
  const culpritOk = culprit && !culprit.done && !culprit.del && culprit.day === date;
  const later = M.tasksOn(s, date).filter(t => !t.done && !M.isRunning(t) && (!culprit || t.id !== culprit.id))
    .sort((a, b) => M.remaining(b, now) - M.remaining(a, now));
  const fixes = t => M.remaining(t, now) >= load.over;
  const html = '<div class="modal-h"><span class="modal-ic warn">' + icon("alert", 18) + '</span><div><h3>' + (date === M.todayISO(now) ? "Today" : M.dayLabel(date, M.todayISO(now))) + " no longer fits</h3>" +
    '<p class="small muted"><b>' + M.dur(load.need) + "</b> of work left, <b>" + M.dur(load.cap) + "</b> of time left — <b class=\"over\">" + M.dur(load.over) + " over</b>. What should give?</p></div></div>" +
    '<div class="fixes">' +
    (culpritOk ? '<button class="fix" data-move="' + culprit.id + '"><span class="fix-n">1</span><span><b>Push “' + esc(culprit.title) + '” to tomorrow</b><small>The task that ran long · ' + M.dur(M.remaining(culprit, now)) + " left</small></span>" + icon("tomorrow", 16) + "</button>" : "") +
    (later.length ? '<div class="fix col"><span class="fix-n">' + (culpritOk ? 2 : 1) + '</span><div><b>Push a later task to tomorrow</b><div class="fix-list">' +
      later.map(t => '<button class="fixi" data-move="' + t.id + '">' + catChip(s, t.cat) + "<span>" + esc(t.title) + "</span><em>" + M.dur(M.remaining(t, now)) + (fixes(t) ? " · fixes it" : "") + "</em></button>").join("") + "</div></div></div>" : "") +
    '<button class="fix" id="keep"><span class="fix-n">' + ((culpritOk ? 2 : 1) + (later.length ? 1 : 0)) + '</span><span><b>Keep everything</b><small>I’ll run over today — don’t ask again unless it gets worse</small></span>' + icon("check", 16) + "</button></div>" +
    '<div class="modal-f"><span></span><button class="btn ghost" data-close>Decide later</button></div>';
  const m = modal(html, { cls: "resolve" });
  $$("[data-move]", m.el).forEach(b => b.onclick = () => {
    const t = store.get().tasks[b.dataset.move];
    A.moveTo(t.id, tomorrow);
    m.close();
    ctx.toast("Moved “" + t.title + "” to tomorrow.");
    ctx.rerender();
    setTimeout(() => { if (M.dayLoad(store.get(), date).over > (store.get().dismissed[date] || 0)) resolveDay(ctx, date); }, 350);
  });
  $("#keep", m.el).onclick = () => {
    store.commit(x => { x.dismissed[date] = Math.ceil(load.over); });
    m.close();
    ctx.rerender();
  };
}
