// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCLIePpD0nue6YJWvdXB5b3VzUTT9CSZRs",
  authDomain: "clb-management.firebaseapp.com",
  projectId: "clb-management",
  storageBucket: "clb-management.firebasestorage.app",
  messagingSenderId: "928190500558",
  appId: "1:928190500558:web:54d3801f7fc204dde24a9f",
  measurementId: "G-50HLJ71FJC",
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Export cho file khác dùng
export const auth = getAuth(app);
export const db = getFirestore(app);
