async function renderHome(container) {
  container.innerHTML = `
    <div class="page">
      <div class="home-banner">
        <h2>স্বাগতম, ${currentUser?.name?.split(' ')[0]||'বন্ধু'}! 👋</h2>
        <p>ওয়ান টু ওয়ান লাইব্রেরিতে আপনাকে স্বাগতম</p>
      </div>
      <div class="section-header"><span class="section-title">ফিচারসমূহ</span></div>
      <div class="feature-grid">
        <div class="feature-card" onclick="navigate('ebook')">
          <div class="f-icon">📖</div>
          <div class="f-title">ই-বুক লাইব্রেরি</div>
          <div class="f-sub">PDF পড়ুন ও শেয়ার করুন</div>
        </div>
        <div class="feature-card" onclick="navigate('bookshop')">
          <div class="f-icon">🛍️</div>
          <div class="f-title">বই কিনুন</div>
          <div class="f-sub">বক্র ক্রয় ও বিক্রয় করুন</div>
        </div>
        <div class="feature-card accent" onclick="navigate('personal')">
          <div class="f-icon">🏡</div>
          <div class="f-title">উন্মুক্ত পাঠাগার</div>
          <span class="borrow-label">📦 হার্ড কপি ধার দিন / নিন</span>
        </div>
        <div class="feature-card" onclick="navigate('dashboard')">
          <div class="f-icon">📊</div>
          <div class="f-title">আমার হিস্টরি</div>
          <div class="f-sub">লেনদেনের তথ্য</div>
        </div>
      </div>
      <div id="homeStats"></div>
    </div>`;
  loadHomeStats();
}

async function loadHomeStats() {
  try {
    const [ebooks,personal,shop]=await Promise.all([
      db.collection(EBOOKS_COL).get(),
      db.collection(PERSONAL_COL).get(),
      db.collection('bookshop').get()
    ]);
    const el=document.getElementById('homeStats');if(!el)return;
    el.innerHTML=`<div class="stats-row">
      <div class="stat-box"><div class="stat-num">${ebooks.size}</div><div class="stat-lbl">ই-বুক</div></div>
      <div class="stat-box"><div class="stat-num">${personal.size}</div><div class="stat-lbl">ব্যক্তিগত বই</div></div>
      <div class="stat-box"><div class="stat-num">${shop.size}</div><div class="stat-lbl">বিক্রয়ের বই</div></div>
    </div>`;
  } catch(e){}
}
