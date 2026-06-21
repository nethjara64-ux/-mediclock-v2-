import { auth, db } from "./firebase.js";
import { loginGoogle, logout, onAuth } from "./auth.js";
import { MED_DB, saveMed, deleteMed, subscribeMeds } from "./meds.js";
import { subscribeLogs, saveLog, clearLogs, today, formatDate } from "./today.js";
import { showToast, switchTab, openOverlay, closeOverlay, startClock } from "./ui.js";
import { initFeedback } from "./feedback.js";
import { collection, doc, setDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ── STATE ──────────────────────────────────────────────────────────────────
let currentUser = null;
let meds = [];
let logs = [];
let editingId = null;
let pendingTimes = [];
let historyFilter = "all";
let alerted = new Set();
let unsubMeds = null;
let unsubLogs = null;

// ── AUTH ───────────────────────────────────────────────────────────────────
window.loginGoogle = loginGoogle;

window.showUserMenu = () => {
  if (confirm(`¿Cerrar sesión de ${currentUser.displayName}?`)) {
    if (unsubMeds) unsubMeds();
    if (unsubLogs) unsubLogs();
    logout();
  }
};

onAuth(user => {
  document.getElementById("loadingScreen").style.display = "none";
  if (user) {
    currentUser = user;
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appScreen").style.display = "block";
    const av = document.getElementById("userAvatar");
    if (user.photoURL) av.innerHTML = `<img src="${user.photoURL}" alt="">`;
    else av.textContent = user.displayName?.[0] || "?";
    document.getElementById("userName").textContent = user.displayName?.split(" ")[0] || "Usuario";
    subscribeData();
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  } else {
    currentUser = null;
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("appScreen").style.display = "none";
    meds = []; logs = [];
  }
});

function subscribeData() {
  const uid = currentUser.uid;
  unsubMeds = subscribeMeds(uid, data => { meds = data; renderAll(); });
  unsubLogs = subscribeLogs(uid, data => { logs = data; renderAll(); });
}

// ── CLOCK & ALERTS ─────────────────────────────────────────────────────────
startClock(now => {
  if (!currentUser) return;
  const td = today();
  const hh = String(now.getHours()).padStart(2,"0");
  const mm = String(now.getMinutes()).padStart(2,"0");
  const timeNow = `${hh}:${mm}`;
  meds.filter(m => m.active).forEach(med => {
    med.times.forEach(t => {
      const key = `${td}-${med.id}-${t}`;
      if (t === timeNow && !alerted.has(key)) {
        const already = logs.find(l => l.medId===med.id && l.date===td && l.time===t);
        if (!already) {
          alerted.add(key);
          showToast(`⏰ Hora de tu medicamento`, `${med.emoji} ${med.name} — ${med.dose}`, "alert");
          if (Notification.permission === "granted") {
            new Notification(`⏰ ${med.name}`, { body: `Es hora de tomar ${med.dose}` });
          }
          renderToday();
        }
      }
    });
  });
});

// ── TABS ───────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ── TODAY ──────────────────────────────────────────────────────────────────
function renderToday() {
  const td = today();
  const now = new Date();
  const nowMins = now.getHours()*60 + now.getMinutes();
  let doses = [];

  meds.filter(m => m.active).forEach(med => {
    med.times.forEach(t => {
      const [h,min] = t.split(":").map(Number);
      const tMins = h*60+min;
      const log = logs.find(l => l.medId===med.id && l.date===td && l.time===t);
      doses.push({ med, time:t, tMins, status: log ? log.status : (tMins < nowMins ? "missed" : "pending"), log });
    });
  });
  doses.sort((a,b) => a.tMins - b.tMins);

  const taken   = doses.filter(d => d.status==="taken").length;
  const missed  = doses.filter(d => d.status==="missed").length;
  const pending = doses.filter(d => d.status==="pending").length;
  const total   = doses.length || 1;

  document.getElementById("statTaken").textContent   = taken;
  document.getElementById("statPending").textContent = pending;
  document.getElementById("statMissed").textContent  = missed;
  document.getElementById("progressTaken").style.width = `${Math.round(taken/total*100)}%`;

  const banners = doses.filter(d => d.status==="pending" && Math.abs(d.tMins-nowMins)<=5);
  document.getElementById("alertBanners").innerHTML = banners.map(d => `
    <div class="alert-banner">
      <div class="alert-banner-icon">${d.med.emoji}</div>
      <div class="alert-banner-info">
        <div class="alert-banner-title">¡Hora de ${d.med.name}!</div>
        <div class="alert-banner-sub">${d.med.dose} · ${d.time}</div>
      </div>
      <button class="btn-take-now" onclick="markDose('${d.med.id}','${d.time}','taken')">Tomé ✓</button>
    </div>`).join("");

  const el = document.getElementById("todayList");
  if (!doses.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><h3>Sin medicamentos hoy</h3><p>Agrega tus medicamentos en la pestaña "Medicamentos"</p></div>`;
    return;
  }
  el.innerHTML = doses.map(d => {
    const { status, med, time } = d;
    const sc = status==="taken"?"status-taken":status==="missed"?"status-missed":"status-pending";
    const si = status==="taken"?"✓":status==="missed"?"✕":"○";
    const actions = status==="pending"
      ? `<button class="btn-take"  onclick="markDose('${med.id}','${time}','taken')">✓ Tomé</button>
         <button class="btn-skip"  onclick="markDose('${med.id}','${time}','missed')">✕ Omitir</button>`
      : status==="missed"
      ? `<button class="btn-take" onclick="markDose('${med.id}','${time}','taken')">↩ Tomé tarde</button>` : "";
    return `<div class="history-item" style="margin-bottom:8px;opacity:${status==="missed"?.7:1}">
      <div class="history-status ${sc}">${si}</div>
      <div style="font-size:20px">${med.emoji}</div>
      <div class="history-info">
        <div class="history-name">${med.name}</div>
        <div class="history-detail">${med.dose}${med.notes?" · "+med.notes:""}</div>
      </div>
      <div class="history-time">${time}</div>
      <div class="history-action">${actions}</div>
    </div>`;
  }).join("");
}

window.markDose = async (medId, time, status) => {
  const td = today();
  const logId = `${medId}_${td}_${time}`;
  await saveLog(currentUser.uid, { medId, date:td, time, status, ts:Date.now() }, logId);
  const med = meds.find(m => m.id===medId);
  if (status==="taken") showToast("Dosis registrada ✓", `${med.emoji} ${med.name} — ${time}`, "success");
};

// ── MEDS LIST ──────────────────────────────────────────────────────────────
function renderMeds() {
  const el = document.getElementById("medsList");
  if (!meds.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">💊</div><h3>Sin medicamentos</h3><p>Agrega tu primer medicamento para comenzar</p></div>`;
    return;
  }
  el.innerHTML = meds.map(med => `
    <div class="med-card">
      <div class="med-icon c-${med.color}">${med.emoji}</div>
      <div class="med-info">
        <div class="med-name">${med.name}${!med.active?' <span style="font-size:11px;color:var(--text3)">(inactivo)</span>':""}</div>
        <div class="med-dose-label">${med.dose}${med.notes?" · "+med.notes:""}</div>
        <div class="med-times">${med.times.map(t=>`<span class="time-tag c-${med.color}">${t}</span>`).join("")}</div>
      </div>
      <div class="med-actions">
        <button class="icon-btn" onclick="openMedModal('${med.id}')" title="Editar">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button class="icon-btn danger" onclick="removeMed('${med.id}')" title="Eliminar">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>`).join("");
}

// ── HISTORY ────────────────────────────────────────────────────────────────
function renderHistory() {
  const el = document.getElementById("historyList");
  let filtered = [...logs].sort((a,b) => b.ts-a.ts);
  if (historyFilter !== "all") filtered = filtered.filter(l => l.status===historyFilter);
  if (!filtered.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📂</div><h3>Sin registros</h3><p>El historial aparecerá aquí</p></div>`;
    return;
  }
  const byDate = {};
  filtered.forEach(log => { if (!byDate[log.date]) byDate[log.date]=[]; byDate[log.date].push(log); });
  el.innerHTML = Object.keys(byDate).sort((a,b)=>b.localeCompare(a)).map(date => `
    <div class="history-day">
      <div class="history-day-label">${formatDate(date)}</div>
      <div class="history-list">
        ${byDate[date].map(log => {
          const med = meds.find(m => m.id===log.medId);
          if (!med) return "";
          const ok = log.status==="taken";
          return `<div class="history-item">
            <div class="history-status ${ok?"status-taken":"status-missed"}">${ok?"✓":"✕"}</div>
            <div style="font-size:18px">${med.emoji}</div>
            <div class="history-info">
              <div class="history-name">${med.name}</div>
              <div class="history-detail">${med.dose} · ${log.time}</div>
            </div>
            <div class="history-time" style="color:${ok?"var(--green)":"var(--red)"}">${ok?"Tomada":"Omitida"}</div>
          </div>`;
        }).join("")}
      </div>
    </div>`).join("");
}

window.filterHistory = (f, el) => {
  historyFilter = f;
  document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  renderHistory();
};

window.clearAllHistory = async () => {
  if (!confirm("¿Eliminar todo el historial?")) return;
  await clearLogs(currentUser.uid);
  showToast("Historial eliminado", "Se borró todo el registro", "info");
};

// ── MED MODAL ──────────────────────────────────────────────────────────────
window.openMedModal = (id = null) => {
  editingId = id;
  pendingTimes = [];
  document.getElementById("modalTitle").textContent = id ? "Editar medicamento" : "Agregar medicamento";
  document.getElementById("medSearch").value = "";
  document.getElementById("autocompleteList").innerHTML = "";
  document.getElementById("doseSelect").innerHTML = `<option value="">Selecciona dosis</option>`;
  document.getElementById("medNotes").value = "";
  document.getElementById("medColor").value = "blue";
  document.getElementById("medActive").value = "1";
  document.getElementById("medEmoji").value = "💊";

  if (id) {
    const med = meds.find(m => m.id===id);
    document.getElementById("medSearch").value = med.name;
    const opt = document.createElement("option");
    opt.value = med.dose; opt.textContent = med.dose; opt.selected = true;
    document.getElementById("doseSelect").appendChild(opt);
    document.getElementById("medNotes").value  = med.notes  || "";
    document.getElementById("medColor").value  = med.color  || "blue";
    document.getElementById("medActive").value = med.active ? "1" : "0";
    document.getElementById("medEmoji").value  = med.emoji  || "💊";
    pendingTimes = [...med.times];
  }
  renderTimesRow();
  openOverlay("modalOverlay");
  setTimeout(() => document.getElementById("medSearch").focus(), 100);
};

window.closeMedModal = () => closeOverlay("modalOverlay");
document.getElementById("modalOverlay").addEventListener("click", function(e) {
  if (e.target === this) window.closeMedModal();
});

// ── AUTOCOMPLETE ───────────────────────────────────────────────────────────
document.getElementById("medSearch").addEventListener("input", function() {
  const q = this.value.trim().toLowerCase();
  const list = document.getElementById("autocompleteList");
  if (!q) { list.innerHTML = ""; return; }
  const results = MED_DB.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8);
  list.innerHTML = results.map(m => `
    <div class="autocomplete-item" onclick="selectMed(${JSON.stringify(m).replace(/"/g,'&quot;')})">
      <span class="med-emoji">${m.emoji}</span>
      <div>
        <div>${m.name}</div>
        <div class="med-meta">${m.doses.join(" · ")}</div>
      </div>
    </div>`).join("");
});

window.selectMed = (med) => {
  document.getElementById("medSearch").value = med.name;
  document.getElementById("medEmoji").value  = med.emoji;
  document.getElementById("medNotes").value  = med.notes;
  document.getElementById("medColor").value  = med.color;
  const sel = document.getElementById("doseSelect");
  sel.innerHTML = `<option value="">Selecciona dosis</option>` +
    med.doses.map(d => `<option value="${d}">${d}</option>`).join("");
  document.getElementById("autocompleteList").innerHTML = "";
};

// ── TIMES ──────────────────────────────────────────────────────────────────
window.addTime = () => {
  const t = document.getElementById("newTime").value;
  if (!t || pendingTimes.includes(t)) return;
  pendingTimes.push(t); pendingTimes.sort();
  document.getElementById("newTime").value = "";
  renderTimesRow();
};

window.removeTime = (t) => {
  pendingTimes = pendingTimes.filter(x => x !== t);
  renderTimesRow();
};

function renderTimesRow() {
  document.getElementById("timesRow").innerHTML = pendingTimes.map(t =>
    `<div class="time-chip">${t}<button onclick="removeTime('${t}')">×</button></div>`).join("");
}

// ── SAVE MED ───────────────────────────────────────────────────────────────
window.saveMedForm = async () => {
  const name  = document.getElementById("medSearch").value.trim();
  const dose  = document.getElementById("doseSelect").value.trim() || document.getElementById("doseSelect").options[0]?.text;
  const emoji = document.getElementById("medEmoji").value || "💊";
  const notes = document.getElementById("medNotes").value.trim();
  const color = document.getElementById("medColor").value;
  const active = document.getElementById("medActive").value === "1";

  if (!name) { document.getElementById("medSearch").focus(); return; }
  if (!dose || dose === "Selecciona dosis") { showToast("Falta la dosis", "Selecciona o escribe la dosis", "error"); return; }
  if (!pendingTimes.length) { showToast("Falta el horario", "Agrega al menos una hora", "error"); return; }

  await saveMed(currentUser.uid, { name, dose, emoji, notes, color, times:[...pendingTimes], active }, editingId);
  window.closeMedModal();
  showToast(editingId ? "Medicamento actualizado" : "Medicamento agregado", `${emoji} ${name}`, "success");
};

window.removeMed = async (id) => {
  const med = meds.find(m => m.id===id);
  if (!confirm(`¿Eliminar ${med.name}?`)) return;
  await deleteMed(currentUser.uid, id);
  showToast("Eliminado", med.name, "info");
};

// ── RENDER ALL ─────────────────────────────────────────────────────────────
function renderAll() { renderToday(); renderMeds(); renderHistory(); }

// ── FEEDBACK ───────────────────────────────────────────────────────────────
initFeedback(() => currentUser);

// ── SERVICE WORKER ─────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("../sw.js").catch(() => {});
}
