import * as store from "../store.js";
import * as M from "../model.js";
import { esc, $$ } from "../util.js";
import { icon, hue } from "../ui.js";
import { openTask, catChip } from "../sheets.js";

/* Repeating tasks: every rule with its schedule, streak and how often it actually got done lately. */
export function render(el, r, ctx) {
  const s = store.get(), today = M.todayISO();
  const rules = M.live(s.rules).sort((a, b) => (a.at || "99").localeCompare(b.at || "99") || a.title.localeCompare(b.title));
  let h = '<header class="page-h rise"><div><div class="eyebrow">Habits & routines</div><h1>Repeating</h1><p class="lead" style="margin-bottom:0">Things you do on a schedule. Each one shows up on its days automatically.</p></div>' +
    '<button class="btn primary" data-new>' + icon("plus", 16) + "New repeating task</button></header>";
  if (!rules.length) h += '<div class="empty">' + icon("repeat", 28) + "<b>No repeating tasks yet</b>Add one here, or type something like “gym 7am 45m every mon wed fri” in quick add.</div>";
  else h += '<div class="rgrid stagger">' + rules.map(rule => {
    const st = M.streak(s, rule, today), rs = M.ruleStats(s, rule, today, 30), next = M.nextOccurrence(rule, today);
    const pct = rs.due ? Math.round(100 * rs.done / rs.due) : null;
    const c = s.cats[rule.cat];
    return '<a class="rcard hued" data-rule="' + rule.id + '" style="--h:' + (c && c.hue != null ? c.hue : hue(rule.cat)) + '"><div class="rc-t"><b>' + esc(rule.title) + '</b><span class="streak' + (st ? " on" : "") + '">' + icon("flame", 14) + st + "</span></div>" +
      '<div class="tmeta">' + catChip(s, rule.cat) + "<span>" + esc(M.ruleText(rule)) + "</span><span>" + M.dur(rule.est || M.DEFAULT_EST) + "</span></div>" +
      '<div class="rc-f"><div class="bar tint"><i style="width:' + (pct || 0) + '%"></i></div><small>' + (pct == null ? "New" : rs.done + "/" + rs.due + " in the last 30 days") + " · next " + (next ? esc(M.dayLabel(next, today).toLowerCase()) : "—") + "</small></div></a>";
  }).join("") + "</div>";
  el.innerHTML = h;
  $$("[data-new]", el).forEach(b => b.onclick = () => openTask(ctx, { defaults: { day: today, repeat: { freq: "daily", days: [] } } }));
  $$("[data-rule]", el).forEach(a => a.onclick = e => { e.preventDefault(); openTask(ctx, { rule: a.dataset.rule }); });
}
