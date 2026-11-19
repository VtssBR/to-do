// src/lib/firebase/config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyAb4scGyybi0unCaFRP-sLQRLjqBIDojSU",
  authDomain: "to-do-senai.firebaseapp.com",
  projectId: "to-do-senai",
  storageBucket: "to-do-senai.firebasestorage.app",
  messagingSenderId: "297541430254",
  appId: "1:297541430254:web:284b9793ceb2f7dc8f7cff"
};

export const app = initializeApp(firebaseConfig);
