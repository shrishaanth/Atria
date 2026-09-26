import * as store from "../store.js";
import * as M from "../model.js";
import { esc, $, $$ } from "../util.js";
import { icon, hue, getTheme, setTheme } from "../ui.js";
import { choose } from "../sheets.js";

export function render(el, r, ctx) {
  const draw = () => {
    const s = store.get(), st = s.settings, t = getTheme();
    const cats = M.live(s.cats).sort((a, b) => (a.order || 0) - (b.order || 0));
    let h = '<header class="page-h rise"><div><h1>Settings</h1></div></header>';
    h += '<div class="card"><div class="card-h">' + icon("clock", 18) + '<b>Your day</b></div><p class="small muted" style="margin:6px 0 4px">Atria plans inside these hours and splits them into morning, afternoon and evening.</p>' +
      '<div class="hours">' + [["dayStart", "Day starts"], ["noon", "Afternoon from"], ["evening", "Evening from"], ["dayEnd", "Day ends"]].map(([k, l]) => '<label><span class="field-l">' + l + '</span><input class="input" type="time" step="900" data-set="' + k + '" value="' + esc(st[k]) + '"></label>').join("") + "</div>" +
      '<label class="field-l">Buffer kept free each day: <b id="bufv">' + st.buffer + '%</b></label><input type="range" min="0" max="40" step="5" id="buf" value="' + st.buffer + '">' +
      '<p class="small muted" style="margin:6px 0 0">Spare time that nothing is planned into, so overruns don’t wreck the rest of the day.</p></div>';
    h += '<div class="card"><div class="card-h">' + icon("topics", 18) + '<b>Categories</b></div><p class="small muted" style="margin:6px 0 12px">Atria learns a separate “how long it really takes” for each.</p><div class="cats">' +
      cats.map(c => '<div class="catedit hued" style="--h:' + (c.hue != null ? c.hue : hue(c.id)) + '"><span class="lidot"></span><input class="input" data-label="' + c.id + '" value="' + esc(c.label) + '"><input type="range" min="0" max="359" data-hue="' + c.id + '" value="' + (c.hue != null ? c.hue : hue(c.id)) + '" aria-label="Colour">' +
        (c.id === "other" ? "<span></span>" : '<button class="iconbtn sm" data-delcat="' + c.id + '" aria-label="Delete">' + icon("trash", 15) + "</button>") + "</div>").join("") +
      '</div><button class="btn sm" id="addcat" style="margin-top:10px">' + icon("plus", 14) + "Add category</button></div>";
    h += '<div class="card"><div class="card-h">' + icon("sun", 18) + '<b>Appearance</b></div><div class="chips" id="themes" style="margin-top:10px">' +
      [["system", "System", "system"], ["light", "Light", "sun"], ["dark", "Dark", "moon"]].map(([k, l, ic]) => '<button class="chip' + (t === k ? " on" : "") + '" data-t="' + k + '">' + icon(ic, 14) + l + "</button>").join("") + "</div></div>";
    h += '<div class="card"><div class="card-h">' + icon("sync", 18) + '<b>Sync between devices</b></div><p class="small muted" style="margin:6px 0 0">Not set up yet. For now everything is saved in this browser only &mdash; use Backup to move it between devices.</p></div>';
    h += '<div class="card"><div class="card-h">' + icon("archive", 18) + '<b>Backup</b></div><p class="small muted" style="margin:6px 0 12px">Export everything to a file, or import one (it merges with what you have).</p><div class="row"><button class="btn sm" id="exp">Export</button><label class="btn sm" style="cursor:pointer">Import<input type="file" id="imp" accept="application/json" hidden></label></div></div>';
    h += '<div class="card danger"><div class="card-h">' + icon("alert", 18) + '<b>Reset</b></div><p class="small muted" style="margin:6px 0 12px">Erase all tasks, repeating tasks and history on this device.</p><button class="btn sm danger" id="reset">Erase everything</button></div>';
    el.innerHTML = h;

    $$("[data-set]", el).forEach(i => i.onchange = () => {
      const v = i.value; if (!v) return;
      const next = Object.assign({}, store.get().settings, { [i.dataset.set]: v });
      const w = M.windowOf(next);
      if (!(w.start < w.noon && w.noon < w.eve && w.eve < w.end)) { ctx.toast("Times must go in order: start, afternoon, evening, end."); draw(); return; }
      store.commit(x => { x.settings = Object.assign(next, { t: Date.now() }); });
      ctx.toast("Saved.");
    });
    const buf = $("#buf", el);
    buf.oninput = () => { $("#bufv", el).textContent = buf.value + "%"; };
    buf.onchange = () => store.commit(x => { x.settings = Object.assign({}, x.settings, { buffer: +buf.value, t: Date.now() }); });
    $$("[data-label]", el).forEach(i => i.onchange = () => { const v = i.value.trim(); if (!v) return draw(); store.commit(x => { Object.assign(x.cats[i.dataset.label], { label: v, t: Date.now() }); }); });
    $$("[data-hue]", el).forEach(i => {
      i.oninput = () => i.closest(".catedit").style.setProperty("--h", i.value);
      i.onchange = () => store.commit(x => { Object.assign(x.cats[i.dataset.hue], { hue: +i.value, t: Date.now() }); });
    });
    $$("[data-delcat]", el).forEach(b => b.onclick = async () => {
      const id = b.dataset.delcat, n = M.live(store.get().tasks).filter(t => t.cat === id).length + M.live(store.get().rules).filter(r2 => r2.cat === id).length;
      const ok = await choose("Delete this category?", n ? n + " task" + (n === 1 ? "" : "s") + " will move to “Other”." : "", [{ label: "Delete", value: true, cls: "danger" }]);
      if (!ok) return;
      const now = Date.now();
      store.commit(x => {
        x.cats[id] = Object.assign({}, x.cats[id], { del: true, t: now });
        for (const t2 of M.live(x.tasks)) if (t2.cat === id) Object.assign(t2, { cat: "other", t: now });
        for (const r2 of M.live(x.rules)) if (r2.cat === id) Object.assign(r2, { cat: "other", t: now });
      });
      draw();
    });
    $("#addcat", el).onclick = () => {
      const now = Date.now(), id = "c" + now.toString(36);
      store.commit(x => { x.cats[id] = { id, label: "New category", hue: Math.floor(Math.random() * 360), order: now, t: now }; });
      draw();
      const i = el.querySelector('[data-label="' + id + '"]'); if (i) { i.focus(); i.select(); }
    };
    $$("#themes .chip", el).forEach(c => c.onclick = () => { setTheme(c.dataset.t); setTimeout(() => { draw(); ctx.refreshChrome(); }, 20); });
    $("#exp", el).onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([store.exportJSON()], { type: "application/json" }));
      a.download = "atria-backup-" + M.todayISO() + ".json"; a.click();
    };
    $("#imp", el).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { store.importJSON(await f.text()); ctx.toast("Imported and merged."); } catch (err) { ctx.toast("Import failed: " + err.message, 3500); }
    };
    $("#reset", el).onclick = async () => {
      const ok = await choose("Erase everything?", "This can’t be undone. Export a backup first if you might want it.", [{ label: "Erase everything", value: true, cls: "danger" }]);
      if (ok) { store.resetAll(); ctx.toast("Everything erased."); }
    };
  };
  draw();
}
