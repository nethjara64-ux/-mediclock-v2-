import { db } from "./firebase.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

export function initFeedback(getCurrentUser) {
  let selectedRating = 0;
  const btn   = document.getElementById("feedbackBtn");
  const modal = document.getElementById("feedbackModal");

  btn.addEventListener("click", () => {
    selectedRating = 0;
    document.querySelectorAll(".star").forEach(s => s.style.opacity = ".35");
    document.querySelectorAll("#goodChips input").forEach(c => c.checked = false);
    document.getElementById("mejora").value = "";
    document.querySelector(".feedback-content").innerHTML = document.querySelector(".feedback-content").innerHTML;
    modal.style.display = "flex";
    // re-render content since innerHTML replace clears events
    renderFeedbackContent();
  });

  function renderFeedbackContent() {
    const fc = document.querySelector(".feedback-content");
    fc.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="font-size:16px;font-weight:600;color:#1a202c">¿Cómo va MediClock?</h3>
        <button id="closeFeedback" style="background:none;border:none;font-size:22px;cursor:pointer;color:#a0aec0;line-height:1">×</button>
      </div>
      <p class="fb-label">1. ¿Cómo la calificas?</p>
      <div id="starRow" style="display:flex;gap:10px;margin-bottom:18px">
        ${[1,2,3,4,5].map(n=>`<span class="star" data-v="${n}" style="font-size:30px;cursor:pointer;opacity:.35;transition:opacity .15s">⭐</span>`).join("")}
      </div>
      <p class="fb-label">2. ¿Qué funciona bien? <span style="font-weight:400;color:#a0aec0">(marca varios)</span></p>
      <div id="goodChips" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">
        ${["Recordatorios","Historial","Diseño","Login","Agregar medicamentos"].map(v=>`
          <label class="fchip"><input type="checkbox" value="${v}"> ${v}</label>`).join("")}
      </div>
      <p class="fb-label">3. ¿Qué le falta o quitarías?</p>
      <textarea id="mejora" rows="3" placeholder="Escribe aquí..." style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-size:14px;resize:none;outline:none;margin-bottom:16px;font-family:inherit"></textarea>
      <button id="sendFeedbackBtn" style="width:100%;background:#2d7dd2;color:white;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">
        Enviar opinión
      </button>`;

    document.getElementById("closeFeedback").onclick = () => modal.style.display = "none";

    document.querySelectorAll(".star").forEach(s => {
      s.addEventListener("click", () => {
        selectedRating = Number(s.dataset.v);
        document.querySelectorAll(".star").forEach(x => {
          x.style.opacity = Number(x.dataset.v) <= selectedRating ? "1" : ".35";
        });
      });
    });

    document.getElementById("sendFeedbackBtn").addEventListener("click", async () => {
      if (!selectedRating) { alert("Por favor selecciona una calificación ⭐"); return; }
      const btn = document.getElementById("sendFeedbackBtn");
      btn.textContent = "Enviando..."; btn.disabled = true;
      try {
        const user = getCurrentUser();
        await addDoc(collection(db, "feedback"), {
          rating: selectedRating,
          funciona_bien: [...document.querySelectorAll("#goodChips input:checked")].map(c => c.value),
          mejora: document.getElementById("mejora").value.trim(),
          uid: user ? user.uid : "anonimo",
          fecha: new Date().toISOString()
        });
        fc.innerHTML = `
          <div style="text-align:center;padding:28px 0">
            <div style="font-size:54px;margin-bottom:14px">🙏</div>
            <h3 style="font-size:18px;font-weight:600;margin-bottom:8px">¡Gracias por tu opinión!</h3>
            <p style="color:#4a5568;font-size:14px;margin-bottom:22px;line-height:1.6">Tu comentario nos ayuda a mejorar MediClock.</p>
            <button onclick="document.getElementById('feedbackModal').style.display='none'"
              style="background:#2d7dd2;color:white;border:none;border-radius:8px;padding:10px 30px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">
              Cerrar
            </button>
          </div>`;
      } catch(e) {
        btn.textContent = "Enviar opinión"; btn.disabled = false;
        alert("Error al enviar. Intenta de nuevo.");
      }
    });
  }
}
