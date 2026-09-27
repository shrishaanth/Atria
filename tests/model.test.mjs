// Run: node tests/model.test.mjs   (plain node, no dependencies)
import * as M from "../js/model.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log("FAIL", name, "\n   got ", JSON.stringify(got), "\n   want", JSON.stringify(want));
};

const today = "2026-09-26";                       // a Saturday
const s = M.emptyState();
const at = (date, h, m = 0) => new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8), h, m).getTime();

/* ---- quick add parser */
const p = t => { const r = M.parseQuick(t, s, today); return [r.title, r.cat || r.newCat, r.est, r.day, r.part, r.at, r.repeat && r.repeat.freq, r.repeat && r.repeat.days]; };
eq("full", p("gym 6pm 45m #health"), ["gym", "health", 45, today, null, "18:00", null, null]);
eq("tomorrow morning 2h", p("study 2h tomorrow morning #study"), ["study", "study", 120, "2026-09-27", "morning", null, null, null]);
eq("1h30m + 24h time", p("deep work 1h30m at 14:30"), ["deep work", null, 90, today, null, "14:30", null, null]);
eq("1.5h", p("read 1.5h"), ["read", null, 90, today, null, null, null, null]);
eq("inbox", p("renew passport inbox 20 min"), ["renew passport", null, 20, null, null, null, null, null]);
eq("weekday name", p("call mom mon"), ["call mom", null, null, "2026-09-28", null, null, null, null]);
eq("every mon wed fri", p("gym 7am every mon, wed and fri"), ["gym", null, null, today, null, "07:00", "custom", [1, 3, 5]]);
eq("weekdays", p("standup 9:30am weekdays 15m #work"), ["standup", "work", 15, today, null, "09:30", "weekdays", []]);
eq("daily tonight", p("journal daily tonight 10m"), ["journal", null, 10, today, "evening", null, "daily", []]);
eq("new category", p("laundry #house"), ["laundry", "house", null, today, null, null, null, null]);
eq("cat prefix match", p("slides #wor"), ["slides", "work", null, today, null, null, null, null]);
eq("@3 means afternoon", p("coffee @3"), ["coffee", null, null, today, null, "15:00", null, null]);
eq("empty title", p("30m"), ["Untitled", null, 30, today, null, null, null, null]);

/* ---- recurrence */
const rule = { id: "g", title: "Gym", cat: "health", est: 45, part: "morning", at: null, freq: "custom", days: [1, 3, 5], start: "2026-09-21", end: null, skip: {} };
s.rules.g = rule;
const occ = M.materialize(s, "2026-09-21", "2026-09-27", at(today, 9));
eq("occurrences Mon/Wed/Fri", occ.map(t => t.day), ["2026-09-21", "2026-09-23", "2026-09-25"]);
eq("deterministic ids", occ.map(t => t.id), ["r_g_2026-09-21", "r_g_2026-09-23", "r_g_2026-09-25"]);
for (const t of occ) s.tasks[t.id] = t;
eq("idempotent", M.materialize(s, "2026-09-21", "2026-09-27").length, 0);
s.tasks["r_g_2026-09-23"] = { id: "r_g_2026-09-23", del: true };
eq("tombstone never recreated", M.materialize(s, "2026-09-21", "2026-09-27").length, 0);
s.tasks["r_g_2026-09-23"] = Object.assign({}, occ[1]);
eq("weekdays rule", ["2026-09-25", "2026-09-26", "2026-09-28"].map(d => M.ruleOccurs({ freq: "weekdays", start: "2026-01-01" }, d)), [true, false, true]);
eq("skip date", M.ruleOccurs({ freq: "daily", start: "2026-01-01", skip: { [today]: true } }, today), false);
eq("ended rule", M.ruleOccurs({ freq: "daily", start: "2026-01-01", end: "2026-09-25" }, today), false);
eq("next occurrence", M.nextOccurrence(rule, today), "2026-09-28");

/* ---- streaks: Mon done, Wed done, Fri done -> 3; Fri missed -> 0 */
for (const d of ["2026-09-21", "2026-09-23", "2026-09-25"]) Object.assign(s.tasks["r_g_" + d], { done: true, doneAt: at(d, 10) });
eq("streak 3", M.streak(s, rule, today), 3);
s.tasks["r_g_2026-09-25"].done = false;
eq("streak broken", M.streak(s, rule, today), 0);
eq("rule stats", M.ruleStats(s, rule, today, 30), { due: 3, done: 2 });

/* ---- day capacity and the "doesn't fit" check */
const s2 = M.emptyState();                       // 07:00-23:00, 15% buffer
const now = at(today, 20, 0);                    // 8 pm: 3h left, 2h33m after buffer
s2.tasks.a = M.makeTask({ id: "a", title: "A", est: 60, day: today });
s2.tasks.b = M.makeTask({ id: "b", title: "B", est: 90, day: today });
let L = M.dayLoad(s2, today, now);
eq("capacity after buffer", Math.round(L.cap), 153);
eq("fits", L.over, 0);
s2.tasks.c = M.makeTask({ id: "c", title: "C", est: 45, day: today });
L = M.dayLoad(s2, today, now);
eq("over by 42m", Math.round(L.over), 42);
eq("future day capacity", Math.round(M.dayLoad(s2, "2026-09-27", now).cap), Math.round(16 * 60 * 0.85));
eq("past day never over", M.dayLoad(s2, "2026-09-25", now).over, 0);

/* ---- remaining / overrun: tracked 70m on a 60m task */
s2.tasks.a.sessions = [{ s: now - 70 * 60000, e: now }];
eq("remaining after overrun", M.remaining(s2.tasks.a, now), 6);
eq("remaining normal", M.remaining(s2.tasks.b, now), 90);
s2.tasks.a.done = true;
eq("done needs nothing", M.remaining(s2.tasks.a, now), 0);

/* ---- timeline layout: fixed task blocks its slot, flexible tasks flow around it from "now" */
const s3 = M.emptyState(), n3 = at(today, 13, 2);
s3.tasks.f = M.makeTask({ id: "f", title: "Meeting", est: 30, day: today, at: "14:00" });
s3.tasks.x = M.makeTask({ id: "x", title: "X", est: 60, day: today, part: "afternoon", order: 1 });
s3.tasks.y = M.makeTask({ id: "y", title: "Y", est: 30, day: today, part: "afternoon", order: 2 });
const lay = M.layoutDay(s3, today, n3);
const pos = Object.fromEntries(lay.blocks.map(b => [b.task.id, [M.toHM(b.start), M.toHM(b.end)]]));
eq("fixed at 14:00", pos.f, ["14:00", "14:30"]);
eq("x after meeting (no overlap)", pos.x, ["14:30", "15:30"]);
eq("y fills first free gap from now", pos.y, ["13:05", "13:35"]);

/* ---- learning */
const s4 = M.emptyState();
[[60, 90], [30, 45], [40, 60], [20, 20]].forEach(([est, act], i) => {
  s4.tasks["t" + i] = M.makeTask({ id: "t" + i, cat: "study", est, done: true, doneAt: 1000 + i, sessions: [{ s: 0, e: act * 60000 }] });
});
const fs = M.factors(s4);
eq("median factor", fs.study, { f: 1.5, n: 4 });
eq("suggestion", M.suggest(s4, "study", 60, fs), { est: 90, f: 1.5, n: 4 });
eq("no suggestion w/o data", M.suggest(s4, "work", 60, fs), null);

/* ---- merge keeps newest per entity, tombstones win if newer */
const A = M.emptyState(), B = M.emptyState();
A.tasks.k = { id: "k", title: "old", t: 1 }; B.tasks.k = { id: "k", title: "new", t: 2 };
A.tasks.d = { id: "d", title: "alive", t: 5 }; B.tasks.d = { id: "d", del: true, t: 9 };
const Mx = M.mergeStates(A, B);
eq("newest wins", Mx.tasks.k.title, "new");
eq("delete wins when newer", Mx.tasks.d.del, true);

/* ---- formatting */
eq("dur", [M.dur(45), M.dur(60), M.dur(95)], ["45m", "1h", "1h 35m"]);
eq("clock", [M.clock(420), M.clock(870), M.clock(0)], ["7 am", "2:30 pm", "12 am"]);
eq("no :60 when rounding", [M.clock(779.7), M.toHM(779.7)], ["1 pm", "13:00"]);


/* ---- tasks spanning parts of the day */
eq("span morning to afternoon", p("project 5h morning to afternoon")[4], "morning-afternoon");
eq("span all day", p("hackathon 8h all day")[4], "morning-evening");
eq("span normalises", M.makeSpan(["evening", "morning"]), "morning-evening");
eq("span range", M.partRange(M.emptyState().settings, "morning-afternoon").map(M.toHM), ["07:00", "17:00"]);
eq("span label", M.partLabel("morning-afternoon"), "Morning – Afternoon");
const s5 = M.emptyState(), n5 = at("2026-09-27", 6, 0);
s5.tasks.big = M.makeTask({ id: "big", title: "Big", est: 300, day: "2026-09-27", part: "morning-afternoon" });
s5.tasks.one = M.makeTask({ id: "one", title: "One", est: 300, day: "2026-09-27", part: "morning" });
const l5 = Object.fromEntries(M.layoutDay(s5, "2026-09-27", n5).blocks.map(b => [b.task.id, !!b.spill]));
eq("5h spanning task does not spill", l5.big, false);
eq("5h morning-only task spills", l5.one, true);
eq("span listed under its first part", M.sectionOf(s5.tasks.big, s5.settings), "morning");

console.log(fail ? "\n" + fail + " FAILED, " + pass + " passed" : "all " + pass + " tests passed");
process.exit(fail ? 1 : 0);
