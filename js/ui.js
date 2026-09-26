/* Shared UI helpers: icons, category colours, progress rings, count-ups, confetti and the theme switch. */

const PATHS = {
  today: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  plan: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
  topics: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  materials: '<path d="M2 5.5A1.5 1.5 0 0 1 3.5 4H9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5h-6A1.5 1.5 0 0 1 2 16Z"/><path d="M22 5.5A1.5 1.5 0 0 0 20.5 4H15a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5h6a1.5 1.5 0 0 0 1.5-1.5Z"/>',
  week: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  insights: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  play: '<path d="M7 4v16l13-8Z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  chevl: '<path d="m15 18-6-6 6-6"/>',
  chevr: '<path d="m9 18 6-6-6-6"/>',
  sunrise: '<path d="M12 2v4M4.9 8.9l1.4 1.4M2 16h2M20 16h2M17.7 10.3l1.4-1.4M18 16a6 6 0 0 0-12 0M2 20h20"/>',
  sunset: '<path d="M12 10V6M4.9 8.9l1.4 1.4M2 16h2M20 16h2M17.7 10.3l1.4-1.4M18 16a6 6 0 0 0-12 0M2 20h20M9 7l3 3 3-3"/>',
  dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  tomorrow: '<path d="M5 12h14M13 6l6 6-6 6"/><path d="M5 6v12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
  system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-7 0-3-1.6-5.3-3.2-7-.4 1.6-1.4 2.8-2.8 3.2C13.6 7.6 12 4.6 9 2c.3 3-1 5.2-2.6 7.1C5 10.8 5 12.6 5 15c0 4.3 3 7 7 7Z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
  code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 6V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.1M12 17h.01"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 22h14"/>',
  sync: '<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M21 4v5h-5M3 20v-5h5"/>',
  skip: '<path d="m5 4 10 8-10 8V4ZM19 5v14"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  sparkle: '<path d="M12 3c.4 4.3 1.9 5.9 6 6.5-4.1.6-5.6 2.2-6 6.5-.4-4.3-1.9-5.9-6-6.5 4.1-.6 5.6-2.2 6-6.5Z"/><path d="M19 15c.2 1.8.8 2.5 2.5 2.8-1.7.3-2.3 1-2.5 2.8-.2-1.8-.8-2.5-2.5-2.8 1.7-.3 2.3-1 2.5-2.8Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
};

export const icon = (name, size = 18) =>
  '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || "") + "</svg>";

/* Named hues (oklch angle) for the default categories; anything else gets a stable hash hue. */
const HUES = { study: 270, work: 245, health: 150, errands: 75, personal: 340, chores: 40, other: 215 };
export function hue(id) {
  if (HUES[id] != null) return HUES[id];
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Circular progress; the stroke draws itself in when the view first appears (CSS). */
export function ring(frac, { size = 64, stroke = 7, label = "", sub = "", cls = "" } = {}) {
  const f = Math.max(0, Math.min(1, frac || 0));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - f), mid = size / 2;
  return '<div class="ring ' + cls + (f === 0 ? " zero" : "") + '" style="--size:' + size + 'px">' +
    '<svg viewBox="0 0 ' + size + " " + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    '<circle class="trk" cx="' + mid + '" cy="' + mid + '" r="' + r + '" stroke-width="' + stroke + '"/>' +
    '<circle class="val" cx="' + mid + '" cy="' + mid + '" r="' + r + '" stroke-width="' + stroke + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '" style="--c:' + c.toFixed(2) + '"/></svg>' +
    (label !== "" ? '<div class="ring-l"><b>' + label + "</b>" + (sub ? "<span>" + sub + "</span>" : "") + "</div>" : "") + "</div>";
}

/* Numbers marked data-count tick up from zero when a page first appears. */
export function countUps(root) {
  if (reduced()) return;
  for (const el of root.querySelectorAll("[data-count]")) {
    const to = +el.dataset.count;
    if (!to || !isFinite(to)) continue;
    const t0 = performance.now(), dur = 650 + Math.min(500, to * 8);
    el.textContent = "0";
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(to * e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

/* Bars rendered with data-to glide from their previous width to the new one. */
export function settle(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const el of root.querySelectorAll("[data-to]")) el.style.width = el.dataset.to;
  }));
}

export function confetti({ x = innerWidth / 2, y = innerHeight * 0.35, n = 70 } = {}) {
  if (reduced()) return;
  const colors = ["#6d5ef7", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#f43f5e", "#a3e635"];
  const box = document.createElement("div");
  box.className = "confetti";
  document.body.appendChild(box);
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.style.background = colors[i % colors.length];
    p.style.left = x + "px"; p.style.top = y + "px";
    if (i % 3 === 0) p.style.borderRadius = "50%";
    box.appendChild(p);
    const a = Math.random() * Math.PI * 2, v = 140 + Math.random() * 280;
    const dx = Math.cos(a) * v, dy = Math.sin(a) * v - 180, rot = (Math.random() - 0.5) * 900;
    p.animate([
      { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
      { transform: "translate(" + dx * 0.6 + "px," + dy * 0.6 + "px) rotate(" + rot * 0.5 + "deg)", opacity: 1, offset: 0.35 },
      { transform: "translate(" + dx + "px," + (dy + 420) + "px) rotate(" + rot + "deg)", opacity: 0 },
    ], { duration: 1200 + Math.random() * 700, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" });
  }
  setTimeout(() => box.remove(), 2100);
}

/* ---- theme: "system" follows the OS, "light"/"dark" pin it */
const TKEY = "atria-theme";
export function getTheme() { try { return localStorage.getItem(TKEY) || "system"; } catch (e) { return "system"; } }
function applyTheme(t) {
  try { localStorage.setItem(TKEY, t); } catch (e) { /* private mode */ }
  const root = document.documentElement;
  if (t === "system") delete root.dataset.theme; else root.dataset.theme = t;
  syncThemeColor();
}
export function setTheme(t) {
  if (!document.startViewTransition || reduced() || document.hidden) return applyTheme(t);
  document.documentElement.classList.add("vt-theme");
  const vt = document.startViewTransition(() => applyTheme(t));
  vt.ready.catch(() => {});
  vt.finished.catch(() => {}).finally(() => document.documentElement.classList.remove("vt-theme"));
}
export function cycleTheme() {
  const order = ["system", "light", "dark"];
  setTheme(order[(order.indexOf(getTheme()) + 1) % order.length]);
}
export function syncThemeColor() {
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#f6f6f4";
}
