import * as store from "./store.js";
import * as M from "./model.js";
import * as A from "./actions.js";
import { $, $$, esc } from "./util.js";
import { icon, hue, getTheme, setTheme, cycleTheme, syncThemeColor, countUps, reduced } from "./ui.js";
import { openTask, quickAdd } from "./sheets.js";
import * as today from "./views/today.js";
import * as week from "./views/week.js";
import * as inbox from "./views/inbox.js";
import * as repeat from "./views/repeat.js";
import * as insights from "./views/insights.js";
import * as settings from "./views/settings.js";

const TABS = [["today", "Today", "today"], ["week", "Week", "week"], ["inbox", "Inbox", "inbox"], ["repeat", "Repeating", "repeat"], ["insights", "Insights", "insights"]];
const VIEWS = { today, day: today, week, inbox, repeat, insights, settings };
const desktop = matchMedia("(min-width: 960px)");
const lite = () => !desktop.matches;                       // phones: CSS slides instead of view-transition snapshots
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const modKey = isMac ? "⌘" : "Ctrl";

export function route(hash = location.hash) {
  const h = hash.replace(/^#\/?/, "");
  const [path, query] = h.split("?");
  return { parts: path.split("/").filter(Boolean), q: new URLSearchParams(query || "") };
}
const go = hash => { location.hash = hash; };

function toast(msg, ms = 2400) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = icon(/fail|could not|error|must|pick/i.test(msg) ? "alert" : "check", 16) + "<span></span>";
  t.lastChild.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 260); }, ms);
}

/* ------------------------------------------------------------------ chrome */
const tabOf = r => { const k = r.parts[0] || "today"; return k === "day" ? "today" : VIEWS[k] ? k : "today"; };
function badges() {
  const s = store.get(), d = M.todayISO();
  return { today: M.tasksOn(s, d).filter(t => !t.done).length, inbox: M.inboxTasks(s).length };
}
function runChip(compact) {
  const r = M.runningTask(store.get());
  if (!r) return "";
  return '<a class="runchip hued' + (compact ? " compact" : "") + '" href="#/today" style="--h:' + catHue(r.cat) + '" title="' + esc(r.title) + '"><span class="pulse"></span>' +
    (compact ? "" : "<span class=\"rt\">" + esc(r.title) + "</span>") + '<b data-elapsed="' + r.id + '">' + M.dur(M.actualMin(r)) + "</b></a>";
}
const catHue = id => { const c = store.get().cats[id]; return c && c.hue != null ? c.hue : hue(id); };
function themeBtn() {
  const t = getTheme();
  return '<button class="iconbtn" type="button" data-theme-cycle title="Theme: ' + t + '" aria-label="Change theme">' + icon(t === "light" ? "sun" : t === "dark" ? "moon" : "system", 17) + "</button>";
}

function drawChrome(active) {
  const b = badges(), n = k => (b[k] ? "<em>" + b[k] + "</em>" : "");
  $("#side").innerHTML =
    '<a class="brand" href="#/today"><span class="logo">' + icon("sparkle", 18) + '</span><span><b>Atria</b><small>Plan your day, honestly</small></span></a>' +
    '<button class="btn primary block" data-quick>' + icon("plus", 16) + "New task<kbd>N</kbd></button>" +
    '<button class="search" type="button" data-palette>' + icon("search", 15) + "<span>Search or jump to…</span><kbd>" + modKey + " K</kbd></button>" +
    '<nav class="snav">' + TABS.map(([k, label, ic]) => '<a href="#/' + k + '"' + (k === active ? ' class="on" aria-current="page"' : "") + ">" + (k === active ? '<span class="snav-ind"></span>' : "") + icon(ic, 18) + "<span>" + label + "</span>" + n(k) + "</a>").join("") + "</nav>" +
    runChip(false) +
    '<div class="side-foot"><div class="row between"><a class="btn sm ghost" href="#/settings">' + icon("gear", 15) + "Settings</a>" + themeBtn() + "</div></div>";
  $("#top").innerHTML = '<a class="brand sm" href="#/today"><span class="logo">' + icon("sparkle", 15) + "</span><b>Atria</b></a>" +
    '<div class="row" style="gap:2px">' + runChip(true) + '<button class="iconbtn" type="button" data-palette aria-label="Search">' + icon("search", 18) + '</button><a class="iconbtn" href="#/settings" aria-label="Settings">' + icon("gear", 18) + "</a></div>";
  drawDock(active, b);
}
/* The dock is built once and only updated, so its pill glides between tabs with a plain CSS transition. */
function drawDock(active, b) {
  const nav = $("#nav");
  if (!nav.querySelector(".dock-pill")) {
    nav.innerHTML = '<span class="dock-pill"></span>' + TABS.map(([k, label, ic]) => '<a href="#/' + k + '" data-tab="' + k + '">' + icon(ic, 20) + "<span>" + label + "</span><em hidden></em></a>").join("");
    nav.addEventListener("pointerdown", e => { const a = e.target.closest("a[data-tab]"); if (a) nav.style.setProperty("--i", TABS.findIndex(([k]) => k === a.dataset.tab)); });
  }
  const i = TABS.findIndex(([k]) => k === active);
  nav.style.setProperty("--i", Math.max(0, i));
  nav.classList.toggle("nopill", i < 0);
  for (const a of nav.querySelectorAll("a[data-tab]")) {
    const on = a.dataset.tab === active, em = a.querySelector("em"), c = b[a.dataset.tab];
    a.classList.toggle("on", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    em.hidden = !c; if (c) em.textContent = c;
  }
}
function refreshChrome() { drawChrome(tabOf(route())); }

/* ------------------------------------------------------------------ rendering with page transitions */
let lastHash = null, painted = false, navToken = 0;
export function render() {
  const fresh = location.hash !== lastHash;
  const prev = lastHash == null ? null : route(lastHash);
  lastHash = location.hash;
  const r = route();
  const idx = rr => TABS.findIndex(([k]) => k === tabOf(rr));
  const a = prev ? idx(prev) : -1, b = idx(r);
  const dir = a < 0 || b < 0 || a === b ? "" : b > a ? "fwd" : "back";
  if (fresh && painted && lite()) paint(r, true, dir, reduced() ? "" : dir || "up");
  else if (fresh && painted && document.startViewTransition && !reduced() && !document.hidden) {
    const root = document.documentElement, token = ++navToken;
    root.dataset.nav = dir;
    const vt = document.startViewTransition(() => paint(r, true, dir));
    vt.ready.catch(() => {});
    vt.finished.catch(() => {}).finally(() => { if (token === navToken) root.dataset.nav = ""; });
  } else paint(r, fresh);
}
function paint(r, fresh, dir = "", anim = "") {
  const view = VIEWS[r.parts[0] || "today"] || today;
  drawChrome(tabOf(r));
  const main = $("#main"), y = window.scrollY;
  const enter = !fresh ? "" : dir ? ' data-enter="tab"' : ' data-enter="1"';
  main.innerHTML = '<div class="view" id="view"' + enter + (anim ? ' data-anim="' + anim + '"' : "") + "></div>";
  const v = $("#view");
  view.render(v, r, ctx(fresh));
  if (fresh) { window.scrollTo(0, 0); countUps(v); setTimeout(() => v.removeAttribute("data-enter"), 1400); }
  else window.scrollTo(0, y);
  painted = true;
}
const ctx = (fresh = false) => ({ go, toast, rerender: render, refreshChrome, fresh });

/* ------------------------------------------------------------------ live timer: tick displays without re-rendering */
const warned = new Set();
function tick() {
  const s = store.get(), r = M.runningTask(s);
  if (!r) return;
  const a = M.actualMin(r), est = r.est || M.DEFAULT_EST;
  $$('[data-elapsed="' + r.id + '"]').forEach(e => { e.textContent = M.dur(a); });
  $$('[data-runbar="' + r.id + '"]').forEach(e => { e.style.width = Math.min(100, Math.round(100 * a / est)) + "%"; });
  const key = r.id + ":" + r.sessions.length;
  if (a > est && !warned.has(key)) { warned.add(key); toast("“" + r.title + "” is past its " + M.dur(est) + " estimate.", 3800); }
}
let lastDay = M.todayISO(), lastMinute = 0;
function minuteRefresh() {
  const busy = document.querySelector(".modal-bg, .pal-bg, .dragging") || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "");
  const day = M.todayISO();
  if (day !== lastDay) { lastDay = day; if (!busy) render(); return; }
  const k = route().parts[0] || "today";
  if (!busy && (k === "today" || k === "day")) render();
}

/* ------------------------------------------------------------------ command palette (Ctrl/Cmd+K) */
let palOpen = false;
function openPalette() {
  if (palOpen) return;
  palOpen = true;
  const s = store.get(), today = M.todayISO();
  const base = [];
  const page = (label, hash, ic) => base.push({ g: "Go to", label, ic, run: () => go(hash) });
  page("Today", "#/today", "today"); page("Tomorrow", "#/day/" + M.addDays(today, 1), "chevr"); page("Week", "#/week", "week");
  page("Inbox", "#/inbox", "inbox"); page("Repeating", "#/repeat", "repeat"); page("Insights", "#/insights", "insights"); page("Settings", "#/settings", "gear");
  for (const [t, label, ic] of [["light", "Light", "sun"], ["dark", "Dark", "moon"], ["system", "System", "system"]]) base.push({ g: "Theme", label: "Theme: " + label, ic, run: () => { setTheme(t); setTimeout(refreshChrome, 20); } });
  const tasks = M.live(s.tasks).filter(t => !t.done || t.day === today).sort((a, b) => (a.day || "9").localeCompare(b.day || "9"))
    .map(t => ({ g: "Tasks", label: t.title, hint: t.day ? M.dayLabel(t.day, today) : "Inbox", dot: catHue(t.cat), deep: true, run: () => openTask(ctx(), { task: t.id }) }));
  const bg = document.createElement("div");
  bg.className = "pal-bg";
  bg.innerHTML = '<div class="pal" role="dialog" aria-label="Search"><div class="pal-in">' + icon("search", 18) + '<input placeholder="Search tasks, jump to a page, or type a new task…" autocomplete="off" spellcheck="false"><kbd>esc</kbd></div><div class="pal-l"></div>' +
    '<div class="pal-f"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span>First result adds what you typed as a task</span></div></div>';
  document.body.appendChild(bg);
  const inp = $("input", bg), list = $(".pal-l", bg);
  let shown = [], act = 0;
  const draw = () => {
    const q = inp.value.trim(), toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    const add = q ? [{ g: "New task", label: "Add “" + q + "”", ic: "plus", run: () => { const p = M.parseQuick(q, s, today); const cat = p.cat || (p.newCat ? A.ensureCat(p.newCat) : "other"); A.create({ title: p.title, cat, est: p.est || M.DEFAULT_EST, day: p.day, part: p.at ? null : p.part, at: p.at, repeat: p.repeat }); toast("Added."); render(); } }] : [];
    let nt = 0;
    shown = add.concat(base.concat(tasks).filter(it => (!it.deep || q.length >= 1) && toks.every(t => (it.label + " " + (it.hint || "") + " " + it.g).toLowerCase().includes(t))).filter(it => !it.deep || ++nt <= 10)).slice(0, 40);
    act = Math.min(act, Math.max(0, shown.length - 1));
    let h = "", g = null;
    shown.forEach((it, i) => {
      if (it.g !== g) { g = it.g; h += '<div class="pal-g">' + g + "</div>"; }
      const hued = it.dot != null;
      h += '<div class="pal-i' + (i === act ? " on" : "") + (hued ? " hued" : "") + '" data-i="' + i + '"' + (hued ? ' style="--h:' + it.dot + '"' : "") + ">" + (hued ? '<i class="dot"></i>' : icon(it.ic || "chevr", 16)) + "<span>" + esc(it.label) + "</span>" + (it.hint ? "<small>" + esc(it.hint) + "</small>" : "") + "</div>";
    });
    list.innerHTML = h || '<div class="pal-empty">Type to search or add a task</div>';
  };
  const mark = () => { $$(".pal-i", list).forEach((el, i) => el.classList.toggle("on", i === act)); const el = $(".pal-i.on", list); if (el) el.scrollIntoView({ block: "nearest" }); };
  const close = () => { palOpen = false; bg.classList.add("out"); document.removeEventListener("keydown", onKey, true); setTimeout(() => bg.remove(), 160); };
  const pick = i => { const it = shown[i]; close(); if (it) it.run(); };
  const onKey = e => {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown" && shown.length) { e.preventDefault(); act = (act + 1) % shown.length; mark(); }
    else if (e.key === "ArrowUp" && shown.length) { e.preventDefault(); act = (act - 1 + shown.length) % shown.length; mark(); }
    else if (e.key === "Enter") { e.preventDefault(); pick(act); }
  };
  document.addEventListener("keydown", onKey, true);
  inp.oninput = () => { act = 0; draw(); };
  list.onmousemove = e => { const el = e.target.closest(".pal-i"); if (el && +el.dataset.i !== act) { act = +el.dataset.i; mark(); } };
  list.onclick = e => { const el = e.target.closest(".pal-i"); if (el) pick(+el.dataset.i); };
  bg.onmousedown = e => { if (e.target === bg) close(); };
  draw();
  inp.focus();
}

/* ------------------------------------------------------------------ boot */
function boot() {
  store.load();
  syncThemeColor();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeColor);
  store.subscribe(why => {
    if (why === "change" || why === "silent") refreshChrome();
    else render();
  });
  document.addEventListener("click", e => {
    if (e.target.closest("[data-palette]")) openPalette();
    else if (e.target.closest("[data-quick]")) quickAdd(ctx(), { day: route().parts[0] === "day" ? route().parts[1] : route().parts[0] === "inbox" ? null : M.todayISO() });
    else if (e.target.closest("[data-theme-cycle]")) { cycleTheme(); setTimeout(refreshChrome, 20); }
  });
  document.addEventListener("keydown", e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".modal-bg, .pal-bg")) return;
    const k = e.key.toLowerCase();
    if (k === "n") { e.preventDefault(); quickAdd(ctx(), { day: route().parts[0] === "day" ? route().parts[1] : M.todayISO() }); }
    else if (k === "/") { e.preventDefault(); openPalette(); }
    else if (k === "t") go("#/today");
    else if (k === "w") go("#/week");
    else if (k === "i") go("#/inbox");
  });
  window.addEventListener("hashchange", render);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) minuteRefresh(); });
  setInterval(tick, 1000);
  setInterval(() => { const m = Math.floor(Date.now() / 60000); if (m !== lastMinute) { lastMinute = m; minuteRefresh(); } }, 5000);
  lastMinute = Math.floor(Date.now() / 60000);
  render();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();
