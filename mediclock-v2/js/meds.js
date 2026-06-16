import { db } from "./firebase.js";
import { collection, doc, setDoc, getDocs, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { showToast } from "./ui.js";

// ── BASE DE MEDICAMENTOS COLOMBIA ─────────────────────────────────────────
export const MED_DB = [
  { name: "Acetaminofén", doses: ["500mg", "1000mg"], notes: "Cada 6-8 horas. Máximo 4g/día.", emoji: "💊", color: "blue" },
  { name: "Ácido fólico", doses: ["1mg", "5mg"], notes: "Con o sin alimentos.", emoji: "🟡", color: "orange" },
  { name: "Amlodipino", doses: ["5mg", "10mg"], notes: "Una vez al día, preferiblemente en la mañana.", emoji: "💊", color: "green" },
  { name: "Aspirina", doses: ["100mg", "500mg"], notes: "Con alimentos para evitar irritación gástrica.", emoji: "💊", color: "red" },
  { name: "Atorvastatina", doses: ["10mg", "20mg", "40mg"], notes: "Preferiblemente en la noche.", emoji: "💊", color: "purple" },
  { name: "Azitromicina", doses: ["500mg"], notes: "Una vez al día. Con o sin alimentos.", emoji: "💊", color: "blue" },
  { name: "Bisoprolol", doses: ["2.5mg", "5mg", "10mg"], notes: "En la mañana con o sin alimentos.", emoji: "❤️", color: "red" },
  { name: "Calcio + Vitamina D", doses: ["600mg/400UI"], notes: "Con las comidas.", emoji: "🦴", color: "orange" },
  { name: "Captopril", doses: ["25mg", "50mg"], notes: "30 minutos antes de las comidas.", emoji: "💊", color: "green" },
  { name: "Carvedilol", doses: ["6.25mg", "12.5mg", "25mg"], notes: "Con alimentos.", emoji: "❤️", color: "red" },
  { name: "Clonazepam", doses: ["0.5mg", "1mg", "2mg"], notes: "Puede causar somnolencia.", emoji: "💊", color: "purple" },
  { name: "Clopidogrel", doses: ["75mg"], notes: "Con o sin alimentos.", emoji: "💊", color: "red" },
  { name: "Enalapril", doses: ["5mg", "10mg", "20mg"], notes: "Puede tomarse con o sin alimentos.", emoji: "❤️", color: "green" },
  { name: "Espironolactona", doses: ["25mg", "50mg"], notes: "Con alimentos.", emoji: "💊", color: "blue" },
  { name: "Furosemida", doses: ["20mg", "40mg"], notes: "En la mañana. Puede aumentar micción.", emoji: "💊", color: "orange" },
  { name: "Glibenclamida", doses: ["5mg"], notes: "30 minutos antes del desayuno.", emoji: "🩸", color: "blue" },
  { name: "Hidroclorotiazida", doses: ["12.5mg", "25mg"], notes: "En la mañana con alimentos.", emoji: "💊", color: "green" },
  { name: "Ibuprofeno", doses: ["200mg", "400mg", "600mg"], notes: "Con alimentos. Evitar en ayunas.", emoji: "💊", color: "orange" },
  { name: "Insulina glargina", doses: ["10 UI", "20 UI"], notes: "Misma hora cada día. Rotar sitio.", emoji: "💉", color: "blue" },
  { name: "Levotiroxina", doses: ["25mcg", "50mcg", "75mcg", "100mcg"], notes: "En ayunas, 30 min antes del desayuno.", emoji: "🦋", color: "purple" },
  { name: "Lisinopril", doses: ["5mg", "10mg", "20mg"], notes: "Con o sin alimentos.", emoji: "❤️", color: "green" },
  { name: "Loratadina", doses: ["10mg"], notes: "Una vez al día.", emoji: "💊", color: "blue" },
  { name: "Losartán", doses: ["25mg", "50mg", "100mg"], notes: "Con o sin alimentos.", emoji: "❤️", color: "red" },
  { name: "Metformina", doses: ["500mg", "850mg", "1000mg"], notes: "Con las comidas para reducir molestias.", emoji: "🩸", color: "blue" },
  { name: "Metoprolol", doses: ["25mg", "50mg", "100mg"], notes: "Con o sin alimentos.", emoji: "❤️", color: "red" },
  { name: "Naproxeno", doses: ["250mg", "500mg"], notes: "Con alimentos o leche.", emoji: "💊", color: "orange" },
  { name: "Omeprazol", doses: ["10mg", "20mg", "40mg"], notes: "30 minutos antes del desayuno.", emoji: "💊", color: "purple" },
  { name: "Pantoprazol", doses: ["20mg", "40mg"], notes: "30 minutos antes de comer.", emoji: "💊", color: "purple" },
  { name: "Prednisona", doses: ["5mg", "20mg", "50mg"], notes: "Con alimentos en la mañana.", emoji: "💊", color: "orange" },
  { name: "Ramipril", doses: ["2.5mg", "5mg", "10mg"], notes: "Con o sin alimentos.", emoji: "❤️", color: "green" },
  { name: "Rosuvastatina", doses: ["5mg", "10mg", "20mg"], notes: "A cualquier hora del día.", emoji: "💊", color: "purple" },
  { name: "Salmeterol", doses: ["25mcg", "50mcg"], notes: "Inhalador. Agitar antes de usar.", emoji: "🫁", color: "blue" },
  { name: "Salbutamol", doses: ["100mcg"], notes: "Inhalador de rescate. Según necesidad.", emoji: "🫁", color: "blue" },
  { name: "Simvastatina", doses: ["10mg", "20mg", "40mg"], notes: "En la noche.", emoji: "💊", color: "purple" },
  { name: "Telmisartán", doses: ["40mg", "80mg"], notes: "Con o sin alimentos.", emoji: "❤️", color: "red" },
  { name: "Tramadol", doses: ["50mg", "100mg"], notes: "Puede causar somnolencia.", emoji: "💊", color: "orange" },
  { name: "Valsartán", doses: ["80mg", "160mg"], notes: "Con o sin alimentos.", emoji: "❤️", color: "red" },
  { name: "Vitamina B12", doses: ["500mcg", "1000mcg"], notes: "Con o sin alimentos.", emoji: "🟡", color: "orange" },
  { name: "Vitamina C", doses: ["500mg", "1000mg"], notes: "Con las comidas.", emoji: "🍊", color: "orange" },
  { name: "Vitamina D3", doses: ["400UI", "1000UI", "2000UI"], notes: "Con la comida principal.", emoji: "☀️", color: "orange" },
  { name: "Warfarina", doses: ["1mg", "2.5mg", "5mg"], notes: "Misma hora cada día. Evitar cambios en dieta.", emoji: "💊", color: "red" },
];

// ── CRUD FIRESTORE ────────────────────────────────────────────────────────
export async function saveMed(uid, data, id = null) {
  const ref = id
    ? doc(db, "users", uid, "meds", id)
    : doc(collection(db, "users", uid, "meds"));
  await setDoc(ref, { ...data, updatedAt: Date.now() });
  return ref.id;
}

export async function deleteMed(uid, id) {
  await deleteDoc(doc(db, "users", uid, "meds", id));
  const logsSnap = await getDocs(collection(db, "users", uid, "logs"));
  for (const d of logsSnap.docs) {
    if (d.data().medId === id) await deleteDoc(d.ref);
  }
}

export function subscribeMeds(uid, callback) {
  return onSnapshot(collection(db, "users", uid, "meds"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
