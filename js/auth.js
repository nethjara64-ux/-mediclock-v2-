import { auth } from "./firebase.js";
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const provider = new GoogleAuthProvider();

export let currentUser = null;

export async function loginGoogle() {
  try {
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