// src/lib/firebase/auth.js
import { app } from "./config.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  reload
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

export const auth = getAuth(app);

// Garante persistência local no navegador por padrão
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("[Auth] Não foi possível definir persistência local:", error);
});

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  onAuthStateChanged,
  reload
};
