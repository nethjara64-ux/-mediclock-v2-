// ── TOAST ──────────────────────────────────────────────────────────────────
export function showToast(title, msg, type = "info") {
  const icons = { success:"✅", error:"❌", info:"ℹ️", alert:"🔔" };
  const cont  = document.getElementById("toastContainer");
  const t     = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<div class="toast-icon">${icons[type]||"🔔"}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>`;
  cont.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 4000);
}

// ── TABS ───────────────────────────────────────────────────────────────────
export function switchTab(tabId) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("panel-" + tabId).classList.add("active");
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add("active");
}

// ── MODAL ──────────────────────────────────────────────────────────────────
export function openOverlay(id) {
  document.getElementById(id).classList.add("open");
}

export function closeOverlay(id) {
  document.getElementById(id).classList.remove("open");
}

// ── CLOCK ──────────────────────────────────────────────────────────────────
export function startClock(onTick) {
  function tick() {
    const now = new Date();
    const h   = String(now.getHours()).padStart(2,"0");
    const m   = String(now.getMinutes()).padStart(2,"0");
    const s   = String(now.getSeconds()).padStart(2,"0");
    const el  = document.getElementById("clockDisplay");
    if (el) el.textContent = `${h}:${m}:${s}`;
    if (onTick) onTick(now);
  }
  tick();
  setInterval(tick, 1000);
}
