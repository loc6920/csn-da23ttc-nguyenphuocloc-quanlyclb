import { auth, db } from "./firebase_config.js";

// tạo tài khoản email/password
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// firestore
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const InpUserName = document.querySelector("#username");
const InpEmail = document.querySelector("#email");
const InpPassWd = document.querySelector("#password");
const InpConfirm = document.querySelector("#confirm_password");

const RegisteForm = document.querySelector("#register_form");

const xuly_dangki = function (event) {
  event.preventDefault();

  let username = InpUserName.value.trim();
  let email = InpEmail.value.trim();
  let password = InpPassWd.value;
  let confirm_password = InpConfirm.value;

  let birthYear = ""; 
  let address = "";
  let phone = "";
  let mssv = "";
  let Class = "";
  let gender = "";

  // phân quyền: 2 = user, 1 = admin
  let role_id = 2;

  if (!username || !email || !password || !confirm_password) {
    alert("Vui lòng nhập đầy đủ thông tin!!");
    return;
  }

  if (password !== confirm_password) {
    alert("Mật khẩu không trùng khớp!!");
    return;
  }

  // 1. Tạo tài khoản trên Firebase Auth
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      // 2. Lưu thông tin đăng nhập vào collection "account"
      const accountRef = collection(db, "account");
      const accountData = {
        uid: user.uid,
        username: username,
        email: email,
        role_id: role_id,
        createdAt: new Date(),
      };

      return addDoc(accountRef, accountData).then(() => {
        // 3. Lưu thông tin chi tiết sinh viên vào collection "user"
        const userRef = collection(db, "user");
        const userData = {
          Uid: user.uid,
          mssv: mssv,
          Class: Class,
          UserName: username,
          gender: gender,
          BirthYear: birthYear, 
          Address: address,
          NumberPhone: phone,
        };

        return addDoc(userRef, userData);
      });
    })
    .then(() => {
      alert("Đăng kí thành công!!");
      window.location.href = "login.html";
    })
    .catch((e) => {
      alert("Lỗi: " + e.message);
    });
};

RegisteForm.addEventListener("submit", xuly_dangki);
