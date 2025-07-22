import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  // ✅ แสดงชื่อเล่นจาก Firestore
  try {
    const userDoc = await getDoc(doc(db, "users", user.email));
    if (userDoc.exists()) {
      const { nickname } = userDoc.data();
      const nicknameEl = document.getElementById("nicknameDisplay");
      if (nicknameEl) nicknameEl.innerText = `👋 สวัสดี, ${nickname}`;
    }
  } catch (e) {
    console.error("ไม่สามารถโหลดชื่อเล่น:", e);
  }

  document.getElementById("logoutBtn").addEventListener("click", () => {
    signOut(auth).then(() => location.href = "index.html");
  });

  // 🔒 เฉพาะ admin
  const isAdmin = user.email === "admin@example.com";
  if (isAdmin) {
    document.getElementById("adminPanel").style.display = "block";
    document.getElementById("resetBtn").addEventListener("click", async () => {
      if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมด?")) {
        const q = query(collection(db, "payments"));
        const snapshot = await getDocs(q);
        for (const docu of snapshot.docs) {
          await deleteDoc(doc(db, "payments", docu.id));
        }
        alert("ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว");
        location.reload();
      }
    });
  }

  // ✅ บันทึกข้อมูลจ่ายเงิน
  const form = document.getElementById("paymentForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById("amount").value);
    if (isNaN(amount) || amount <= 0) return alert("กรุณากรอกจำนวนเงินที่ถูกต้อง");

    await addDoc(collection(db, "payments"), {
      userId: user.uid,
      email: user.email,
      amount,
      date: new Date().toISOString().slice(0, 10),
      timestamp: Date.now()
    });

    alert("บันทึกเรียบร้อยแล้ว");
    form.reset();
    await loadData(user);
  });

  await loadData(user);
});

// ✅ โหลดข้อมูลสร้างกราฟ
async function loadData(user) {
  const paymentsSnapshot = await getDocs(query(
    collection(db, "payments"),
    orderBy("timestamp", "asc")
  ));
  const data = paymentsSnapshot.docs.map(doc => doc.data());

  // กราฟรวมรายวัน
  const dailyTotals = {};
  data.forEach(d => {
    if (!dailyTotals[d.date]) dailyTotals[d.date] = 0;
    dailyTotals[d.date] += d.amount;
  });

  const dailyLabels = Object.keys(dailyTotals);
  const dailyAmounts = Object.values(dailyTotals);
  renderChart("dailyChart", "ยอดรวมรายวัน", dailyLabels, dailyAmounts);

  // กราฟของผู้ใช้
  const userData = data.filter(d => d.userId === user.uid);
  const userTotals = {};
  userData.forEach(d => {
    if (!userTotals[d.date]) userTotals[d.date] = 0;
    userTotals[d.date] += d.amount;
  });

  const userLabels = Object.keys(userTotals);
  const userAmounts = Object.values(userTotals);
  renderChart("myChart", "ยอดของฉัน", userLabels, userAmounts);

  // ✅ แสดงยอดรวมทั้งหมด
  const totalSum = data.reduce((sum, item) => sum + item.amount, 0);
  const totalSumEl = document.getElementById("totalSum");
  if (totalSumEl) {
    totalSumEl.innerText = `💰 ยอดรวมทั้งหมด: ${totalSum.toLocaleString()} บาท`;
  }
}

// ✅ ป้องกันกราฟซ้อน
function renderChart(canvasId, label, labels, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn(`ไม่พบ canvas: ${canvasId}`);
    return;
  }

  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }

  const ctx = canvas.getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: "#0984e3"
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}
