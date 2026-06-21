import { db } from "./firebase.js";
import { collection, doc, setDoc, getDocs, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { showToast } from "./ui.js";

export function subscribeLogs(uid, callback) {
  return onSnapshot(collection(db, "users", uid, "logs"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function saveLog(uid, logData, logId) {
  const ref = logId
    ? doc(db, "users", uid, "logs", logId)
    : doc(collection(db, "users", uid, "logs"));
  await setDoc(ref, logData);
}

export async function clearLogs(uid) {
  const snap = await getDocs(collection(db, "users", uid, "logs"));
  for (const d of snap.docs) await deleteDoc(d.ref);
}

export function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function today() { return dateStr(new Date()); }

export function formatDate(str) {
  const [y, m, d] = str.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const days   = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const date   = new Date(y, m-1, d);
  const t      = today();
  if (str === t) return "Hoy";
  const yest = new Date(); yest.setDate(yest.getDate()-1);
  if (str === dateStr(yest)) return "Ayer";
  return `${days[date.getDay()]} ${d} ${months[m-1]}`;
}
