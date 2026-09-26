/* Optional cloud sync: Firebase Google sign-in + one Firestore document per user.
   Atria works fully offline; this only merges your data between devices (newest change per item wins,
   deletes are tombstones so they never come back). */
import * as store from "./store.js";
import { mergeStates } from "./model.js";

const CFG = {
  apiKey: "AIzaSyBZd2jlBwm4hDGOR-KhS95jJwb9x5-uUXQ",
  authDomain: "atria-4a846.firebaseapp.com",
  projectId: "atria-4a846",
  storageBucket: "atria-4a846.firebasestorage.app",
  messagingSenderId: "688516404465",
  appId: "1:688516404465:web:326a24bbb56e0c5eda4550",
};
const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
const FLAG = "atria-signed-in";

let fb = null, user = null, timer = null, busy = false, again = false;
export const status = { user: null, error: "", syncing: false, last: 0 };
const listeners = new Set();
export const onStatus = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach(fn => fn(status));

async function ensure() {
  if (fb) return fb;
  const [app, auth, fs] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")]);
  const a = app.initializeApp(CFG);
  fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), A: auth, F: fs };
  fb.A.onAuthStateChanged(fb.auth, u => {
    user = u;
    status.user = u ? { name: u.displayName || u.email, email: u.email, photo: u.photoURL } : null;
    try { if (u) localStorage.setItem(FLAG, "1"); else localStorage.removeItem(FLAG); } catch (e) { /* ignore */ }
    emit();
    if (u) syncNow();
  });
  return fb;
}

/* Only touches the network on load if you signed in on this device before. */
export function autoStart() {
  let was = false;
  try { was = !!localStorage.getItem(FLAG); } catch (e) { /* ignore */ }
  if (was) ensure().catch(e => { status.error = String(e.message || e); emit(); });
}

export async function signIn() {
  status.error = ""; emit();
  try {
    const { auth, A } = await ensure();
    await A.signInWithPopup(auth, new A.GoogleAuthProvider());
  } catch (e) {
    const c = e && e.code;
    status.error = c === "auth/popup-blocked" ? "The browser blocked the sign-in pop-up. Allow pop-ups for this site and try again."
      : c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request" ? ""
      : c === "auth/unauthorized-domain" ? "This site isn't authorised in Firebase yet (Authentication → Settings → Authorized domains)."
      : "Sign-in failed: " + (e.message || e);
    emit();
  }
}
export async function signOut() {
  if (!fb) return;
  await fb.A.signOut(fb.auth);
  emit();
}

const ref = () => fb.F.doc(fb.db, "users", user.uid, "data", "atria");

export async function syncNow() {
  if (!user) return;
  if (busy) { again = true; return; }
  busy = true; status.syncing = true; status.error = ""; emit();
  try {
    const snap = await fb.F.getDoc(ref());
    const remote = snap.exists() ? JSON.parse(snap.data().blob) : null;
    const local = store.get();
    const merged = mergeStates(local, remote);
    const text = JSON.stringify(merged);
    if (text !== JSON.stringify(local)) store.replace(merged, "remote");           // only re-render when something came in
    if (!remote || text !== JSON.stringify(mergeStates(remote, null))) await fb.F.setDoc(ref(), { blob: text, updated: fb.F.serverTimestamp(), v: 1 });
    status.last = Date.now();
  } catch (e) {
    status.error = e && e.code === "permission-denied" ? "Sync was refused — check the Firestore rules." : "Sync failed: " + (e.message || e);
  } finally {
    busy = false; status.syncing = false; emit();
    if (again) { again = false; syncNow(); }
  }
}

/* Push a few seconds after local changes; pull again whenever the app comes back into view. */
export function scheduleSync() { if (!user) return; clearTimeout(timer); timer = setTimeout(syncNow, 3000); }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && user) syncNow(); });
