import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAx_XnFSSVvTZpEMICFKj--AgLL_jhjWvM",
  authDomain: "mediclock-v2.firebaseapp.com",
  projectId: "mediclock-v2",
  storageBucket: "mediclock-v2.firebasestorage.app",
  messagingSenderId: "243738183730",
  appId: "1:243738183730:web:263a11f8799e294401542b"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
