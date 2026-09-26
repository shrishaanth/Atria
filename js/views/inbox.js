import * as store from "../store.js";
import * as M from "../model.js";
import * as A from "../actions.js";
import { esc, $, $$ } from "../util.js";
import { icon } from "../ui.js";
import { openTask, catChip } from "../sheets.js";

/* Tasks without a day: a place to dump things, then plan them onto days when you're ready. */
export function render(el, r, ctx) {
  const s = store.get(), today = M.todayISO();
  const items = M.inboxTasks(s).sort((a, b) => (b.order || 0) - (a.order || 0));
  let h = '<header class="page-h rise"><div><div class="eyebrow">Unscheduled</div><h1>Inbox</h1><p class="lead" style="margin-bottom:0">Dump anything here without deciding when. Plan it onto a day when you’re ready.</p></div></header>';
  h += '<label class="findw qa-inline">' + icon("plus", 16) + '<input class="find" id="ib-add" placeholder="Add to inbox — e.g. “renew passport 30m #errands”" autocomplete="off"></label>';
  if (!items.length) h += '<div class="empty">' + icon("inbox", 28) + "<b>Inbox zero</b>Nothing waiting to be planned.</div>";
  else h += '<div class="list ib stagger">' + items.map(t => '<div class="ibrow"><div class="tmain" data-edit="' + t.id + '"><b>' + esc(t.title) + '</b><div class="tmeta">' + catChip(s, t.cat) + "<span>" + M.dur(t.est || M.DEFAULT_EST) + "</span>" + (t.notes ? '<span class="rep">' + icon("edit", 12) + "</span>" : "") + "</div></div>" +
    '<div class="row" style="gap:4px"><button class="btn sm" data-to="' + t.id + '" data-day="' + today + '">Today</button><button class="btn sm ghost" data-to="' + t.id + '" data-day="' + M.addDays(today, 1) + '">Tomorrow</button><button class="iconbtn sm" data-edit="' + t.id + '" aria-label="More">' + icon("dots", 16) + "</button></div></div>").join("") + "</div>";
  el.innerHTML = h;
  const inp = $("#ib-add", el);
  inp.onkeydown = e => {
    if (e.key !== "Enter" || !inp.value.trim()) return;
    const p = M.parseQuick(inp.value + (/\b(today|tomorrow|tmr|mon|tue|wed|thu|fri|sat|sun)/i.test(inp.value) ? "" : " inbox"), s, today);
    const cat = p.cat || (p.newCat ? A.ensureCat(p.newCat) : "other");
    A.create({ title: p.title, cat, est: p.est || M.DEFAULT_EST, day: p.day, part: p.at ? null : p.part, at: p.at, repeat: p.repeat });
    ctx.toast(p.day ? "Added to " + M.dayLabel(p.day, today).toLowerCase() + "." : "Added to inbox.");
    ctx.rerender();
    setTimeout(() => { const i = document.getElementById("ib-add"); if (i) i.focus(); }, 30);
  };
  $$("[data-to]", el).forEach(b => b.onclick = () => { A.moveTo(b.dataset.to, b.dataset.day); ctx.toast("Planned for " + M.dayLabel(b.dataset.day, today).toLowerCase() + "."); ctx.rerender(); });
  $$("[data-edit]", el).forEach(b => b.onclick = () => openTask(ctx, { task: b.dataset.edit }));
}
