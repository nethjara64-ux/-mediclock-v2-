import { auth } from "./firebase.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const provider = new GoogleAuthProvider();

export let currentUser = null;

export async function loginGoogle() {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("Login error:", e);
    showToast("Error al iniciar sesión", e.message, "error");
  }
}

export async function logout() {
  await signOut(auth);
}

export function onAuth(callback) {
  onAuthStateChanged(auth, callback);
}

export function setCurrentUser(user) {
  currentUser = user;
}
