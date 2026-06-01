// ============================================
// HOME PAGE
// ============================================

async function renderHome(container) {
  container.innerHTML = `
    <div class="page">
      <div class="home-banner">
        <h2>স্বাগতম, ${currentUser?.name?.split(' ')[0] || 'বন্ধু'}! 👋</h2>
        <p>পাঠশালা লাইব্রেরিতে আপনাকে স্বাগতম</p>
      </div>

      <div class="section-header">
        <span class="section-title">ফিচারসমূহ</span>
      </div>

      <div class="feature-grid">
        <div class="feature-card" onclick="navigate('ebook')">
          <div class="f-icon">📖</div>
          <div class="f-title">ই-বুক লাইব্রেরি</div>
          <div class="f-sub">PDF আপলোড ও ডাউনলোড</div>
        </div>
        <div class="feature-card" onclick="navigate('booklist')">
          <div class="f-icon">🛒</div>
          <div class="f-title">বইয়ের তালিকা</div>
          <div class="f-sub">অর্ডার করুন</div>
        </div>
        <div class="feature-card accent" onclick="navigate('personal')">
          <div class="f-icon">🏡</div>
          <div class="f-title">ব্যক্তিগত লাইব্রেরি</div>
          <div class="f-sub">ধার নিন / দিন</div>
        </div>
        <div class="feature-card" onclick="navigate('dashboard')">
          <div class="f-icon">📊</div>
          <div class="f-title">আমার হিস্টরি</div>
          <div class="f-sub">লেনদেনের তথ্য</div>
        </div>
      </div>

      <div id="homeStats"></div>

      <div class="card">
        <div class="card-title">📢 সাম্প্রতিক বই</div>
        <div id="recentBooks"><div class="text-muted text-sm">লোড হচ্ছে...</div></div>
      </div>
    </div>
  `;
  loadHomeStats();
  loadRecentBooks();
}

async function loadHomeStats() {
  try {
    const [ebooks, books, personal] = await Promise.all([
      db.collection(EBOOKS_COL).get(),
      db.collection(BOOKLIST_COL).get(),
      db.collection(PERSONAL_COL).get()
    ]);
    const el = document.getElementById('homeStats');
    if (!el) return;
    el.innerHTML = `
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-num">${ebooks.size}</div>
          <div class="stat-lbl">ই-বুক</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${books.size}</div>
          <div class="stat-lbl">বইয়ের তালিকা</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${personal.size}</div>
          <div class="stat-lbl">ব্যক্তিগত</div>
        </div>
      </div>
    `;
  } catch(e) {}
}

async function loadRecentBooks() {
  try {
    const snap = await db.collection(EBOOKS_COL)
      .orderBy('createdAt', 'desc').limit(3).get();
    const el = document.getElementById('recentBooks');
    if (!el) return;
    if (snap.empty) {
      el.innerHTML = `<div class="empty-state"><p>এখনো কোনো বই নেই</p></div>`;
      return;
    }
    el.innerHTML = snap.docs.map(d => {
      const b = d.data();
      return `
        <div class="list-item">
          <div>
            <div style="font-weight:600;font-size:14px;">${b.title}</div>
            <div class="text-muted text-sm">${b.author || ''} · ${timeAgo(b.createdAt)}</div>
          </div>
          <button class="btn-secondary btn-sm" onclick="navigate('ebook')">দেখুন</button>
        </div>
      `;
    }).join('');
  } catch(e) {}
}
