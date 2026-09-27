import * as store from "../store.js";
import * as M from "../model.js";
import * as A from "../actions.js";
import { esc, $, $$ } from "../util.js";
import { icon, hue } from "../ui.js";
import { openTask, quickAdd } from "../sheets.js";

export function render(el, r, ctx) {
  const today = M.todayISO();
  const mon = M.mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(r.parts[1] || "") ? r.parts[1] : today);
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => M.addDays(mon, i));
  A.ensureRange(mon, days[6]);
  const s = store.get(), now = Date.now();
  const thisMon = M.mondayOf(today), off = M.diffDays(thisMon, mon) / 7;
  const title = off === 0 ? "This week" : off === 1 ? "Next week" : off === -1 ? "Last week" : "Week of " + M.parse(mon).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const loads = days.map(d => M.dayLoad(s, d, now));
  const planned = loads.reduce((a, l) => a + l.planned, 0), spent = loads.reduce((a, l) => a + l.spent, 0);
  const done = loads.reduce((a, l) => a + l.done, 0), total = loads.reduce((a, l) => a + l.total, 0);

  let h = '<header class="page-h rise"><div><div class="eyebrow">' + esc(M.parse(mon).toLocaleDateString(undefined, { day: "numeric", month: "long" })) + " – " + esc(M.parse(days[6]).toLocaleDateString(undefined, { day: "numeric", month: "long" })) + "</div><h1>" + title + "</h1>" +
    '<p class="muted">' + done + " of " + total + " done · " + M.dur(planned) + " planned · " + M.dur(spent) + " tracked</p></div>" +
    '<div class="row daynav"><a class="iconbtn" href="#/week/' + M.addDays(mon, -7) + '" aria-label="Previous week">' + icon("chevl", 18) + "</a>" + (off ? '<a class="btn sm" href="#/week">This week</a>' : "") +
    '<a class="iconbtn" href="#/week/' + M.addDays(mon, 7) + '" aria-label="Next week">' + icon("chevr", 18) + "</a></div></header>";

  h += '<div class="wk stagger">' + days.map((d, i) => {
    const l = loads[i], past = d < today, list = M.tasksOn(s, d).sort((a, b) => Number(a.done) - Number(b.done) || (a.at ? M.hm(a.at) : 1e4) - (b.at ? M.hm(b.at) : 1e4) || (a.order || 0) - (b.order || 0));
    const frac = past ? (l.total ? l.done / l.total : 0) : l.cap ? Math.min(1, l.need / l.cap) : l.need ? 1 : 0;
    const full = !past && l.over > 0;
    return '<div class="wkd' + (d === today ? " now" : "") + (past ? " past" : "") + '" data-day="' + d + '"><a class="wkd-h" href="' + (d === today ? "#/today" : "#/day/" + d) + '"><b>' + M.WD[M.weekday(d)] + "</b><span>" + (+d.slice(8)) + "</span></a>" +
      '<div class="bar' + (full ? " bad" : past ? " good" : "") + '"><i style="width:' + Math.round(frac * 100) + '%"></i></div>' +
      '<small class="wkd-l' + (full ? " over" : "") + '">' + (past ? l.done + "/" + l.total + " done" : l.total ? M.dur(l.need) + (full ? " · " + M.dur(l.over) + " over" : " of " + M.dur(l.cap)) : "free") + "</small>" +
      '<div class="wkd-list">' + list.map(t => '<div class="wchip hued' + (t.done ? " done" : "") + (M.isRunning(t) ? " running" : "") + '" draggable="true" data-id="' + t.id + '" style="--h:' + catHue(s, t.cat) + '"><b>' + esc(t.title) + "</b><small>" + (t.at ? M.clock(M.hm(t.at)) + " · " : t.part ? M.partLabel(t.part) + " · " : "") + M.dur(t.est || M.DEFAULT_EST) + (t.rule ? " · " + icon("repeat", 10) : "") + "</small></div>").join("") + "</div>" +
      (past ? "" : '<button class="wkd-add" data-add="' + d + '">' + icon("plus", 14) + "Add</button>") + "</div>";
  }).join("") + "</div>";
  h += '<p class="tip">' + icon("bolt", 15) + "<span>Drag tasks between days to rebalance your week. Days turn red when they no longer fit the time you have.</span></p>";
  el.innerHTML = h;

  $$("[data-add]", el).forEach(b => b.onclick = () => quickAdd(ctx, { day: b.dataset.add }));
  let dragId = null;
  $$(".wchip", el).forEach(c => {
    c.onclick = () => openTask(ctx, { task: c.dataset.id });
    c.addEventListener("dragstart", e => { dragId = c.dataset.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); c.classList.add("dragging"); });
    c.addEventListener("dragend", () => { c.classList.remove("dragging"); dragId = null; $$(".drop-on", el).forEach(x => x.classList.remove("drop-on")); });
  });
  $$(".wkd", el).forEach(col => {
    col.addEventListener("dragover", e => { if (!dragId) return; e.preventDefault(); col.classList.add("drop-on"); });
    col.addEventListener("dragleave", e => { if (!col.contains(e.relatedTarget)) col.classList.remove("drop-on"); });
    col.addEventListener("drop", e => {
      e.preventDefault(); col.classList.remove("drop-on");
      const id = dragId || e.dataTransfer.getData("text/plain"), day = col.dataset.day, t = store.get().tasks[id];
      if (!t || t.day === day) return;
      A.moveTo(id, day);
      ctx.toast("Moved to " + M.dayLabel(day, today).toLowerCase() + ".");
      ctx.rerender();
    });
  });
}
const catHue = (s, id) => { const c = s.cats[id]; return c && c.hue != null ? c.hue : hue(id); };
