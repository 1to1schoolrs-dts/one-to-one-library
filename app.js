// ============================================
// APP CORE - Navigation, Modal, Toast
// ============================================

let currentPage = 'home';

function showApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('splash').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('userGreeting').textContent = currentUser?.name?.split(' ')[0] || '';
  navigate('home');
}

function navigate(page) {
  currentPage = page;
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + page);
  if (navBtn) navBtn.classList.add('active');

  const content = document.getElementById('mainContent');

  switch (page) {
    case 'home':      renderHome(content); break;
    case 'ebook':     renderEbook(content); break;
    case 'booklist':  renderBooklist(content); break;
    case 'personal':  renderPersonal(content); break;
    case 'dashboard': renderDashboard(content); break;
    case 'admin':     renderAdmin(content); break;
  }
}

// ---- MODAL ----
function showModal(html) {
  document.getElementById('modalBox').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal')) return;
  document.getElementById('modal').classList.add('hidden');
}

// ---- TOAST ----
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), duration);
}

// ---- HELPERS ----
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} মিনিট আগে`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ঘণ্টা আগে`;
  const days = Math.floor(hrs / 24);
  return `${days} দিন আগে`;
}

async function getSettings() {
  try {
    const doc = await db.collection(SETTINGS_COL).doc('config').get();
    if (doc.exists) return doc.data();
  } catch(e) {}
  return { whatsapp: '01XXXXXXXXX', fbPage: '', adminPhone: '01XXXXXXXXX', adminPass: 'admin123' };
}

function buildWhatsAppLink(phone, msg) {
  const num = phone.replace(/^0/, '880');
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

function buildFbLink(page) {
  return page ? `https://m.me/${page}` : null;
}

// ---- INIT ----
window.addEventListener('load', async () => {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  // Show splash for 1.5s then init auth
  setTimeout(async () => {
    await initAuth();
    document.getElementById('splash').classList.add('hidden');
  }, 1500);
});
