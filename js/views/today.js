import * as store from "../store.js";
import * as M from "../model.js";
import * as A from "../actions.js";
import { esc, $, $$ } from "../util.js";
import { icon, ring, hue } from "../ui.js";
import { openTask, quickAdd, resolveDay, catChip } from "../sheets.js";

export const PX = 1.15;                                   // timeline pixels per minute
const SECTIONS = [["morning", "Morning", "sunrise"], ["afternoon", "Afternoon", "sunrise"], ["evening", "Evening", "sunset"], ["anytime", "Anytime", "clock"]];
const VIEW_KEY = "atria-dayview";
const getView = () => { try { return localStorage.getItem(VIEW_KEY) || "list"; } catch (e) { return "list"; } };
const setView = v => { try { localStorage.setItem(VIEW_KEY, v); } catch (e) { /* ignore */ } };

export function render(el, r, ctx) {
  const today = M.todayISO();
  const date = r.parts[0] === "day" && /^\d{4}-\d{2}-\d{2}$/.test(r.parts[1] || "") ? r.parts[1] : today;
  A.ensureRange(date, date);
  const s = store.get(), now = Date.now();
  const load = M.dayLoad(s, date, now);
  const lay = M.layoutDay(s, date, now);
  const tasks = M.tasksOn(s, date);
  const running = M.runningTask(s);
  const isToday = date === today, past = date < today;
  const dismissed = s.dismissed[date] || 0;

  /* ---- header */
  const nav = d => (d === today ? "#/today" : "#/day/" + d);
  let h = '<header class="page-h rise"><div><div class="eyebrow">' + esc(M.parse(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })) + "</div>" +
    "<h1>" + esc(M.dayLabel(date, today)) + '</h1><p class="muted daysum">' + summary(load, isToday, past) + "</p></div>" +
    '<div class="row daynav"><a class="iconbtn" href="' + nav(M.addDays(date, -1)) + '" aria-label="Previous day">' + icon("chevl", 18) + "</a>" +
    (isToday ? "" : '<a class="btn sm" href="#/today">Today</a>') +
    '<a class="iconbtn" href="' + nav(M.addDays(date, 1)) + '" aria-label="Next day">' + icon("chevr", 18) + "</a>" +
    '<button class="btn primary" data-add>' + icon("plus", 16) + "Add task</button></div></header>";

  /* ---- day stats */
  if (!past) {
    const frac = load.cap ? Math.min(1, load.need / load.cap) : load.need ? 1 : 0;
    h += '<section class="daycard rise d1' + (load.over > 0 ? " full" : "") + '">' + ring(frac, { size: 76, stroke: 8, label: Math.round(frac * 100) + "%", sub: "full" }) +
      '<div class="dstats"><div><b>' + M.dur(load.need) + "</b><span>left to do</span></div><div><b>" + M.dur(load.cap) + "</b><span>" + (isToday ? "time left" : "available") + "</span></div>" +
      "<div><b>" + load.done + "<small>/" + load.total + "</small></b><span>done</span></div><div><b>" + M.dur(load.spent) + "</b><span>tracked</span></div></div></section>";
  }

  /* ---- running timer */
  if (running && isToday) {
    const a = M.actualMin(running, now), est = running.est || M.DEFAULT_EST, first = running.sessions[running.sessions.length - 1];
    h += '<section class="runcard hued' + (a > est ? " over" : "") + '" style="--h:' + catHue(s, running.cat) + '"><span class="pulse"></span><div class="rc-b"><small>Now working on</small><b>' + esc(running.title) + "</b>" +
      '<div class="rc-m"><span data-elapsed="' + running.id + '">' + M.dur(a) + "</span> of " + M.dur(est) + " · since " + M.clock(M.minOfDay(first.s)) + '</div><div class="bar"><i data-runbar="' + running.id + '" style="width:' + Math.min(100, Math.round(100 * a / est)) + '%"></i></div></div>' +
      '<div class="rc-a"><button class="btn sm" data-stop="' + running.id + '">' + icon("pause", 14) + 'Pause</button><button class="btn sm primary" data-done="' + running.id + '">' + icon("check", 14) + "Done</button></div></section>";
  }

  /* ---- unfinished from earlier days (asks; never moves on its own) */
  if (isToday) {
    const old = M.live(s.tasks).filter(t => t.day && t.day < today && !t.done && !t.rule).sort((a, b) => a.day.localeCompare(b.day));
    if (old.length) {
      h += '<section class="carry rise"><div class="carry-h">' + icon("inbox", 16) + "<b>" + old.length + " unfinished from earlier</b>" +
        '<button class="btn sm" data-carryall>Move all to today</button></div><div class="carry-l">' +
        old.map(t => '<div class="carry-i"><span class="cdot hued" style="--h:' + catHue(s, t.cat) + '"></span><span class="ct">' + esc(t.title) + "<small>" + esc(M.dayLabel(t.day, today)) + " · " + M.dur(M.remaining(t, now)) + "</small></span>" +
          '<button class="btn sm ghost" data-carry="' + t.id + '">Today</button><button class="btn sm ghost" data-inbox="' + t.id + '">Inbox</button><button class="iconbtn sm" data-edit="' + t.id + '" aria-label="Edit">' + icon("dots", 16) + "</button></div>").join("") + "</div></section>";
    }
  }

  /* ---- the day doesn't fit */
  if (load.over > 0 && load.over > dismissed) {
    h += '<div class="banner warn">' + icon("alert", 16) + "<span><b>This day is " + M.dur(load.over) + " over.</b> " + M.dur(load.need) + " of work, " + M.dur(load.cap) + ' of time.</span><button class="btn sm" data-resolve>Sort it out</button></div>';
  } else if (load.over > 0) {
    h += '<p class="small muted keepnote">' + icon("check", 13) + " Running " + M.dur(load.over) + " over — you chose to keep everything.</p>";
  }

  /* ---- list + timeline */
  const view = getView();
  h += '<div class="viewseg seg mini"><button data-view="list" class="' + (view === "list" ? "on" : "") + '">' + icon("plan", 14) + ' List</button><button data-view="timeline" class="' + (view === "timeline" ? "on" : "") + '">' + icon("clock", 14) + " Timeline</button></div>";
  h += '<div class="daygrid" data-view="' + view + '"><div class="daylist">' + listHTML(s, tasks, date, now, isToday) + '</div><div class="daytl">' + timelineHTML(s, lay, date) + "</div></div>";

  el.innerHTML = h;
  bind(el, ctx, date);
  // the timeline scrolls on its own: open it at "now", and keep your place when the view refreshes
  const tl = $(".tl-scroll", el), nowEl = $(".tl-now", el);
  if (tl) {
    if (ctx.fresh || tlScroll == null || tlDate !== date) { if (nowEl) tl.scrollTop = Math.max(0, nowEl.offsetTop - 120); }
    else tl.scrollTop = tlScroll;
    tlDate = date; tlScroll = tl.scrollTop;
    tl.addEventListener("scroll", () => { tlScroll = tl.scrollTop; }, { passive: true });
  }
}
let tlScroll = null, tlDate = null;

const catHue = (s, id) => { const c = s.cats[id]; return c && c.hue != null ? c.hue : hue(id); };

function summary(load, isToday, past) {
  if (past) return load.total ? load.done + " of " + load.total + " done · " + M.dur(load.spent) + " tracked" : "Nothing was planned.";
  if (!load.total) return isToday ? "Nothing planned yet — add something, or pull from your inbox." : "Nothing planned yet.";
  return load.done + " of " + load.total + " done · " + M.dur(load.need) + " left · " + M.dur(load.cap) + (isToday ? " of time left" : " available");
}

/* ---------------------------------------------------------------- list */
function listHTML(s, tasks, date, now, isToday) {
  const open = tasks.filter(t => !t.done), done = tasks.filter(t => t.done);
  let h = "";
  for (const [key, label, ic] of SECTIONS) {
    const items = open.filter(t => M.sectionOf(t, s.settings) === key)
      .sort((a, b) => (a.at ? M.hm(a.at) : 1e4) - (b.at ? M.hm(b.at) : 1e4) || (a.order || 0) - (b.order || 0));
    if (key === "anytime" && !items.length) continue;
    // a task spanning into later parts is listed under its first part, but its time isn't all charged to it
    const need = items.filter(t => t.at || !M.isSpan(t.part)).reduce((x, t) => x + M.remaining(t, now), 0);
    const [a, b] = M.partRange(s.settings, key);
    const cap = key === "anytime" ? null : M.partCapacity(s, date, key, now);
    const over = cap != null && need > cap && (cap > 0 || need > 0);
    const gone = isToday && key !== "anytime" && cap === 0 && !items.length;
    if (gone) continue;
    h += '<section class="sec" data-drop-part="' + key + '"><div class="sec-t"><span class="sec-ic">' + icon(ic, 15) + "</span><b>" + label + "</b>" +
      (key === "anytime" ? "" : '<small class="muted">' + M.clock(a) + " – " + M.clock(b) + "</small>") +
      '<span class="sec-load' + (over ? " over" : "") + '">' + (items.length ? M.dur(need) + (cap != null ? " / " + M.dur(cap) : "") : "") + "</span>" +
      '<button class="iconbtn sm" data-addpart="' + key + '" aria-label="Add to ' + label + '">' + icon("plus", 15) + "</button></div>" +
      (items.length ? items.map(t => rowHTML(s, t, now)).join("") : '<div class="sec-empty">Nothing here yet</div>') + "</section>";
  }
  if (done.length) h += '<details class="sec done-sec"' + (done.length <= 3 ? " open" : "") + '><summary class="sec-t"><span class="sec-ic">' + icon("check", 15) + "</span><b>Done</b><span class=\"sec-load\">" + done.length + "</span></summary>" + done.map(t => rowHTML(s, t, now)).join("") + "</details>";
  if (!tasks.length) h += '<div class="empty">' + icon("sparkle", 26) + "<b>A clear day</b>Press <kbd>N</kbd> or the + button to add a task, or plan it from your inbox.</div>";
  return h;
}

export function rowHTML(s, t, now = Date.now()) {
  const a = M.actualMin(t, now), est = t.est || M.DEFAULT_EST, run = M.isRunning(t);
  const time = t.at ? '<span class="tm">' + icon("clock", 12) + M.clock(M.hm(t.at)) + "</span>"
    : M.isSpan(t.part) ? '<span class="tm">' + icon("sunrise", 12) + esc(M.partLabel(t.part)) + "</span>" : "";
  const len = a > 0.5 ? '<span class="' + (a > est ? "over" : "") + '"' + (run ? ' data-elapsed="' + t.id + '"' : "") + ">" + M.dur(a) + "</span> / " + M.dur(est) : M.dur(est);
  return '<div class="trow hued' + (t.done ? " done" : "") + (run ? " running" : "") + '" style="--h:' + catHue(s, t.cat) + '" data-id="' + t.id + '" draggable="true">' +
    '<button class="tick' + (t.done ? " on" : "") + '" data-act="toggle" aria-label="' + (t.done ? "Mark as not done" : "Mark as done") + '">' + icon("check", 14) + "</button>" +
    '<div class="tmain" data-act="edit"><b>' + esc(t.title) + "</b><div class=\"tmeta\">" + catChip(s, t.cat) + time + '<span class="len">' + len + "</span>" + (t.rule ? '<span class="rep" title="Repeats">' + icon("repeat", 12) + "</span>" : "") + (t.notes ? '<span class="rep" title="Has notes">' + icon("edit", 12) + "</span>" : "") + "</div></div>" +
    (t.done ? "" : '<button class="play' + (run ? " on" : "") + '" data-act="' + (run ? "stop" : "start") + '" aria-label="' + (run ? "Pause timer" : "Start timer") + '">' + icon(run ? "pause" : "play", 15) + "</button>") + "</div>";
}

/* ---------------------------------------------------------------- timeline */
function timelineHTML(s, lay, date) {
  const { win } = lay, H = (win.end - win.start) * PX;
  const y = m => (m - win.start) * PX;
  let h = '<div class="tl-scroll"><div class="tl" style="height:' + H + 'px" data-date="' + date + '">';
  for (const [key, label] of [["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]]) {
    const [a, b] = M.partRange(s.settings, key);
    h += '<div class="tl-band ' + key + '" style="top:' + y(a) + "px;height:" + (b - a) * PX + 'px"><span>' + label + "</span></div>";
  }
  for (let m = Math.ceil(win.start / 60) * 60; m <= win.end; m += 60) h += '<div class="tl-h" style="top:' + y(m) + 'px"><span>' + M.clock(m).replace(":00", "") + "</span></div>";
  if (lay.nowMin != null && lay.nowMin >= win.start && lay.nowMin <= win.end) h += '<div class="tl-now" style="top:' + y(lay.nowMin) + 'px"><i></i><span>' + M.clock(lay.nowMin) + "</span></div>";
  for (const b of lay.blocks) {
    const t = b.task, top = y(Math.max(win.start, b.start)), height = Math.max(22, (Math.min(win.end + 120, b.end) - Math.max(win.start, b.start)) * PX);
    const movable = b.kind === "fixed" || b.kind === "plan";
    const overPx = b.over > 0 ? Math.min(height, b.over * PX) : 0;
    h += '<div class="tl-b hued ' + b.kind + (b.spill ? " spill" : "") + (height < 40 ? " short" : "") + '" data-id="' + t.id + '"' + (movable ? ' data-move="1"' : "") + ' style="top:' + top + "px;height:" + height + "px;--h:" + catHue(s, t.cat) + '">' +
      "<b>" + esc(t.title) + "</b><small>" + M.clock(b.start) + " – " + M.clock(b.end) + " · " + M.dur(b.end - b.start) + (b.kind === "plan" ? "" : b.kind === "running" ? " · running" : b.kind === "done" ? " · done" : "") + "</small>" +
      (overPx ? '<i class="tl-over" style="height:' + overPx + 'px"></i>' : "") + (movable ? '<span class="tl-rs" data-resize="1"></span>' : "") + "</div>";
  }
  return h + '<div class="tl-ghost" hidden></div></div></div>';
}

/* ---------------------------------------------------------------- interaction */
function bind(el, ctx, date) {
  const today = M.todayISO();
  const afterWork = id => {                                // after pausing/finishing: does the day still fit?
    ctx.rerender();
    const st = store.get(), l = M.dayLoad(st, date);
    if (date >= today && l.over > (st.dismissed[date] || 0)) setTimeout(() => resolveDay(ctx, date, id), 250);
  };
  $$("[data-add]", el).forEach(b => b.onclick = () => quickAdd(ctx, { day: date }));
  $$("[data-addpart]", el).forEach(b => b.onclick = () => quickAdd(ctx, { day: date, part: b.dataset.addpart === "anytime" ? null : b.dataset.addpart }));
  $$("[data-stop]", el).forEach(b => b.onclick = () => { A.stop(b.dataset.stop); afterWork(b.dataset.stop); });
  $$("[data-done]", el).forEach(b => b.onclick = () => { A.complete(b.dataset.done); ctx.toast("Done. Nice."); afterWork(b.dataset.done); });
  $$("[data-resolve]", el).forEach(b => b.onclick = () => resolveDay(ctx, date));
  $$("[data-carry]", el).forEach(b => b.onclick = () => { A.moveTo(b.dataset.carry, today); ctx.rerender(); });
  $$("[data-inbox]", el).forEach(b => b.onclick = () => { A.moveTo(b.dataset.inbox, null); ctx.toast("Moved to inbox."); ctx.rerender(); });
  $$("[data-edit]", el).forEach(b => b.onclick = () => openTask(ctx, { task: b.dataset.edit }));
  const all = $("[data-carryall]", el);
  if (all) all.onclick = () => {
    const ids = M.live(store.get().tasks).filter(t => t.day && t.day < today && !t.done && !t.rule).map(t => t.id);
    A.moveMany(ids, today); ctx.toast("Moved " + ids.length + " to today."); ctx.rerender();
  };
  $$("[data-view]", el).forEach(b => b.onclick = () => { setView(b.dataset.view); $(".daygrid", el).dataset.view = b.dataset.view; $$("[data-view]", el).forEach(x => x.classList.toggle("on", x === b)); });

  $$(".trow [data-act]", el).forEach(b => b.onclick = e => {
    e.stopPropagation();
    const id = b.closest(".trow").dataset.id, act = b.dataset.act, t = store.get().tasks[id];
    if (act === "edit") return openTask(ctx, { task: id });
    if (act === "start") { A.start(id); ctx.toast("Timer started."); return ctx.rerender(); }
    if (act === "stop") { A.stop(id); return afterWork(id); }
    if (act === "toggle") {
      if (t.done) { A.reopen(id); return ctx.rerender(); }
      A.complete(id);
      afterWork(id);
    }
  });

  /* drag rows from the list onto a part of the day, or onto the timeline to give them a time (desktop) */
  let dragId = null;
  $$(".trow", el).forEach(r => {
    r.addEventListener("dragstart", e => { dragId = r.dataset.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); r.classList.add("dragging"); });
    r.addEventListener("dragend", () => { r.classList.remove("dragging"); dragId = null; $$(".drop-on", el).forEach(x => x.classList.remove("drop-on")); const g = $(".tl-ghost", el); if (g) g.hidden = true; });
  });
  $$("[data-drop-part]", el).forEach(sec => {
    sec.addEventListener("dragover", e => { if (!dragId) return; e.preventDefault(); sec.classList.add("drop-on"); });
    sec.addEventListener("dragleave", () => sec.classList.remove("drop-on"));
    sec.addEventListener("drop", e => {
      e.preventDefault(); sec.classList.remove("drop-on");
      const id = dragId || e.dataTransfer.getData("text/plain"), part = sec.dataset.dropPart;
      store.patchTask(id, { day: date, part: part === "anytime" ? null : part, at: null, order: Date.now() });
      ctx.rerender();
    });
  });
  const tl = $(".tl", el);
  if (!tl) return;
  const win = M.windowOf(store.get().settings);
  const minAt = clientY => { const r = tl.getBoundingClientRect(); return Math.max(win.start, Math.min(win.end - 15, Math.round(((clientY - r.top) / PX + win.start) / 15) * 15)); };
  const ghost = $(".tl-ghost", el);
  tl.addEventListener("dragover", e => {
    if (!dragId) return;
    e.preventDefault();
    const m = minAt(e.clientY), t = store.get().tasks[dragId];
    ghost.hidden = false; ghost.style.top = (m - win.start) * PX + "px"; ghost.style.height = Math.max(20, (t.est || 30) * PX) + "px"; ghost.textContent = M.clock(m);
  });
  tl.addEventListener("dragleave", e => { if (!tl.contains(e.relatedTarget)) ghost.hidden = true; });
  tl.addEventListener("drop", e => {
    e.preventDefault(); ghost.hidden = true;
    const id = dragId || e.dataTransfer.getData("text/plain"), m = minAt(e.clientY);
    store.patchTask(id, { day: date, at: M.toHM(m), part: null, order: m });
    ctx.toast("Scheduled at " + M.clock(m) + ".");
    ctx.rerender();
  });

  /* move / resize blocks on the timeline with a pointer (mouse, pen or finger) */
  $$(".tl-b", el).forEach(b => {
    let mode = null, y0 = 0, top0 = 0, h0 = 0, moved = false, pid = null;
    b.addEventListener("pointerdown", e => {
      if (e.button) return;
      mode = e.target.closest("[data-resize]") ? "resize" : b.dataset.move ? "move" : null;
      y0 = e.clientY; top0 = b.offsetTop; h0 = b.offsetHeight; moved = false; pid = e.pointerId;
      if (mode && e.pointerType === "mouse") b.setPointerCapture(pid);
    });
    b.addEventListener("pointermove", e => {
      if (!mode || e.pointerType !== "mouse" && mode === "move") return;           // on touch, scrolling wins
      const dy = e.clientY - y0;
      if (!moved && Math.abs(dy) < 4) return;
      moved = true; b.classList.add("dragging");
      if (mode === "move") b.style.top = Math.max(0, top0 + dy) + "px";
      else b.style.height = Math.max(15 * PX, h0 + dy) + "px";
    });
    b.addEventListener("pointerup", () => {
      const m0 = mode; mode = null; b.classList.remove("dragging");
      if (!moved) return;
      const id = b.dataset.id;
      if (m0 === "move") {
        const m = Math.round((b.offsetTop / PX + win.start) / 15) * 15;
        store.patchTask(id, { at: M.toHM(m), part: null, order: m });
        ctx.toast("Moved to " + M.clock(m) + ".");
      } else {
        const t = store.get().tasks[id];
        // a planned block only shows the time still left, so the estimate is that plus what's already tracked
        const est = Math.max(5, Math.round((b.offsetHeight / PX) / 5) * 5) + (t && b.classList.contains("plan") ? Math.round(M.actualMin(t)) : 0);
        store.patchTask(id, { est });
        ctx.toast("Estimate set to " + M.dur(est) + ".");
      }
      ctx.rerender();
    });
    b.addEventListener("click", () => { if (!moved) openTask(ctx, { task: b.dataset.id }); });
  });
}
