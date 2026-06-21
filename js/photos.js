import { db } from "./firebase.js";
import {
  collection, doc, setDoc, getDocs, deleteDoc, onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ── COMPRESS IMAGE TO BASE64 ───────────────────────────────────────────────
export function compressToBase64(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── SAVE PHOTO ─────────────────────────────────────────────────────────────
export async function savePhoto(uid, profileId, data) {
  const ref = doc(collection(db, "users", uid, "photos"));
  await setDoc(ref, {
    profileId,
    ...data,
    createdAt: Date.now()
  });
  return ref.id;
}

// ── SUBSCRIBE PHOTOS BY PROFILE ────────────────────────────────────────────
export function subscribePhotos(uid, profileId, callback) {
  return onSnapshot(
    query(collection(db, "users", uid, "photos"), where("profileId", "==", profileId)),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

// ── DELETE PHOTO ───────────────────────────────────────────────────────────
export async function deletePhoto(uid, photoId) {
  await deleteDoc(doc(db, "users", uid, "photos", photoId));
}

// ── OPEN CAMERA OR FILE ────────────────────────────────────────────────────
export function openCamera(onCapture, sourceType = "camera") {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  if (sourceType === "camera") input.capture = "environment";
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const base64 = await compressToBase64(file);
    onCapture(base64, file.name);
  };
  input.click();
}
