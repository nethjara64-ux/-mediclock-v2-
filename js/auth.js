import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// Persistencia local para que la sesión sobreviva el redirect
setPersistence(auth, browserLocalPersistence).catch(e => console.error(e));

const provider = new GoogleAuthProvider();

export let currentUser = null;

export async function loginGoogle() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithRedirect(auth, provider);
  } catch (e) {
    console.error("Login error:", e);
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