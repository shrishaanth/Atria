import * as store from "../store.js";
import * as M from "../model.js";
import { esc, $$ } from "../util.js";
import { icon, hue, ring } from "../ui.js";

/* Where the time actually goes: planned vs tracked per day, and how far off estimates run per category. */
export function render(el, r, ctx) {
  const s = store.get(), today = M.todayISO(), now = Date.now();
  const range = r.parts[1] === "30" ? 30 : 7;
  const days = []; for (let i = range - 1; i >= 0; i--) days.push(M.addDays(today, -i));
  const all = M.live(s.tasks);
  const inRange = all.filter(t => t.day && t.day >= days[0] && t.day <= today);
  const per = days.map(d => {
    const ts = inRange.filter(t => t.day === d);
    return { d, planned: ts.reduce((a, t) => a + (t.est || M.DEFAULT_EST), 0), tracked: ts.reduce((a, t) => a + M.actualMin(t, now), 0), done: ts.filter(t => t.done).length, total: ts.length };
  });
  const tracked = per.reduce((a, x) => a + x.tracked, 0), done = per.reduce((a, x) => a + x.done, 0), total = per.reduce((a, x) => a + x.total, 0);
  const timed = inRange.filter(t => t.done && M.hasTime(t) && t.est);
  const sumA = timed.reduce((a, t) => a + M.actualMin(t, now), 0), sumE = timed.reduce((a, t) => a + t.est, 0);
  const overall = sumE ? sumA / sumE : null;
  const fs = M.factors(s);

  let h = '<header class="page-h rise"><div><div class="eyebrow">How it really went</div><h1>Insights</h1></div>' +
    '<nav class="seg mini rng"><a href="#/insights" class="' + (range === 7 ? "on" : "") + '">7 days</a><a href="#/insights/30" class="' + (range === 30 ? "on" : "") + '">30 days</a></nav></header>';
  h += '<div class="stats stagger">' + stat("clock", Math.round(tracked / 60 * 10) / 10, "hours tracked") + stat("check", done, "tasks done", total ? "/" + total : "") +
    stat("target", total ? Math.round(100 * done / total) : "—", "completion", total ? "%" : "") +
    stat("insights", overall ? overall.toFixed(1) : "—", "actual vs planned", overall ? "×" : "", overall && overall > 1.1 ? "hot" : "") + "</div>";

  if (!tracked && !done) {
    h += '<div class="empty" style="margin-top:18px">' + icon("insights", 28) + "<b>Nothing to show yet</b>Start the timer (" + icon("play", 12) + ") on a task when you begin it, and Atria learns how long your tasks really take.</div>";
    el.innerHTML = h; return;
  }

  /* planned vs tracked per day */
  const max = Math.max(30, ...per.map(x => Math.max(x.planned, x.tracked)));
  h += '<div class="sec-h"><h2>Planned vs tracked</h2><span class="legend2"><i class="p"></i>planned<i class="a"></i>tracked</span></div><div class="card chart' + (range === 30 ? " dense" : "") + '">' +
    per.map(x => '<a class="col" href="' + (x.d === today ? "#/today" : "#/day/" + x.d) + '" title="' + x.d + ": planned " + M.dur(x.planned) + ", tracked " + M.dur(x.tracked) + '"><div class="bars"><i class="p" style="height:' + (100 * x.planned / max) + '%"></i><i class="a' + (x.tracked > x.planned ? " over" : "") + '" style="height:' + (100 * x.tracked / max) + '%"></i></div><small>' + (range === 7 ? M.WD[M.weekday(x.d)] : +x.d.slice(8)) + "</small></a>").join("") + "</div>";

  /* per category */
  const byCat = {};
  for (const t of inRange) {
    const c = byCat[t.cat] || (byCat[t.cat] = { tracked: 0, done: 0, total: 0 });
    c.tracked += M.actualMin(t, now); c.total++; if (t.done) c.done++;
  }
  const rows = Object.entries(byCat).sort((a, b) => b[1].tracked - a[1].tracked);
  const maxT = Math.max(1, ...rows.map(([, c]) => c.tracked));
  h += '<div class="sec-h"><h2>By category</h2><span class="small muted">estimates learned from your last 20 timed tasks each</span></div><div class="list">' + rows.map(([id, c]) => {
    const cat = s.cats[id] || { label: id }, f = fs[id], hh = cat.hue != null ? cat.hue : hue(id);
    const note = !f || f.n < 3 ? "needs 3+ timed tasks to learn" : Math.abs(f.f - 1) < 0.1 ? "your estimates are spot on" : f.f > 1 ? "takes you " + f.f.toFixed(1) + "× longer than planned" : "done in " + Math.round(f.f * 100) + "% of the planned time";
    return '<div class="li catrow hued" style="--h:' + hh + '"><span class="lidot"></span><div class="t"><b>' + esc(cat.label) + "</b><small>" + c.done + "/" + c.total + " done · " + note + '</small></div><div class="r"><div class="bar tint" style="width:90px"><i style="width:' + Math.round(100 * c.tracked / maxT) + '%"></i></div>' + M.dur(c.tracked) + "</div></div>";
  }).join("") + "</div>";

  /* streaks */
  const rules = M.live(s.rules).map(rl => [rl, M.streak(s, rl, today)]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (rules.length) h += '<div class="sec-h"><h2>Streaks</h2></div><div class="list">' + rules.map(([rl, n]) => '<a class="li" href="#/repeat"><span class="streak on">' + icon("flame", 14) + n + '</span><div class="t"><b>' + esc(rl.title) + "</b><small>" + esc(M.ruleText(rl)) + "</small></div></a>").join("") + "</div>";
  el.innerHTML = h;
}

function stat(ic, n, label, suffix = "", cls = "") {
  const num = typeof n === "number" && Number.isInteger(n) ? '<span data-count="' + n + '">' + n + "</span>" : n;
  return '<div class="stat ' + cls + '"><span class="stat-ic">' + icon(ic, 16) + "</span><b>" + num + (suffix ? "<small>" + suffix + "</small>" : "") + "</b><span>" + label + "</span></div>";
}
