import { auth, db } from "./firebase.js";
import { loginGoogle, logout, onAuth } from "./auth.js";
import { getRedirectResult } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
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

// Handle redirect result from Google login
// Handle redirect result from Google login
getRedirectResult(auth).then(result => {
  if (result?.user) {
    console.log("Redirect login success:", result.user.displayName);
  }
}).catch(e => console.error("Redirect error:", e));

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
    window._subscribeProfiles();
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

function todayStatus(med) {
  const td = today();
  const now = new Date();
  const nowMins = now.getHours()*60 + now.getMinutes();
  if (!med.times || !med.times.length) return "";

  // Find next pending dose today
  const nextDose = med.times.find(t => {
    const [h,m] = t.split(":").map(Number);
    const tMins = h*60+m;
    const log = logs.find(l => l.medId===med.id && l.date===td && l.time===t);
    return !log && tMins >= nowMins;
  });

  // Find if all taken today
  const allTaken = med.times.every(t => {
    return logs.find(l => l.medId===med.id && l.date===td && l.time===t && l.status==="taken");
  });

  if (allTaken) {
    return `<span style="font-size:12px;font-weight:600;color:var(--green);background:var(--green-light);padding:4px 10px;border-radius:20px;white-space:nowrap">✓ Tomado</span>`;
  }

  if (nextDose) {
    return `<button class="btn-take" style="font-size:12px;white-space:nowrap" onclick="quickMark('${med.id}','${nextDose}')">✓ Tomé ${nextDose}</button>`;
  }

  // Check missed doses
  const hasMissed = med.times.some(t => {
    const [h,m] = t.split(":").map(Number);
    const tMins = h*60+m;
    const log = logs.find(l => l.medId===med.id && l.date===td && l.time===t);
    return !log && tMins < nowMins;
  });

  if (hasMissed) {
    return `<span style="font-size:12px;font-weight:600;color:var(--red);background:var(--red-light);padding:4px 10px;border-radius:20px;white-space:nowrap">✕ Pendiente</span>`;
  }

  return "";
}

window.quickMark = async (medId, time) => {
  const td = today();
  const logId = `\${medId}_\${td}_\${time}`;
  await saveLog(currentUser.uid, { medId, date:td, time, status:"taken", ts:Date.now() }, logId);
  const med = meds.find(m => m.id===medId);
  showToast("Dosis registrada ✓", `\${med.emoji} \${med.name} — \${time}`, "success");
};

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
        ${todayStatus(med)}
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
  document.getElementById("doseInput").value = "";
  document.getElementById("medNotes").value = "";
  document.getElementById("medColor").value = "blue";
  document.getElementById("medActive").value = "1";
  document.getElementById("medEmoji").value = "💊";

  if (id) {
    const med = meds.find(m => m.id===id);
    document.getElementById("medSearch").value = med.name;
    document.getElementById("doseInput").value = med.dose || "";
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
  document.getElementById("doseInput").value = med.doses[0] || "";
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
  const dose  = document.getElementById("doseInput").value.trim();
  const emoji = document.getElementById("medEmoji").value || "💊";
  const notes = document.getElementById("medNotes").value.trim();
  const color = document.getElementById("medColor").value;
  const active = document.getElementById("medActive").value === "1";

  if (!name) { document.getElementById("medSearch").focus(); return; }
  if (!dose) { showToast("Falta la dosis", "Escribe la dosis del medicamento", "error"); return; }
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
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// ── PROFILES & PHOTOS ──────────────────────────────────────────────────────
import { saveProfile, deleteProfile, subscribeProfiles, emptyProfile, calcAge } from "./profiles.js";
import { savePhoto, subscribePhotos, deletePhoto, openCamera, compressToBase64 } from "./photos.js";

let profiles = [];
let activeProfileId = null;
let unsubProfiles = null;
let unsubPhotos = null;
let photos = [];
let editingProfileId = null;
let pendingAvatarBase64 = null;

// Called after login — subscribe profiles
const _origSubscribeData = subscribeData;
function subscribeDataV2() {
  _origSubscribeData && _origSubscribeData();
  const uid = currentUser.uid;
  unsubProfiles = subscribeProfiles(uid, data => {
    profiles = data;
    renderProfileBar();
    if (activeProfileId) renderProfilePanel(activeProfileId);
  });
}

// Override subscribeData
window._subscribeProfiles = () => {
  if (!currentUser) return;
  const uid = currentUser.uid;
  if (unsubProfiles) unsubProfiles();
  unsubProfiles = subscribeProfiles(uid, data => {
    profiles = data;
    renderProfileBar();
    if (activeProfileId) renderProfilePanel(activeProfileId);
  });
};

// ── PROFILE BAR ────────────────────────────────────────────────────────────
function renderProfileBar() {
  const bar = document.getElementById("profileBar");
  bar.innerHTML = profiles.map(p => {
    const initials = p.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    const isActive = p.id === activeProfileId;
    return `<button class="profile-chip ${isActive?"active":""}" onclick="selectProfile('${p.id}')">
      <div class="profile-avatar-sm">${p.avatar ? `<img src="${p.avatar}">` : initials}</div>
      ${p.name.split(" ")[0]}
    </button>`;
  }).join("") + `<button class="add-profile-btn" onclick="openProfileModal()" title="Agregar paciente">+</button>`;
}

// ── SELECT PROFILE ─────────────────────────────────────────────────────────
window.selectProfile = (id) => {
  activeProfileId = id;
  renderProfileBar();
  switchTab("profile");
  renderProfilePanel(id);
  document.querySelector('.tab-btn[data-tab="profile"]').classList.add("active");
};

// ── RENDER PROFILE PANEL ───────────────────────────────────────────────────
function renderProfilePanel(id) {
  const p = profiles.find(x => x.id === id);
  if (!p) return;
  const age = calcAge(p.birthdate);
  const initials = p.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const el = document.getElementById("profileContent");
  el.innerHTML = `
    <div class="profile-card">
      <div class="profile-card-header">
        <div class="profile-avatar-lg" onclick="changeProfileAvatarFor('${p.id}')">
          ${p.avatar ? `<img src="${p.avatar}">` : initials}
        </div>
        <div class="profile-card-info">
          <h2>${p.name}</h2>
          <p>${age ? age+" años · " : ""}${p.gender || ""}</p>
          <p style="margin-top:4px">${p.condition || ""}</p>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="icon-btn" onclick="openProfileModal('${p.id}')" title="Editar">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="icon-btn danger" onclick="removeProfile('${p.id}')" title="Eliminar">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
      <div class="profile-meta">
        ${p.bloodType ? `<div class="profile-meta-item"><div class="profile-meta-label">Tipo de sangre</div><div class="profile-meta-value">${p.bloodType}</div></div>` : ""}
        ${p.doctor ? `<div class="profile-meta-item"><div class="profile-meta-label">Médico tratante</div><div class="profile-meta-value">${p.doctor}</div></div>` : ""}
        ${p.allergies ? `<div class="profile-meta-item"><div class="profile-meta-label">Alergias</div><div class="profile-meta-value" style="color:var(--red)">${p.allergies}</div></div>` : ""}
        ${p.phone ? `<div class="profile-meta-item"><div class="profile-meta-label">Teléfono</div><div class="profile-meta-value">${p.phone}</div></div>` : ""}
        ${p.notes ? `<div class="profile-meta-item" style="grid-column:1/-1"><div class="profile-meta-label">Notas</div><div class="profile-meta-value">${p.notes}</div></div>` : ""}
      </div>
    </div>

    <!-- FOTOS -->
    <div class="photos-section">
      <div class="section-header">
        <div class="section-title">📷 Fórmulas y evidencias</div>
      </div>
      <div class="photos-grid" id="photosGrid">
        <div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text3)">Cargando fotos...</div>
      </div>
    </div>`;

  // Subscribe photos for this profile
  if (unsubPhotos) unsubPhotos();
  unsubPhotos = subscribePhotos(currentUser.uid, id, data => {
    photos = data.sort((a,b) => b.createdAt - a.createdAt);
    renderPhotosGrid();
  });
}

// ── PHOTOS GRID ────────────────────────────────────────────────────────────
function renderPhotosGrid() {
  const grid = document.getElementById("photosGrid");
  if (!grid) return;
  const dateStr = ts => new Date(ts).toLocaleDateString("es-CO", { day:"2-digit", month:"short", year:"numeric" });
  grid.innerHTML = `
    <div class="add-photo-btn" onclick="addPhotoFormula()"><span>📋</span>Fórmula médica</div>
    <div class="add-photo-btn" onclick="addPhotoMed()"><span>💊</span>Medicamento</div>
    ${photos.map(ph => `
      <div class="photo-card" onclick="viewPhoto('${ph.id}')">
        <img src="${ph.base64}" alt="${ph.title}">
        <div class="photo-card-label">
          <div class="photo-card-title">${ph.title}</div>
          <div class="photo-card-date">${dateStr(ph.createdAt)}</div>
        </div>
        <button class="photo-card-del" onclick="event.stopPropagation();removePhoto('${ph.id}')" title="Eliminar">×</button>
      </div>`).join("")}`;
}

// ── ADD PHOTOS ─────────────────────────────────────────────────────────────
window.addPhotoFormula = () => {
  openCamera(async (base64) => {
    await savePhoto(currentUser.uid, activeProfileId, { base64, title: "Fórmula médica", type: "formula" });
    showToast("Foto guardada", "Fórmula médica agregada", "success");
  });
};

window.addPhotoMed = () => {
  openCamera(async (base64) => {
    await savePhoto(currentUser.uid, activeProfileId, { base64, title: "Medicamento", type: "med" });
    showToast("Foto guardada", "Foto de medicamento agregada", "success");
  });
};

window.viewPhoto = (id) => {
  const ph = photos.find(p => p.id === id);
  if (!ph) return;
  document.getElementById("photoViewerImg").src = ph.base64;
  document.getElementById("photoViewerCaption").textContent = ph.title;
  document.getElementById("photoViewer").classList.add("open");
};

window.closePhotoViewer = () => {
  document.getElementById("photoViewer").classList.remove("open");
};

window.removePhoto = async (id) => {
  if (!confirm("¿Eliminar esta foto?")) return;
  await deletePhoto(currentUser.uid, id);
  showToast("Foto eliminada", "", "info");
};

// ── PROFILE MODAL ──────────────────────────────────────────────────────────
window.openProfileModal = (id = null) => {
  editingProfileId = id;
  pendingAvatarBase64 = null;
  document.getElementById("profileModalTitle").textContent = id ? "Editar paciente" : "Nuevo paciente";
  const preview = document.getElementById("profileAvatarPreview");

  if (id) {
    const p = profiles.find(x => x.id === id);
    document.getElementById("profileName").value      = p.name || "";
    document.getElementById("profileBirthdate").value = p.birthdate || "";
    document.getElementById("profileGender").value    = p.gender || "";
    document.getElementById("profileBloodType").value = p.bloodType || "";
    document.getElementById("profilePhone").value     = p.phone || "";
    document.getElementById("profileCondition").value = p.condition || "";
    document.getElementById("profileDoctor").value    = p.doctor || "";
    document.getElementById("profileAllergies").value = p.allergies || "";
    document.getElementById("profileNotes").value     = p.notes || "";
    if (p.avatar) preview.innerHTML = `<img src="${p.avatar}">`;
    else preview.textContent = p.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  } else {
    ["profileName","profileBirthdate","profilePhone","profileCondition","profileDoctor","profileAllergies","profileNotes"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("profileGender").value    = "";
    document.getElementById("profileBloodType").value = "";
    preview.textContent = "?";
  }
  document.getElementById("profileModalOverlay").classList.add("open");
  setTimeout(() => document.getElementById("profileName").focus(), 100);
};

window.closeProfileModal = () => {
  document.getElementById("profileModalOverlay").classList.remove("open");
};

document.getElementById("profileModalOverlay").addEventListener("click", function(e) {
  if (e.target === this) window.closeProfileModal();
});

window.changeProfileAvatar = () => {
  openCamera(async (base64) => {
    pendingAvatarBase64 = base64;
    document.getElementById("profileAvatarPreview").innerHTML = `<img src="${base64}">`;
  }, "file");
};

window.changeProfileAvatarFor = (id) => {
  openCamera(async (base64) => {
    const p = profiles.find(x => x.id === id);
    await saveProfile(currentUser.uid, { ...p, avatar: base64 }, id);
    showToast("Foto actualizada", "", "success");
  }, "file");
};

window.saveProfileForm = async () => {
  const name = document.getElementById("profileName").value.trim();
  if (!name) { document.getElementById("profileName").focus(); return; }
  const existing = editingProfileId ? profiles.find(p => p.id === editingProfileId) : {};
  const data = {
    name,
    birthdate:  document.getElementById("profileBirthdate").value,
    gender:     document.getElementById("profileGender").value,
    bloodType:  document.getElementById("profileBloodType").value,
    phone:      document.getElementById("profilePhone").value.trim(),
    condition:  document.getElementById("profileCondition").value.trim(),
    doctor:     document.getElementById("profileDoctor").value.trim(),
    allergies:  document.getElementById("profileAllergies").value.trim(),
    notes:      document.getElementById("profileNotes").value.trim(),
    avatar:     pendingAvatarBase64 || existing?.avatar || "",
    createdAt:  existing?.createdAt || Date.now()
  };
  const id = await saveProfile(currentUser.uid, data, editingProfileId);
  window.closeProfileModal();
  activeProfileId = id;
  showToast(editingProfileId ? "Paciente actualizado" : "Paciente agregado", name, "success");
  setTimeout(() => {
    selectProfile(activeProfileId);
  }, 500);
};

window.removeProfile = async (id) => {
  const p = profiles.find(x => x.id === id);
  if (!confirm(`¿Eliminar el perfil de ${p.name}?`)) return;
  await deleteProfile(currentUser.uid, id);
  if (activeProfileId === id) {
    activeProfileId = null;
    document.getElementById("profileContent").innerHTML = `
      <div class="no-profile">
        <div class="no-profile-icon">👤</div>
        <h3>Sin perfil seleccionado</h3>
        <p>Agrega un perfil de paciente para ver su historia clínica</p>
        <button class="btn-primary" onclick="openProfileModal()">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Agregar paciente
        </button>
      </div>`;
  }
  showToast("Perfil eliminado", p.name, "info");
};