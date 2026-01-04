import { auth, db } from "./firebase_config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const InpEmail = document.querySelector("#email");
const InpPassWd = document.querySelector("#password");
const loginform = document.querySelector("#login_form");

const xuly_dangnhap = function (event) {
  event.preventDefault();

  let email = InpEmail.value.trim();
  let password = InpPassWd.value;

  if (!email || !password) {
    alert("Vui lòng điền đầy đủ thông tin!!");
    return;
  }

  signInWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      // kiểm tra đăng nhập
      const user = userCredential.user;

      // lấy role từ Firestore (collection "account")
      const usersRef = collection(db, "account");
      const q = query(usersRef, where("uid", "==", user.uid));

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("Không tìm thấy thông tin người dùng!!");
        return;
      }

      const userdata = querySnapshot.docs[0].data();
      let role_id = userdata.role_id;

      role_id = Number(role_id);

      if (role_id === 1) {
        // Admin
        alert("Đăng nhập thành công!! (Admin)");
        window.location.href = "admin.html";
      } else if (role_id === 2) {
        // User thường
        alert("Đăng nhập thành công!! (User)");
        window.location.href = "user.html";
      } else {
        // Không xác định
        alert("Role không hợp lệ!");
      }
    })
    .catch((e) => {
      alert("Lỗi: " + e.message);
    });
};

loginform.addEventListener("submit", xuly_dangnhap);
