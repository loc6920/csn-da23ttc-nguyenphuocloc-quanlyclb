import { auth, db } from "./firebase_config.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  increment,
  serverTimestamp,
  onSnapshot,
  documentId,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";



//đăng xuất
const btnLogout = document.getElementById("btnLogout");
btnLogout?.addEventListener("click", () => {
  signOut(auth)
    .then(() => (window.location.href = "login.html"))
    .catch((e) => alert("Lỗi đăng xuất: " + e.message));
});


//tab chuyển các trang
function setupTabs() {
  const tabBtns = document.querySelectorAll(".btn-tab-user");
  const panes = document.querySelectorAll(".tab-pane-user");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = btn.getAttribute("data-target");

      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      panes.forEach((pane) => {
        if (pane.getAttribute("data-section") === target)
          pane.classList.remove("d-none");
        else pane.classList.add("d-none");
      });
    });
  });
}
window.addEventListener("DOMContentLoaded", () => setupTabs());



//dom thông tin sinh viên, sự kiện,đăng kí, tham gia, chữ chào 
const userInfoContainer = document.getElementById("user-info-container");
const eventsListDiv = document.getElementById("events-list");
const myEventsListDiv = document.getElementById("my-events-list");
const attendedEventsDiv = document.getElementById("attended-events-list");
const name_hello = document.getElementById("strong_name");

// dom của mã qr
const btnStartScan = document.getElementById("btnStartScan");
const btnStopScan = document.getElementById("btnStopScan");
const qrReaderDiv = document.getElementById("qr-reader");
const qrResultDiv = document.getElementById("qr-result");
const attLogBody = document.getElementById("att-log-body");

//chữ hello lấy tên sinh viên
function setHelloName(name) {
  if (!name_hello) return;
  name_hello.textContent = (name || "").trim() || "người dùng";
}




let currentUser = null;
let currentUserProfile = null;

const EVENT_CACHE = new Map(); 
const REG_CACHE = new Map();   

let unsubEvents = null;
let unsubRegs = null;



// kiểm tra ảnh
function safeImg(url) {
  if (!url) return "";
  const u = String(url).trim();
  if (!u) return "";
  if (!u.startsWith("http://") && !u.startsWith("https://")) return "";
  return u;
}

//set màu cho trạng thái
function statusBadge(status) {
  if (status === "Attended")
    return `<span class="badge bg-success">Đã tham gia</span>`;
  if (status === "Absent") return `<span class="badge bg-danger">Vắng</span>`;
  return `<span class="badge bg-secondary">Chưa xác nhận</span>`;
}

//option cho gioi tinh
const GENDER_OPTIONS = ["", "Nam", "Nữ"];

function genderOptionsHtml(selected) {
  const cur = (selected || "").trim();
  return GENDER_OPTIONS.map((g) => {
    const label = g === "" ? "-- Chọn --" : g;
    return `<option value="${g}" ${cur === g ? "selected" : ""}>${label}</option>`;
  }).join("");
}



//kiểm tra id và chia ra xử lý, check rỗng
async function fetchEventsByIds(eventIds) {
  const ids = [...new Set(eventIds)].filter(Boolean);
  const result = new Map();

  const need = [];
  ids.forEach((id) => {
    if (EVENT_CACHE.has(id)) result.set(id, EVENT_CACHE.get(id));
    else need.push(id);
  });

  if (!need.length) return result;

  const CHUNK = 10;
  for (let i = 0; i < need.length; i += CHUNK) {
    const chunk = need.slice(i, i + CHUNK);

    try {
      const qEv = query(
        collection(db, "Event"),
        where(documentId(), "in", chunk)
      );
      const snap = await getDocs(qEv);

      snap.forEach((d) => {
        const ev = d.data();
        EVENT_CACHE.set(d.id, ev);
        result.set(d.id, ev);
      });

      chunk.forEach((id) => {
        if (!result.has(id)) {
          EVENT_CACHE.set(id, null);
          result.set(id, null);
        }
      });
    } catch (e) {
      for (const id of chunk) {
        if (result.has(id)) continue;
        try {
          const evSnap = await getDoc(doc(db, "Event", id));
          if (evSnap.exists()) {
            const ev = evSnap.data();
            EVENT_CACHE.set(id, ev);
            result.set(id, ev);
          } else {
            EVENT_CACHE.set(id, null);
            result.set(id, null);
          }
        } catch {
          EVENT_CACHE.set(id, null);
          result.set(id, null);
        }
      }
    }
  }

  return result;
}


//danh sách sự kiện
function renderEventsList() {
  if (!eventsListDiv) return;

  const entries = [...EVENT_CACHE.entries()]
    .filter(([, ev]) => ev)
    .filter(([eventId]) => !REG_CACHE.has(eventId)); //ẩn sự kiện tổng quan khi đã click và nút đăng kí

  if (!entries.length) {
    eventsListDiv.innerHTML = `<p class="text-muted">Không còn sự kiện nào để đăng ký.</p>`;
    return;
  }

  let html = "";

  entries.forEach(([eventId, ev]) => {
    const img = safeImg(ev.ImageUrl);
    const disabled = ev.Status === "Closed";

    html += `
      <div class="col-12 col-md-6">
        <div class="card h-100 shadow-sm">
          ${
            img
              ? `<img src="${img}" class="card-img-top" alt="${ev.Title || ""}" style="height:180px;object-fit:cover;">`
              : `<div class="bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center" style="height:180px;">
                   <span class="text-muted small">Không có hình</span>
                 </div>`
          }

          <div class="card-body d-flex flex-column">
            <h5 class="card-title">${ev.Title || ""}</h5>

            <p class="card-text mb-1"><strong>Thời gian:</strong> ${ev.Date || ""} ${ev.Time || ""}</p>
            <p class="card-text mb-1"><strong>Địa điểm:</strong> ${ev.Location || ""}</p>
            <p class="card-text mb-1"><strong>Sức chứa:</strong> ${ev.Capacity || 0}</p>
            <p class="card-text mb-1"><strong>Đã đăng ký:</strong> ${ev.registeredCount || 0}</p>
            <p class="card-text mb-2"><strong>Trạng thái:</strong>
              <strong class="text-${ev.Status === "Closed" ? "danger" : "success"}">${ev.Status || "Open"}</strong>
            </p>

            <button class="btn btn-primary mt-auto btn-register-event"
              data-event-id="${eventId}"
              ${disabled ? "disabled" : ""}>
              ${ev.Status === "Closed" ? "Đã đóng" : "Đăng ký"}
            </button>
          </div>
        </div>
      </div>
    `;
  });

  eventsListDiv.innerHTML = html;

  document
    .querySelectorAll(".btn-register-event")
    .forEach((btn) => btn.addEventListener("click", onRegisterEventClick));
}



//danh sách trang đăng kí
function renderMyRegisteredList(regItems, eventMap) {
  if (!myEventsListDiv) return;

  const showItems = regItems.filter(
    (x) => (x.status || "Registered") !== "Attended"
  );

  if (!showItems.length) {
    myEventsListDiv.innerHTML = `<p class="text-muted">Bạn chưa có sự kiện nào đang chờ xác nhận.</p>`;
    return;
  }

  const cards = [];
  showItems.forEach(({ eventId, status }) => {
    const ev = eventMap.get(eventId);
    if (!ev) return;

    const img = safeImg(ev.ImageUrl);

    cards.push(`
      <div class="col-12 col-md-6">
        <div class="card h-100 shadow-sm">
          ${
            img
              ? `<img src="${img}" class="card-img-top" alt="${ev.Title || ""}" style="height:180px;object-fit:cover;">`
              : `<div class="bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center" style="height:180px;">
                   <span class="text-muted small">Không có hình</span>
                 </div>`
          }

          <div class="card-body d-flex flex-column">
            <h5 class="card-title">${ev.Title || ""}</h5>
            <p class="card-text mb-1"><strong>Thời gian:</strong> ${ev.Date || ""} ${ev.Time || ""}</p>
            <p class="card-text mb-1"><strong>Địa điểm:</strong> ${ev.Location || ""}</p>

            <p class="card-text mb-1"><strong>Trạng thái tham gia:</strong> ${statusBadge(status || "Registered")}</p>

            <p class="card-text mb-2 text-muted small">${ev.Description || ""}</p>

            <div class="mt-auto d-flex justify-content-end">
              ${
                (status || "Registered") === "Registered"
                  ? `<button class="btn btn-outline-danger btn-cancel-registration" data-event-id="${eventId}">
                       Hủy đăng ký
                     </button>`
                  : `<button class="btn btn-outline-secondary" disabled>Không thể hủy</button>`
              }
            </div>
          </div>
        </div>
      </div>
    `);
  });

  myEventsListDiv.innerHTML = cards.join("");

  document
    .querySelectorAll(".btn-cancel-registration")
    .forEach((btn) => btn.addEventListener("click", onCancelRegistrationClick));
}

// danh sách sự kiện tham gia
function renderAttendedList(attItems, eventMap) {
  if (!attendedEventsDiv) return;

  const count = attItems.length;

  const top = `
    <div class="col-12">
      <div class="attended-hero mb-3">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div><div class="fs-4 fw-bold">Sự kiện đã tham gia</div></div>
          <div class="attended-pill">Đã tham gia: <span class="fw-bold">${count}</span></div>
        </div>
      </div>
    </div>
  `;

  if (!count) {
    attendedEventsDiv.innerHTML =
      top +
      `
      <div class="col-12">
        <div class="attended-empty">
          <div class="fw-semibold mb-1">Chưa có sự kiện nào được xác nhận tham gia.</div>
        </div>
      </div>
    `;
    return;
  }

  const cards = [];
  attItems.forEach(({ eventId }) => {
    const ev = eventMap.get(eventId);
    if (!ev) return;

    const img = safeImg(ev.ImageUrl);
    const when = `${ev.Date || ""} ${ev.Time || ""}`.trim();
    const whereText = ev.Location || "";

    cards.push(`
      <div class="col-12 col-md-6">
        <div class="card attended-card h-100 position-relative">
          ${
            img
              ? `<img src="${img}" class="card-img-top" alt="${ev.Title || ""}" style="height:180px;object-fit:cover;">`
              : `<div class="bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center" style="height:180px;">
                   <span class="text-muted small">Không có hình</span>
                 </div>`
          }

          <div class="card-body d-flex flex-column">
            <h5 class="card-title mb-2">${ev.Title || ""}</h5>

            <div class="attended-meta mb-3">
              ${when ? `<span class="meta-chip purple">Ngày: ${when}</span>` : ""}
              ${whereText ? `<p class="meta-chip">Địa điểm: ${whereText}</p>` : ""}
            </div>

            <button class="btn btn-outline-secondary mt-auto" disabled>
              Đã tham gia 
            </button>
          </div>
        </div>
      </div>
    `);
  });

  attendedEventsDiv.innerHTML = top + cards.join("");
}


//thông tin sinh viên
async function loadUserProfile(uid) {
  try {
    const userCol = collection(db, "user");
    const qU = query(userCol, where("Uid", "==", uid));
    const snap = await getDocs(qU);

    if (snap.empty) return;

    const docSnap = snap.docs[0];
    const data = docSnap.data();

    currentUserProfile = {
      name: data.UserName || "",
      mssv: data.mssv || data.Mssv || "",
      className: data.Class || "",
      birthDate: data.BirthDate || "",
      gender: data.gender || "",
      address: data.Address || "",
      phone: data.NumberPhone || "",
      docRef: docSnap.ref,
    };

    setHelloName(currentUserProfile.name);
    renderUserInfoForm(currentUserProfile);
  } catch (err) {
    console.error("Lỗi load profile:", err);
  }
}

// form thông tin sinh viên hiển thị 
function renderUserInfoForm(p) {
  if (!userInfoContainer) return;
  userInfoContainer.innerHTML = `
    <div class="card p-3">
      <strong class="text-center fs-4 d-block mb-2">Thông tin sinh viên</strong>

      <div class="mb-2">
        <label class="form-label">MSSV:</label>
        <input id="inp-mssv" class="form-control" type="text" value="${p.mssv || ""}" disabled>
      </div>

      <div class="mb-2">
        <label class="form-label">Lớp:</label>
        <input id="inp-class" class="form-control" type="text" value="${p.className || ""}" disabled>
      </div>

      <div class="mb-2">
        <label class="form-label">Họ và tên:</label>
        <input id="inp-name" class="form-control" type="text" value="${p.name || ""}" disabled>
      </div>

      <div class="mb-2">
        <label class="form-label">Ngày sinh:</label>
        <input id="inp-birthdate" class="form-control" type="date" value="${p.birthDate || ""}" disabled>
      </div>

      <div class="mb-2">
        <label class="form-label">Giới tính:</label>
        <select id="inp-gender" class="form-select" disabled>
          ${genderOptionsHtml(p.gender)}
        </select>
      </div>

      <div class="mb-2">
        <label class="form-label">Địa chỉ:</label>
        <input id="inp-address" class="form-control" type="text" value="${p.address || ""}" disabled>
      </div>

      <div class="mb-2">
        <label class="form-label">Số điện thoại:</label>
        <input id="inp-phone" class="form-control" type="text" value="${p.phone || ""}" disabled>
      </div>

      <div class="mt-2 d-flex justify-content-end gap-2">
        <button id="btn-edit-info" class="btn btn-outline-primary">Sửa</button>
        <button id="btn-save-info" class="btn btn-primary d-none">Lưu</button>
      </div>
    </div>
  `;

  //sửa thông tin
  const inpMssv = document.getElementById("inp-mssv");
  const inpClass = document.getElementById("inp-class");
  const inpName = document.getElementById("inp-name");
  const inpBirthDate = document.getElementById("inp-birthdate");
  const inpGender = document.getElementById("inp-gender");
  const inpAddr = document.getElementById("inp-address");
  const inpPhone = document.getElementById("inp-phone");

  const btnEdit = document.getElementById("btn-edit-info");
  const btnSave = document.getElementById("btn-save-info");

  btnEdit?.addEventListener("click", () => {
    [inpMssv, inpClass, inpName, inpBirthDate, inpGender, inpAddr, inpPhone].forEach(
      (inp) => inp && (inp.disabled = false)
    );
    btnSave?.classList.remove("d-none");
    btnEdit?.classList.add("d-none");
  });

  btnSave?.addEventListener("click", async () => {
    try {
      const bd = (inpBirthDate?.value || "").trim();
      if (bd && !/^\d{4}-\d{2}-\d{2}$/.test(bd)) {
        alert("Ngày sinh không hợp lệ. Ví dụ: 2004-09-18");
        return;
      }

      const g = (inpGender?.value || "").trim();
      if (g && !GENDER_OPTIONS.includes(g)) {
        alert("Giới tính không hợp lệ.");
        return;
      }

      await updateDoc(currentUserProfile.docRef, {
        mssv: (inpMssv?.value || "").trim(),
        Class: (inpClass?.value || "").trim(),
        UserName: (inpName?.value || "").trim(),
        BirthDate: bd,
        gender: g,
        Address: (inpAddr?.value || "").trim(),
        NumberPhone: (inpPhone?.value || "").trim(),
      });

      currentUserProfile.mssv = (inpMssv?.value || "").trim();
      currentUserProfile.className = (inpClass?.value || "").trim();
      currentUserProfile.name = (inpName?.value || "").trim();
      currentUserProfile.birthDate = bd;
      currentUserProfile.gender = g;
      currentUserProfile.address = (inpAddr?.value || "").trim();
      currentUserProfile.phone = (inpPhone?.value || "").trim();

      setHelloName(currentUserProfile.name);
      alert("Cập nhật thông tin thành công!");

      [inpMssv, inpClass, inpName, inpBirthDate, inpGender, inpAddr, inpPhone].forEach(
        (inp) => inp && (inp.disabled = true)
      );
      btnSave?.classList.add("d-none");
      btnEdit?.classList.remove("d-none");
    } catch (err) {
      console.error("Lỗi update profile:", err);
      alert("Cập nhật thất bại, thử lại sau!");
    }
  });
}


  //cap nhật lại danh sách đăng kí
function startRealtimeListeners() {
  unsubEvents?.();
  unsubRegs?.();

  unsubEvents = onSnapshot(collection(db, "Event"), (snap) => {
    EVENT_CACHE.clear();
    snap.forEach((d) => EVENT_CACHE.set(d.id, d.data()));
    renderEventsList();
  });

  const qReg = query(
    collection(db, "Registration"),
    where("userId", "==", currentUser.uid)
  );
  unsubRegs = onSnapshot(qReg, async (snap) => {
    REG_CACHE.clear();

    const regs = [];
    snap.forEach((d) => {
      const r = d.data();
      if (!r?.eventId) return;
      const status = r.status || "Registered";
      REG_CACHE.set(r.eventId, { regDocId: d.id, status });
      regs.push({ regDocId: d.id, eventId: r.eventId, status });
    });

    const eventIds = regs.map((x) => x.eventId);
    const eventMap = await fetchEventsByIds(eventIds);

    renderMyRegisteredList(regs, eventMap);

    const attended = regs.filter((x) => x.status === "Attended");
    renderAttendedList(attended, eventMap);

    // table lịch sử điểm danh
    renderAttendanceLog(attended, eventMap);

    renderEventsList();
  });
}


//  ACTIONS
 
async function onRegisterEventClick(e) {
  if (!currentUser) return alert("Bạn cần đăng nhập để đăng ký sự kiện.");

  const eventId = e.currentTarget.getAttribute("data-event-id");
  if (!eventId) return;

  try {
    if (REG_CACHE.has(eventId)) return alert("Bạn đã đăng ký sự kiện này rồi.");

    const ev = EVENT_CACHE.get(eventId);
    if (!ev) return alert("Sự kiện không tồn tại.");
    if (ev.Status === "Closed") return alert("Sự kiện đã đóng đăng ký.");

    const cap = Number(ev.Capacity || 0);
    const regCount = Number(ev.registeredCount || 0);
    if (cap > 0 && regCount >= cap) return alert("Sự kiện đã đủ sức chứa.");

    await addDoc(collection(db, "Registration"), {
      userId: currentUser.uid,
      eventId,
      registeredAt: serverTimestamp(),
      status: "Registered",
    });

    await updateDoc(doc(db, "Event", eventId), {
      registeredCount: increment(1),
    });

    alert("Đăng ký sự kiện thành công!");
  } catch (err) {
    console.error("Lỗi đăng ký:", err);
    alert("Đăng ký thất bại, thử lại sau.");
  }
}

async function onCancelRegistrationClick(e) {
  if (!currentUser) return alert("Bạn cần đăng nhập.");

  const eventId = e.currentTarget.getAttribute("data-event-id");
  if (!eventId) return;

  const regInfo = REG_CACHE.get(eventId);
  if (!regInfo?.regDocId)
    return alert("Không tìm thấy đăng ký để hủy.");

  if ((regInfo.status || "Registered") !== "Registered")
    return alert("Không thể hủy vì đã được xác nhận tham gia.");

  const ok = confirm("Bạn có chắc muốn hủy đăng ký sự kiện này?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "Registration", regInfo.regDocId));

    const ev = EVENT_CACHE.get(eventId);
    if (ev)
      await updateDoc(doc(db, "Event", eventId), {
        registeredCount: increment(-1),
      });

    alert("Hủy đăng ký thành công!");
  } catch (err) {
    console.error("Lỗi hủy đăng ký:", err);
    alert("Hủy đăng ký thất bại, thử lại sau.");
  }
}

/*  QR CHECKIN */
let html5Qr = null;
let isScanning = false;

function setQrMsg(msg, type = "info") {
  if (!qrResultDiv) return;

  const cls =
    type === "ok"
      ? "alert alert-success"
      : type === "err"
      ? "alert alert-danger"
      : "alert alert-info";

  qrResultDiv.innerHTML = `<div class="${cls} mb-0">${msg}</div>`;
}

function parseQrText(text) {
  const raw = (text || "").trim();
  if (!raw) return null;

  // JSON payload
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const obj = JSON.parse(raw);
      if (!obj.eventId) return null;
      return {
        eventId: String(obj.eventId),
        token: obj.token ? String(obj.token) : "",
        exp: obj.exp ? Number(obj.exp) : null,
      };
    } catch {
      return null;
    }
  }

  // fallback: eventId|token
  const parts = raw.split("|");
  return {
    eventId: parts[0] || "",
    token: parts[1] || "",
    exp: null,
  };
}

async function stopQrScan() {
  try {
    if (html5Qr && isScanning) {
      await html5Qr.stop();
      await html5Qr.clear();
    }
  } catch {}
  isScanning = false;

  if (btnStartScan) btnStartScan.disabled = false;
  if (btnStopScan) btnStopScan.disabled = true;
}

async function startQrScan() {
  if (!qrReaderDiv) return alert("Không tìm thấy vùng camera (#qr-reader).");

  //  check library
  if (!window.Html5Qrcode) {
    alert("Thiếu thư viện html5-qrcode. Kiểm tra CDN trong <head> ");
    return;
  }

  if (!html5Qr) html5Qr = new window.Html5Qrcode("qr-reader");

  setQrMsg("Đang mở camera... ", "info");
  if (btnStartScan) btnStartScan.disabled = true;
  if (btnStopScan) btnStopScan.disabled = false;

  try {
    isScanning = true;

    const cameraConfig = { facingMode: "environment" };
    const config = { fps: 10, qrbox: { width: 260, height: 260 } };

    await html5Qr.start(
      cameraConfig,
      config,
      async (decodedText) => {
        await stopQrScan();

        const payload = parseQrText(decodedText);
        if (!payload?.eventId) {
          setQrMsg("QR không hợp lệ ", "err");
          return;
        }

        if (payload.exp && Date.now() > payload.exp) {
          setQrMsg("QR đã hết hạn ", "err");
          return;
        }

        try {
          await markAttendanceByQr_AUTO(payload.eventId, payload.token);
          setQrMsg(" Đã tham gia (điểm danh thành công)!", "ok");
        } catch (e) {
          console.error(e);
          setQrMsg(" Điểm danh thất bại: " + (e?.message || "Lỗi"), "err");
        }
      },
      () => {}
    );
  } catch (e) {
    console.error("startQrScan:", e);
    isScanning = false;

    if (btnStartScan) btnStartScan.disabled = false;
    if (btnStopScan) btnStopScan.disabled = true;

    alert("Không mở được camera. Nhớ: HTTPS + cấp quyền camera 😤");
  }
}

// xác thực tham gia tự động
async function markAttendanceByQr_AUTO(eventId, token) {
  if (!currentUser) throw new Error("Bạn chưa đăng nhập.");
  if (!eventId) throw new Error("Thiếu eventId.");

  const qReg = query(
    collection(db, "Registration"),
    where("userId", "==", currentUser.uid),
    where("eventId", "==", eventId)
  );
  const snap = await getDocs(qReg);

  // chưa đăng ký => tạo luôn + attended
  if (snap.empty) {
    await addDoc(collection(db, "Registration"), {
      userId: currentUser.uid,
      eventId,
      registeredAt: serverTimestamp(),
      status: "Attended",
      checkedAt: serverTimestamp(),
      checkinToken: token || "",
      checkinBy: "qr",
    });
    try {
      await updateDoc(doc(db, "Event", eventId), {
        registeredCount: increment(1),
      });
    } catch {}
    return;
  }

  // cập nhật tham gia
  const regDoc = snap.docs[0];
  await updateDoc(regDoc.ref, {
    status: "Attended",
    checkedAt: serverTimestamp(),
    checkinToken: token || "",
    checkinBy: "qr",
  });
}

btnStartScan?.addEventListener("click", startQrScan);
btnStopScan?.addEventListener("click", stopQrScan);

window.addEventListener("beforeunload", () => {
  stopQrScan();
});


//bảo mật nếu ko phải là user đó thì về trang login

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  currentUser = user;

  await loadUserProfile(user.uid);

  if (!currentUserProfile) {
    await signOut(auth);
    window.location.replace("login.html");
    return;
  }

  startRealtimeListeners();
});
