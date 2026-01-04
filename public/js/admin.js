import { db } from "./firebase_config.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  serverTimestamp,
  setDoc, 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

//tab chuyển
function setupTabs() {
  const tabBtns = document.querySelectorAll(".btn-tab");
  const panes = document.querySelectorAll(".tab-pane-admin");

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


//thống kê tổng quan
const spanTotalEvents = document.getElementById("overview-total-events");
const spanTotalUsers = document.getElementById("overview-total-users");
const spanTotalRegistrations = document.getElementById(
  "overview-total-registrations"
);
const spanTotalAttendances = document.getElementById(
  "overview-total-attendances"
);

//tổng quan và ghi đăng kí
const overviewEventTbody = document.getElementById("overview-event-table-body");
const eventRegistrationsContainer = document.getElementById(
  "event-registrations-container"
);

//quản lý event
const eventCountSpan = document.getElementById("event-count");
const eventTableBody = document.getElementById("event-table-body");
const btnShowEventForm = document.getElementById("btnShowEventForm");
const eventFormWrapper = document.getElementById("event-form-wrapper");
const eventForm = document.getElementById("event-form");
const formTitle = document.getElementById("event-form-title");

const inpTitle = document.getElementById("event-title");
const inpImageUrl = document.getElementById("event-image-url");
const inpDate = document.getElementById("event-date");
const inpTime = document.getElementById("event-time");
const inpLocation = document.getElementById("event-location");
const inpCapacity = document.getElementById("event-capacity");
const inpStatus = document.getElementById("event-status");
const inpDescription = document.getElementById("event-description");
const btnEventCancel = document.getElementById("event-form-cancel");

// quản lý event thêm xóa sửa
const userTableBody = document.getElementById("user-table-body");
const userDetailContainer = document.getElementById("user-detail-container");
const userSearchInput = document.getElementById("user-search");
const btnReloadUsers = document.getElementById("btnReloadUsers");

// checking
const checkingEventSelect = document.getElementById("checking-event-select");
const checkingTbody = document.getElementById("checking-table-body");
const btnExportAttendedPdf = document.getElementById("btnExportAttendedPdf");

let editingEventId = null;


// DOM QR
const qrBox = document.getElementById("qr-box");
const qrCountdown = document.getElementById("qr-countdown");
const qrStatusText = document.getElementById("qr-status-text");
const btnStartQr = document.getElementById("btnStartQr");
const btnStopQr = document.getElementById("btnStopQr");

let QR_INSTANCE = null;
let QR_TIMER = null;          
let QR_ROTATE_TIMER = null;   
let QR_REMAIN = 0;
let ACTIVE_EVENT_ID = "";
const QR_TTL_SECONDS = 20;


function resetEventForm() {
  eventForm?.reset();
  editingEventId = null;
  if (formTitle) formTitle.textContent = "Thêm sự kiện mới";
}

function showEventForm() {
  eventFormWrapper?.classList.remove("d-none");
}

function hideEventForm() {
  eventFormWrapper?.classList.add("d-none");
  resetEventForm();
}

function safeImg(url) {
  if (!url) return "";
  const u = url.trim();
  if (!u) return "";
  if (!u.startsWith("http://") && !u.startsWith("https://")) return "";
  return u;
}

function formatStatusVi(s) {
  if (s === "Attended") return { text: "Đã tham gia", badge: "bg-success" };
  if (s === "Absent") return { text: "Vắng", badge: "bg-danger" };
  return { text: "Chưa xác nhận", badge: "bg-secondary" };
}

function normText(s) {
  return (s || "").toString().trim().toLowerCase();
}

function sanitizeFileName(s) {
  return (s || "danh_sach")
    .toString()
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

//tạo token
function randomToken(len = 28) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function ensureQrInstance() {
  if (!qrBox) return null;
  if (!QR_INSTANCE) {
    qrBox.innerHTML = "";
    QR_INSTANCE = new QRCode(qrBox, {
      text: "INIT",
      width: 220,
      height: 220,
      correctLevel: QRCode.CorrectLevel.M,
    });
  }
  return QR_INSTANCE;
}

function renderQrText(text) {
  const q = ensureQrInstance();
  if (!q) return;
  qrBox.innerHTML = "";
  QR_INSTANCE = new QRCode(qrBox, {
    text,
    width: 220,
    height: 220,
    correctLevel: QRCode.CorrectLevel.M,
  });
}



//tạo qr code
async function pushCheckingSession(eventId, token, expMs) {
  const ref = doc(db, "CheckingSession", eventId);
  await setDoc(
    ref,
    {
      eventId,
      token,
      expMs,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function rotateQrNow() {
  if (!ACTIVE_EVENT_ID) return;

  const token = randomToken(28);
  const expMs = Date.now() + QR_TTL_SECONDS * 1000;

  // QR chứa JSON
  const payload = JSON.stringify({
    eventId: ACTIVE_EVENT_ID,
    token,
    exp: expMs,
  });

  try {
    // ghi token lên Firestore trước
    await pushCheckingSession(ACTIVE_EVENT_ID, token, expMs);

    // rồi render QR
    renderQrText(payload);

    // reset countdown
    QR_REMAIN = QR_TTL_SECONDS;
    if (qrCountdown) qrCountdown.textContent = `${QR_REMAIN}s`;
    if (qrStatusText)
      qrStatusText.textContent = "Đang phát QR";
  } catch (e) {
    console.error("rotateQrNow:", e);
    if (qrStatusText)
      qrStatusText.textContent = "Lỗi phát QR: không ghi được Firestore.";
  }
}

function startQrRotation(eventId) {
  stopQrRotation(); // dọn sạch trước

  ACTIVE_EVENT_ID = eventId;
  if (!ACTIVE_EVENT_ID) return;

  // đổi ngay 1 cái
  rotateQrNow();

  // mỗi 20s đổi token
  QR_ROTATE_TIMER = setInterval(() => {
    rotateQrNow();
  }, QR_TTL_SECONDS * 1000);

  // mỗi 1s giảm counter
  QR_TIMER = setInterval(() => {
    if (QR_REMAIN > 0) QR_REMAIN -= 1;
    if (qrCountdown) qrCountdown.textContent = `${QR_REMAIN}s`;
  }, 1000);

  if (btnStartQr) btnStartQr.disabled = true;
  if (btnStopQr) btnStopQr.disabled = false;
}

function stopQrRotation() {
  if (QR_TIMER) clearInterval(QR_TIMER);
  if (QR_ROTATE_TIMER) clearInterval(QR_ROTATE_TIMER);

  QR_TIMER = null;
  QR_ROTATE_TIMER = null;
  QR_REMAIN = 0;
  ACTIVE_EVENT_ID = "";

  if (qrCountdown) qrCountdown.textContent = `--`;
  if (qrStatusText) qrStatusText.textContent = "Đã dừng phát QR.";
  if (qrBox) qrBox.innerHTML = "";
  QR_INSTANCE = null;

  const hasEvent = !!(checkingEventSelect?.value || "");
  if (btnStartQr) btnStartQr.disabled = !hasEvent;
  if (btnStopQr) btnStopQr.disabled = true;
}



//lấy thông tin người dùng
const USER_CACHE = new Map(); 

async function fetchUsersByUids(uids) {
  const result = new Map();
  const need = [];

  for (const uid of uids) {
    if (!uid) continue;
    if (USER_CACHE.has(uid)) result.set(uid, USER_CACHE.get(uid));
    else need.push(uid);
  }

  if (!need.length) return result;

  const CHUNK = 10;
  for (let i = 0; i < need.length; i += CHUNK) {
    const chunk = need.slice(i, i + CHUNK);
    try {
      const uq = query(collection(db, "user"), where("Uid", "in", chunk));
      const us = await getDocs(uq);

      us.forEach((d) => {
        const u = d.data();
        const uid = u.Uid || u.uid;
        if (!uid) return;

        const info = {
          name: u.UserName || "",
          mssv: u.mssv || u.Mssv || "",
          className: u.Class || "",
        };
        USER_CACHE.set(uid, info);
        result.set(uid, info);
      });

      chunk.forEach((uid) => {
        if (!result.has(uid)) {
          const info = { name: "", mssv: "", className: "" };
          USER_CACHE.set(uid, info);
          result.set(uid, info);
        }
      });
    } catch {
      for (const uid of chunk) {
        if (result.has(uid)) continue;
        try {
          const uq = query(collection(db, "user"), where("Uid", "==", uid));
          const us = await getDocs(uq);

          if (!us.empty) {
            const u = us.docs[0].data();
            const info = {
              name: u.UserName || "",
              mssv: u.mssv || u.Mssv || "",
              className: u.Class || "",
            };
            USER_CACHE.set(uid, info);
            result.set(uid, info);
          } else {
            const info = { name: "", mssv: "", className: "" };
            USER_CACHE.set(uid, info);
            result.set(uid, info);
          }
        } catch {
          const info = { name: "", mssv: "", className: "" };
          USER_CACHE.set(uid, info);
          result.set(uid, info);
        }
      }
    }
  }

  return result;
}



// thống kê tổng quan 
async function loadOverviewStats() {
  try {
    const [eventsSnap, usersSnap, regSnap] = await Promise.all([
      getDocs(collection(db, "Event")),
      getDocs(collection(db, "user")),
      getDocs(collection(db, "Registration")),
    ]);

    const totalEvents = eventsSnap.size;
    const totalUsers = usersSnap.size;
    const totalRegistrations = regSnap.size;

    let totalAttendances = 0;
    regSnap.forEach((d) => {
      const r = d.data();
      if ((r?.status || "Registered") === "Attended") totalAttendances++;
    });

    if (spanTotalEvents) spanTotalEvents.textContent = totalEvents;
    if (spanTotalUsers) spanTotalUsers.textContent = totalUsers;
    if (spanTotalRegistrations)
      spanTotalRegistrations.textContent = totalRegistrations;
    if (spanTotalAttendances)
      spanTotalAttendances.textContent = totalAttendances;
  } catch (err) {
    console.error("loadOverviewStats:", err);
  }
}



//tổng quan sự kiện
async function loadOverviewEvents() {
  if (!overviewEventTbody) return;

  overviewEventTbody.innerHTML = `<tr><td colspan="8" class="text-muted">Đang tải...</td></tr>`;

  try {
    const snap = await getDocs(collection(db, "Event"));

    if (snap.empty) {
      overviewEventTbody.innerHTML = `<tr><td colspan="8" class="text-muted">Chưa có sự kiện nào.</td></tr>`;
      return;
    }

    overviewEventTbody.innerHTML = "";

    snap.forEach((d) => {
      const ev = d.data();
      const id = d.id;

      const img = safeImg(ev.ImageUrl);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <img
            src="${img || "https://via.placeholder.com/90x50?text=No+Image"}"
            alt="${ev.Title || ""}"
            style="width: 90px; height: 50px; object-fit: cover; border-radius: 6px;"
          />
        </td>
        <td class="fw-semibold">${ev.Title || ""}</td>
        <td>${(ev.Date || "") + " " + (ev.Time || "")}</td>
        <td>${ev.Location || ""}</td>
        <td>${ev.Capacity || 0}</td>
        <td>${ev.registeredCount || 0}</td>
        <td>${ev.Status || "Open"}</td>
        <td>
          <button class="btn btn-sm btn-outline-secondary btn-view-registrations" data-id="${id}">
            Xem đăng ký
          </button>
        </td>
      `;
      overviewEventTbody.appendChild(tr);
    });

    document.querySelectorAll(".btn-view-registrations").forEach((btn) => {
      btn.addEventListener("click", onViewRegistrationsClick);
    });
  } catch (err) {
    console.error("loadOverviewEvents:", err);
    overviewEventTbody.innerHTML = `<tr><td colspan="8" class="text-danger">Không thể tải danh sách sự kiện.</td></tr>`;
  }
}

async function onViewRegistrationsClick(e) {
  const eventId = e.currentTarget.getAttribute("data-id");
  if (!eventId || !eventRegistrationsContainer) return;

  eventRegistrationsContainer.innerHTML = `
    <div class="card shadow-sm">
      <div class="card-body">Đang tải danh sách đăng ký...</div>
    </div>
  `;

  try {
    const eventSnap = await getDoc(doc(db, "Event", eventId));
    const eventTitle = eventSnap.exists()
      ? eventSnap.data().Title || ""
      : "(Sự kiện đã xóa)";

    const regQ = query(
      collection(db, "Registration"),
      where("eventId", "==", eventId)
    );
    const regSnap = await getDocs(regQ);

    if (regSnap.empty) {
      eventRegistrationsContainer.innerHTML = `
        <div class="card shadow-sm">
          <div class="card-body">
            <h6 class="mb-1">Danh sách đăng ký - ${eventTitle}</h6>
            <div class="text-muted">Chưa có ai đăng ký.</div>
          </div>
        </div>
      `;
      return;
    }

    const regs = regSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const uids = regs.map((r) => r.userId).filter(Boolean);
    const userMap = await fetchUsersByUids([...new Set(uids)]);

    const rows = [];
    let stt = 1;

    for (const reg of regs) {
      const uid = reg.userId;
      const status = reg.status || "Registered";
      const u = userMap.get(uid) || { name: "", mssv: "", className: "" };
      const st = formatStatusVi(status);

      rows.push(`
        <tr>
          <td>${stt++}</td>
          <td class="fw-semibold">${u.name || "(Không rõ)"}</td>
          <td>${u.mssv || ""}</td>
          <td>${u.className || ""}</td>
          <td><span class="badge ${st.badge}">${st.text}</span></td>
        </tr>
      `);
    }

    eventRegistrationsContainer.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-header bg-white fw-semibold">Danh sách đăng ký - ${eventTitle}</div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-bordered table-sm mb-0 align-middle">
              <thead class="table-light">
                <tr>
                  <th style="width:70px;">#</th>
                  <th>Họ tên</th>
                  <th style="width:160px;">MSSV</th>
                  <th style="width:140px;">Lớp</th>
                  <th style="width:160px;">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                ${rows.join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("onViewRegistrationsClick:", err);
    eventRegistrationsContainer.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body text-danger">Không thể tải danh sách đăng ký.</div>
      </div>
    `;
  }
}



//load danh sách sự kiện
async function loadEvents() {
  if (!eventTableBody) return;

  eventTableBody.innerHTML = `<tr><td colspan="8" class="text-muted">Đang tải...</td></tr>`;

  try {
    const snap = await getDocs(collection(db, "Event"));
    let count = 0;

    eventTableBody.innerHTML = "";

    snap.forEach((d) => {
      count++;
      const ev = d.data();
      const id = d.id;

      const img = safeImg(ev.ImageUrl);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <img
            src="${img || "https://via.placeholder.com/90x50?text=No+Image"}"
            alt="${ev.Title || ""}"
            style="width: 90px; height: 50px; object-fit: cover; border-radius: 6px;"
          />
        </td>
        <td class="fw-semibold">${ev.Title || ""}</td>
        <td>${(ev.Date || "") + " " + (ev.Time || "")}</td>
        <td>${ev.Location || ""}</td>
        <td>${ev.Capacity || 0}</td>
        <td>${ev.registeredCount || 0}</td>
        <td>${ev.Status || "Open"}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1 btn-edit-event" data-id="${id}">Sửa</button>
          <button class="btn btn-sm btn-outline-danger btn-delete-event" data-id="${id}">Xóa</button>
        </td>
      `;
      eventTableBody.appendChild(tr);
    });

    if (eventCountSpan) eventCountSpan.textContent = count;

    document.querySelectorAll(".btn-edit-event").forEach((btn) => {
      btn.addEventListener("click", onEditEventClick);
    });
    document.querySelectorAll(".btn-delete-event").forEach((btn) => {
      btn.addEventListener("click", onDeleteEventClick);
    });
  } catch (err) {
    console.error("loadEvents:", err);
    eventTableBody.innerHTML = `<tr><td colspan="8" class="text-danger">Không thể tải danh sách sự kiện.</td></tr>`;
  }
}



// quản lý sự kiện thêm xóa sửa
btnShowEventForm?.addEventListener("click", () => {
  resetEventForm();
  showEventForm();
});

btnEventCancel?.addEventListener("click", () => {
  hideEventForm();
});

eventForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = inpTitle.value.trim();
  const imageUrl = inpImageUrl.value.trim();
  const date = inpDate.value;
  const time = inpTime.value;
  const location = inpLocation.value.trim();
  const capacityVal = Number(inpCapacity.value || 0);
  const status = inpStatus.value;
  const description = inpDescription.value.trim();

  if (!title || !date || !time || !location) {
    alert("Vui lòng nhập đầy đủ thông tin bắt buộc.");
    return;
  }

  const data = {
    Title: title,
    ImageUrl: imageUrl,
    Date: date,
    Time: time,
    Location: location,
    Capacity: capacityVal,
    Status: status,
    Description: description,
    updatedAt: serverTimestamp(),
  };

  try {
    if (!editingEventId) {
      const docRef = await addDoc(collection(db, "Event"), {
        ...data,
        registeredCount: 0,
        createdAt: serverTimestamp(),
      });

      await updateDoc(docRef, { Eid: docRef.id });
      alert("Thêm sự kiện thành công!");
    } else {
      await updateDoc(doc(db, "Event", editingEventId), data);
      alert("Cập nhật sự kiện thành công!");
    }

    hideEventForm();
    await Promise.all([
      loadEvents(),
      loadOverviewEvents(),
      loadOverviewStats(),
      loadCheckingEvents(),
      loadUsersManage(),
    ]);
  } catch (err) {
    console.error("save event:", err);
    alert("Không thể lưu sự kiện.");
  }
});

async function onEditEventClick(e) {
  const id = e.currentTarget.getAttribute("data-id");
  if (!id) return;

  try {
    const snap = await getDoc(doc(db, "Event", id));
    if (!snap.exists()) {
      alert("Sự kiện không tồn tại.");
      return;
    }

    const ev = snap.data();
    editingEventId = id;
    if (formTitle) formTitle.textContent = "Chỉnh sửa sự kiện";

    inpTitle.value = ev.Title || "";
    inpImageUrl.value = ev.ImageUrl || "";
    inpDate.value = ev.Date || "";
    inpTime.value = ev.Time || "";
    inpLocation.value = ev.Location || "";
    inpCapacity.value = ev.Capacity || 0;
    inpStatus.value = ev.Status || "Open";
    inpDescription.value = ev.Description || "";

    showEventForm();
  } catch (err) {
    console.error("onEditEventClick:", err);
    alert("Không thể tải dữ liệu sự kiện.");
  }
}

async function onDeleteEventClick(e) {
  const id = e.currentTarget.getAttribute("data-id");
  if (!id) return;

  const ok = confirm("Xóa sự kiện này? (Đăng ký cũ vẫn còn trong Registration)");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "Event", id));
    await Promise.all([
      loadEvents(),
      loadOverviewEvents(),
      loadOverviewStats(),
      loadCheckingEvents(),
      loadUsersManage(),
    ]);
    alert("Xóa sự kiện thành công!");
  } catch (err) {
    console.error("delete event:", err);
    alert("Không thể xóa sự kiện.");
  }
}


// quản lý người dùng
let USERS_CACHE = [];
let USER_STATS_MAP = new Map();

async function buildEventTitleMap() {
  const map = new Map();
  const snap = await getDocs(collection(db, "Event"));
  snap.forEach((d) => {
    const ev = d.data();
    map.set(d.id, ev.Title || "(Không tên)");
  });
  return map;
}

async function buildUserStatsMap(eventTitleMap) {
  const map = new Map();

  const regSnap = await getDocs(collection(db, "Registration"));
  regSnap.forEach((r) => {
    const reg = r.data();
    const uid = reg.userId;
    const eid = reg.eventId;
    const status = reg.status || "Registered";

    if (!uid || !eid) return;
    if (!map.has(uid))
      map.set(uid, { registered: [], attended: [], absent: [] });

    const title = eventTitleMap.get(eid) || "(Sự kiện đã bị xóa)";
    const item = { eventId: eid, title };

    if (status === "Attended") map.get(uid).attended.push(item);
    else if (status === "Absent") map.get(uid).absent.push(item);
    else map.get(uid).registered.push(item);
  });

  return map;
}

function renderUsersTable(list) {
  if (!userTableBody) return;

  if (!list.length) {
    userTableBody.innerHTML = `<tr><td colspan="8" class="text-muted">Không có người dùng.</td></tr>`;
    return;
  }

  userTableBody.innerHTML = "";
  let i = 1;

  list.forEach((u) => {
    const stats = USER_STATS_MAP.get(u.uid) || {
      registered: [],
      attended: [],
      absent: [],
    };

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i++}</td>
      <td class="fw-semibold">${u.name || "(Không tên)"}</td>
      <td>${u.mssv || ""}</td>
      <td>${u.className || ""}</td>
      <td><span class="badge bg-primary">${stats.registered.length}</span></td>
      <td><span class="badge bg-success">${stats.attended.length}</span></td>
      <td><span class="badge bg-danger">${stats.absent.length}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-secondary btn-user-detail" data-uid="${u.uid}">
          Xem chi tiết
        </button>
      </td>
    `;
    userTableBody.appendChild(tr);
  });

  document.querySelectorAll(".btn-user-detail").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = btn.getAttribute("data-uid");
      showUserDetail(uid);
    });
  });
}

function listToHtml(items) {
  if (!items.length) return `<div class="text-muted">Không có.</div>`;
  return `<ul class="mb-0">${items.map((x) => `<li>${x.title}</li>`).join("")}</ul>`;
}

function showUserDetail(uid) {
  if (!userDetailContainer) return;

  const u = USERS_CACHE.find((x) => x.uid === uid);
  const stats = USER_STATS_MAP.get(uid) || {
    registered: [],
    attended: [],
    absent: [],
  };

  userDetailContainer.innerHTML = `
    <div class="card shadow-sm">
      <div class="card-header bg-white d-flex justify-content-between align-items-center">
        <div>
          <div class="fw-semibold">Chi tiết sinh viên</div>
          <div class="text-muted small">${u?.name || "(Không tên)"} • ${u?.mssv || ""} • ${u?.className || ""}</div>
        </div>
        <button class="btn btn-sm btn-outline-secondary" id="btnCloseUserDetail">Đóng</button>
      </div>

      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4">
            <div class="border rounded p-2">
              <div class="fw-semibold mb-1">Đã đăng ký (${stats.registered.length})</div>
              ${listToHtml(stats.registered)}
            </div>
          </div>

          <div class="col-md-4">
            <div class="border rounded p-2">
              <div class="fw-semibold mb-1 text-success">Đã tham gia (${stats.attended.length})</div>
              ${listToHtml(stats.attended)}
            </div>
          </div>

          <div class="col-md-4">
            <div class="border rounded p-2">
              <div class="fw-semibold mb-1 text-danger">Vắng (${stats.absent.length})</div>
              ${listToHtml(stats.absent)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btnCloseUserDetail")?.addEventListener("click", () => {
    userDetailContainer.innerHTML = "";
  });
}

function filterUsersBySearch() {
  const kw = normText(userSearchInput?.value);
  if (!kw) return USERS_CACHE;

  return USERS_CACHE.filter((u) => {
    const blob = `${u.name} ${u.mssv} ${u.className}`.toLowerCase();
    return blob.includes(kw);
  });
}

async function loadUsersManage() {
  if (!userTableBody) return;

  userTableBody.innerHTML = `<tr><td colspan="8" class="text-muted">Đang tải...</td></tr>`;
  if (userDetailContainer) userDetailContainer.innerHTML = "";

  try {
    const eventTitleMap = await buildEventTitleMap();

    const usersSnap = await getDocs(collection(db, "user"));
    const users = [];
    usersSnap.forEach((d) => {
      const u = d.data();
      const uid = u.Uid || u.uid || "";
      if (!uid) return;

      const info = {
        uid,
        name: u.UserName || "",
        mssv: u.mssv || u.Mssv || "",
        className: u.Class || "",
      };
      users.push(info);

      USER_CACHE.set(uid, {
        name: info.name,
        mssv: info.mssv,
        className: info.className,
      });
    });

    USERS_CACHE = users;
    USER_STATS_MAP = await buildUserStatsMap(eventTitleMap);

    renderUsersTable(filterUsersBySearch());
  } catch (err) {
    console.error("loadUsersManage:", err);
    userTableBody.innerHTML = `<tr><td colspan="8" class="text-danger">Không thể tải danh sách người dùng.</td></tr>`;
  }
}

userSearchInput?.addEventListener("input", () => {
  renderUsersTable(filterUsersBySearch());
});

btnReloadUsers?.addEventListener("click", () => loadUsersManage());

/* 
   13) CHECKING EVENTS + LIST
 */
const CHECKING_EVENT_MAP = new Map();

async function loadCheckingEvents() {
  if (!checkingEventSelect) return;

  checkingEventSelect.innerHTML = `<option value="">-- Chọn sự kiện --</option>`;
  CHECKING_EVENT_MAP.clear();

  try {
    const snap = await getDocs(collection(db, "Event"));
    snap.forEach((d) => {
      const ev = d.data();
      CHECKING_EVENT_MAP.set(d.id, ev);

      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${ev.Title || "(Không tên)"} • ${ev.Date || ""} ${ev.Time || ""}`;
      checkingEventSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("loadCheckingEvents:", err);
  }
}

// xác nhận tham gia bằng qr
checkingEventSelect?.addEventListener("change", async () => {
  const eventId = checkingEventSelect.value;

  if (btnExportAttendedPdf) btnExportAttendedPdf.disabled = !eventId;

  // QR buttons
  if (btnStartQr) btnStartQr.disabled = !eventId;
  if (btnStopQr) btnStopQr.disabled = true;

  // bất đầu cho qr chạy
  stopQrRotation();

  if (!eventId) {
    if (checkingTbody) {
      checkingTbody.innerHTML = `<tr><td colspan="6" class="text-muted">Chọn sự kiện để xem danh sách.</td></tr>`;
    }
    if (qrStatusText) qrStatusText.textContent = "Chọn sự kiện để bắt đầu phát QR.";
    return;
  }

  if (qrStatusText) qrStatusText.textContent = "Sẵn sàng phát QR. Bấm Bắt đầu";
  await loadCheckingList(eventId);
});

// dừng phát qr
btnStartQr?.addEventListener("click", () => {
  const eventId = checkingEventSelect?.value || "";
  if (!eventId) return;
  startQrRotation(eventId);
});

btnStopQr?.addEventListener("click", () => {
  stopQrRotation();
});

async function loadCheckingList(eventId) {
  if (!checkingTbody) return;

  checkingTbody.innerHTML = `<tr><td colspan="6" class="text-muted">Đang tải danh sách...</td></tr>`;

  try {
    const regQ = query(
      collection(db, "Registration"),
      where("eventId", "==", eventId)
    );
    const regSnap = await getDocs(regQ);

    if (regSnap.empty) {
      checkingTbody.innerHTML = `<tr><td colspan="6" class="text-muted">Chưa có ai đăng ký.</td></tr>`;
      return;
    }

    const regs = regSnap.docs.map((d) => ({ regId: d.id, ...d.data() }));
    const uids = regs.map((r) => r.userId).filter(Boolean);
    const userMap = await fetchUsersByUids([...new Set(uids)]);

    const rows = [];
    let stt = 1;

    for (const reg of regs) {
      const regId = reg.regId;
      const status = reg.status || "Registered";

      const u = userMap.get(reg.userId) || { name: "", mssv: "", className: "" };
      const st = formatStatusVi(status);

      rows.push(`
        <tr>
          <td>${stt++}</td>
          <td class="fw-semibold">${u.name || "(Không rõ)"}</td>
          <td>${u.mssv || ""}</td>
          <td>${u.className || ""}</td>
          <td><span class="badge ${st.badge}">${st.text}</span></td>
          <td>
            <button class="btn btn-sm btn-success me-1 btn-mark-status" data-reg="${regId}" data-status="Attended">Tham gia</button>
            <button class="btn btn-sm btn-danger me-1 btn-mark-status" data-reg="${regId}" data-status="Absent">Vắng</button>
            <button class="btn btn-sm btn-outline-secondary btn-mark-status" data-reg="${regId}" data-status="Registered">Sửa</button>
          </td>
        </tr>
      `);
    }

    checkingTbody.innerHTML = rows.join("");

    document.querySelectorAll(".btn-mark-status").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const regId = btn.getAttribute("data-reg");
        const status = btn.getAttribute("data-status");
        if (!regId || !status) return;

        await updateRegistrationStatus(regId, status);
        await Promise.all([
          loadCheckingList(eventId),
          loadOverviewStats(),
          loadUsersManage(),
          loadOverviewEvents(),
        ]);
      });
    });
  } catch (err) {
    console.error("loadCheckingList:", err);
    checkingTbody.innerHTML = `<tr><td colspan="6" class="text-danger">Không thể tải danh sách.</td></tr>`;
  }
}

async function updateRegistrationStatus(regId, status) {
  try {
    await updateDoc(doc(db, "Registration", regId), {
      status,
      checkedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("updateRegistrationStatus:", err);
    alert("Không thể cập nhật trạng thái.");
  }
}


// xuat file fdf

function formatDateVN(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateLongVN(d = new Date()) {
  const dd = d.getDate();
  const mm = d.getMonth() + 1;
  const yyyy = d.getFullYear();
  return `ngày ${dd} tháng ${mm} năm ${yyyy}`;
}

function parseEventDate(ev) {
  if (ev?.Date) {
    const parts = ev.Date.split("-");
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const dt = new Date(y, m, day);
      if (!isNaN(dt.getTime())) return dt;
    }
  }
  return new Date();
}

async function tryLoadTimesNewRoman(docPdf) {
  try {
    const r1 = await fetch("./font/times.ttf");
    if (!r1.ok) return { ok: false, hasBold: false, hasItalic: false };

    const b1 = new Uint8Array(await r1.arrayBuffer());
    let bin1 = "";
    for (let i = 0; i < b1.length; i++) bin1 += String.fromCharCode(b1[i]);

    docPdf.addFileToVFS("times.ttf", btoa(bin1));
    docPdf.addFont("times.ttf", "TimesNewRoman", "normal");

    let hasBold = false;
    const r2 = await fetch("./font/timesbd.ttf");
    if (r2.ok) {
      const b2 = new Uint8Array(await r2.arrayBuffer());
      let bin2 = "";
      for (let i = 0; i < b2.length; i++) bin2 += String.fromCharCode(b2[i]);

      docPdf.addFileToVFS("timesbd.ttf", btoa(bin2));
      docPdf.addFont("timesbd.ttf", "TimesNewRoman", "bold");
      hasBold = true;
    }

    let hasItalic = false;
    const r3 = await fetch("./font/timesi.ttf");
    if (r3.ok) {
      const b3 = new Uint8Array(await r3.arrayBuffer());
      let bin3 = "";
      for (let i = 0; i < b3.length; i++) bin3 += String.fromCharCode(b3[i]);

      docPdf.addFileToVFS("timesi.ttf", btoa(bin3));
      docPdf.addFont("timesi.ttf", "TimesNewRoman", "italic");
      hasItalic = true;
    }

    docPdf.setFont("TimesNewRoman", "normal");
    return { ok: true, hasBold, hasItalic };
  } catch (e) {
    console.error("tryLoadTimesNewRoman:", e);
    return { ok: false, hasBold: false, hasItalic: false };
  }
}

function drawUnderline(docPdf, x1, y, x2) {
  docPdf.setLineWidth(0.4);
  docPdf.line(x1, y, x2, y);
}

btnExportAttendedPdf?.addEventListener("click", async () => {
  const eventId = checkingEventSelect?.value;
  if (!eventId) return;

  try {
    await exportAttendedListPdf(eventId);
  } catch (e) {
    console.error("export pdf:", e);
    alert("Không thể xuất PDF.");
  }
});

async function exportAttendedListPdf(eventId) {
  const evSnap = await getDoc(doc(db, "Event", eventId));
  const ev = evSnap.exists() ? evSnap.data() : {};
  const eventTitle = ev?.Title || "SỰ KIỆN";

  const regQ = query(collection(db, "Registration"), where("eventId", "==", eventId));
  const regSnap = await getDocs(regQ);

  if (regSnap.empty) {
    alert("Chưa có ai đăng ký.");
    return;
  }

  const regsAll = regSnap.docs.map((d) => ({ regId: d.id, ...d.data() }));
  const regs = regsAll.filter((r) => (r.status || "Registered") === "Attended");

  if (!regs.length) {
    alert("Chưa có ai được xác nhận 'Đã tham gia'.");
    return;
  }

  const uids = regs.map((r) => r.userId).filter(Boolean);
  const userMap = await fetchUsersByUids([...new Set(uids)]);

  const rows = regs.map((r, idx) => {
    const u = userMap.get(r.userId) || { name: "", mssv: "", className: "" };
    return [String(idx + 1), u.name || "", u.mssv || "", u.className || "", ""];
  });

  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  const docPdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const fontInfo = await tryLoadTimesNewRoman(docPdf);
  if (!fontInfo.ok) {
    alert("Không tải được font Times New Roman. Kiểm tra ./font/times.ttf");
    return;
  }

  const W = docPdf.internal.pageSize.getWidth();
  const H = docPdf.internal.pageSize.getHeight();
  const M = 15;

  const colW = (W - 2 * M) / 2;
  const leftX = M;
  const rightX = M + colW;
  const topY = 18;

  docPdf.setFont("TimesNewRoman", fontInfo.hasBold ? "bold" : "normal");
  docPdf.setFontSize(14);

  const leftLines = [
    "ĐOÀN TRƯỜNG KT&CN",
    "BAN CHỦ NHIỆM",
    (ev?.ClubName || "CLB CẦU LÔNG").toUpperCase(),
    "***",
  ];
  let yL = topY;
  leftLines.forEach((line) => {
    docPdf.text(line, leftX + colW / 2, yL, { align: "center" });
    yL += 7;
  });

  docPdf.setFont("TimesNewRoman", fontInfo.hasBold ? "bold" : "normal");
  docPdf.setFontSize(14);

  const rightTitle = "ĐOÀN TNCS HỒ CHÍ MINH";
  docPdf.text(rightTitle, rightX + colW / 2, topY, { align: "center" });

  const rightTitleWidth = docPdf.getTextWidth(rightTitle);
  const ux1 = rightX + (colW - rightTitleWidth) / 2;
  const ux2 = ux1 + rightTitleWidth;
  drawUnderline(docPdf, ux1, topY + 1.5, ux2);

  const eventDateObj = parseEventDate(ev);
  const place = ev?.Place || ev?.Province || ev?.City || "Vĩnh Long";
  const rightDateLine = `${place}, ${formatDateLongVN(eventDateObj)}`;

  docPdf.setFont("TimesNewRoman", fontInfo.hasItalic ? "italic" : "normal");
  docPdf.setFontSize(13);
  docPdf.text(rightDateLine, rightX + colW / 2, topY + 18, { align: "center" });

  const titleY = topY + 40;

  docPdf.setFont("TimesNewRoman", fontInfo.hasBold ? "bold" : "normal");
  docPdf.setFontSize(16);
  docPdf.text("DANH SÁCH THAM GIA", W / 2, titleY, { align: "center" });

 
  docPdf.setFont("TimesNewRoman", fontInfo.hasBold ? "bold" : "normal");
  docPdf.setFontSize(16); 

  const maxTitleWidth = W - 2 * M;
  const titleLines = docPdf.splitTextToSize(eventTitle.toUpperCase(), maxTitleWidth);

  let curY = titleY + 11;
  titleLines.forEach((line) => {
    docPdf.text(line, W / 2, curY, { align: "center" });
    curY += 8; 
  });

  const locationLine = (ev?.Location || "").trim();
  const labelX = M;
  const valueX = M + 22;
  const maxValueWidth = W - M - valueX;

  const infoY = curY + 2;

  docPdf.setFont("TimesNewRoman", fontInfo.hasBold ? "bold" : "normal");
  docPdf.setFontSize(13);
  docPdf.text("Địa điểm:", labelX, infoY);

  docPdf.setFont("TimesNewRoman", "normal");
  docPdf.setFontSize(13);

  const locationLines = docPdf.splitTextToSize(locationLine, maxValueWidth);
  docPdf.text(locationLines[0] || "", valueX, infoY);

  let infoEndY = infoY;
  for (let i = 1; i < locationLines.length; i++) {
    infoEndY += 7;
    docPdf.text(locationLines[i], valueX, infoEndY);
  }

  const startY = infoEndY + 10;

  docPdf.setFont("TimesNewRoman", "normal");
  docPdf.setFontSize(12);

  docPdf.autoTable({
    startY,
    head: [["STT", "HỌ TÊN", "MÃ SV", "MÃ LỚP", "GHI CHÚ"]],
    body: rows,
    theme: "grid",
    styles: {
      font: "TimesNewRoman",
      fontSize: 12,
      cellPadding: 2.2,
      overflow: "linebreak",
      valign: "middle",
      textColor: 0,
      lineWidth: 0.4,
      lineColor: 0,
    },
    headStyles: {
      font: "TimesNewRoman",
      fontStyle: fontInfo.hasBold ? "bold" : "normal",
      fillColor: 255,
      textColor: 0,
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: 70, halign: "left" },
      2: { cellWidth: 35, halign: "center" },
      3: { cellWidth: 30, halign: "center" },
      4: { cellWidth: 26, halign: "left" },
    },
    margin: { left: M, right: M },
  });

  const lastTbl = docPdf.lastAutoTable || docPdf.previousAutoTable;
  const finalY = lastTbl?.finalY || startY + 60;

  const sigBlockHeight = 35;
  if (finalY + sigBlockHeight > H - 10) docPdf.addPage();

  const sigY = Math.min(docPdf.internal.pageSize.getHeight() - 45, finalY + 18);


  const sigX = rightX + colW / 2 + 12; 

  docPdf.setFont("TimesNewRoman", fontInfo.hasBold ? "bold" : "normal");
  docPdf.setFontSize(13);
  docPdf.text("Trưởng CLB", sigX, sigY, { align: "center" });

  docPdf.setFont("TimesNewRoman", fontInfo.hasItalic ? "italic" : "normal");
  docPdf.setFontSize(12);
  docPdf.text("(Ký, ghi rõ họ tên)", sigX, sigY + 7, { align: "center" });

  const fileName = `DS_ThamGia_${sanitizeFileName(eventTitle)}_${formatDateVN(new Date()).replaceAll(
    "/",
    "-"
  )}.pdf`;
  docPdf.save(fileName);
}



// khởi tạo
setupTabs();
loadEvents();
loadOverviewEvents();
loadOverviewStats();
loadUsersManage();
loadCheckingEvents();
