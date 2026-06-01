// ============================================
// বইয়ের তালিকা — ই-বুক + ব্যক্তিগত একসাথে
// ============================================

async function renderBooklist(container) {
  container.innerHTML = `
    <div class="page">
      <div class="section-header">
        <span class="section-title">📚 সকল বইয়ের তালিকা</span>
      </div>
      <div class="search-bar">
        <span>🔍</span>
        <input type="text" id="blSearch" placeholder="বই বা লেখকের নাম খুঁজুন..." oninput="filterAllBooks(this.value)">
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button class="btn-primary btn-sm" onclick="switchBookTab('all')" id="btab-all">সব বই</button>
        <button class="btn-secondary btn-sm" onclick="switchBookTab('ebook')" id="btab-ebook">📖 ই-বুক</button>
        <button class="btn-secondary btn-sm" onclick="switchBookTab('personal')" id="btab-personal">🏡 ব্যক্তিগত</button>
      </div>
      <div id="allBooksList"><div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div></div>
    </div>
  `;
  loadAllBooks('all', '');
}

let currentBookTab = 'all';

function switchBookTab(tab) {
  currentBookTab = tab;
  ['all','ebook','personal'].forEach(t => {
    const b = document.getElementById('btab-'+t);
    if (b) b.className = t===tab ? 'btn-primary btn-sm' : 'btn-secondary btn-sm';
  });
  const search = document.getElementById('blSearch')?.value || '';
  loadAllBooks(tab, search);
}

function filterAllBooks(val) {
  loadAllBooks(currentBookTab, val);
}

async function loadAllBooks(tab, search) {
  const el = document.getElementById('allBooksList');
  if (!el) return;
  el.innerHTML = '<div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div>';
  try {
    let books = [];

    if (tab === 'all' || tab === 'ebook') {
      const snap = await db.collection(EBOOKS_COL).orderBy('createdAt','desc').get();
      snap.docs.forEach(d => books.push({ id: d.id, source: 'ebook', ...d.data() }));
    }
    if (tab === 'all' || tab === 'personal') {
      const snap = await db.collection(PERSONAL_COL).orderBy('createdAt','desc').get();
      snap.docs.forEach(d => books.push({ id: d.id, source: 'personal', ...d.data() }));
    }

    if (search) {
      const s = search.toLowerCase();
      books = books.filter(b =>
        b.title?.toLowerCase().includes(s) ||
        b.author?.toLowerCase().includes(s) ||
        b.ownerName?.toLowerCase().includes(s)
      );
    }

    if (books.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>কোনো বই পাওয়া যায়নি</p></div>`;
      return;
    }

    el.innerHTML = books.map(b => {
      const isEbook = b.source === 'ebook';
      const badge = isEbook
        ? `<span class="badge badge-blue">ই-বুক</span>`
        : `<span class="badge ${b.available!==false?'badge-green':'badge-red'}">${b.available!==false?'পাওয়া যাচ্ছে':'ধার দেওয়া'}</span>`;

      return `
        <div class="book-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div class="book-card-title">${isEbook?'📖':'📕'} ${b.title}</div>
            ${badge}
          </div>
          <div class="book-card-meta">
            ${b.author?`<span>✍️ ${b.author}</span>`:''}
            ${isEbook?`<span>👤 ${b.uploaderName||''}</span>`:`<span>👤 ${b.ownerName||''} · 📍 ${b.ownerVillage||''}, ${b.ownerUpazila||''}</span>`}
          </div>
          <div class="book-card-actions" style="align-items:center;">
            ${isEbook?`<a href="${b.link}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;display:inline-block;">📥 পড়ুন</a>`:''}
            <button class="print-order-btn" onclick="showBookPrintOrder('${b.id}','${escHtml(b.title)}','${b.source}')">
              🖨️ স্বল্প মূল্যে প্রিন্ট করুন
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div class="empty-state"><p>লোড করতে সমস্যা হয়েছে</p></div>`;
    console.error(e);
  }
}

async function showBookPrintOrder(bookId, bookTitle, source) {
  const settings = await getSettings();
  const waNum = settings.whatsapp || '01521256504';
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🖨️ প্রিন্ট অর্ডার</div>
    <div class="card" style="margin-bottom:14px;background:#f0f9f4;">
      <div class="text-sm text-muted">বইয়ের নাম</div>
      <div style="font-weight:600;">${bookTitle}</div>
    </div>
    <div class="input-group">
      <label>কপির সংখ্যা</label>
      <input type="number" id="poQty" value="1" min="1" max="100">
    </div>
    <div class="input-group">
      <label>বাঁধাই ধরন</label>
      <select id="poType">
        <option>সাধারণ স্টেপলার বাঁধাই</option>
        <option>পার্ফেক্ট বাইন্ডিং</option>
        <option>রিং বাইন্ডিং</option>
      </select>
    </div>
    <div class="input-group">
      <label>ডেলিভারি ঠিকানা</label>
      <textarea id="poAddress" placeholder="আপনার সম্পূর্ণ ঠিকানা">${currentUser.village||''}, ${currentUser.upazila||''}, ${currentUser.district||''}</textarea>
    </div>
    <div class="input-group">
      <label>বিশেষ নির্দেশনা (ঐচ্ছিক)</label>
      <input type="text" id="poNote" placeholder="রঙিন/সাদাকালো, কাগজের সাইজ...">
    </div>
    <button class="btn-primary btn-full" onclick="sendBookPrintWA('${bookId}','${escHtml(bookTitle)}','${source}','${waNum}')">
      📱 WhatsApp-এ অর্ডার পাঠান
    </button>
    ${settings.fbPage?`<a href="https://m.me/${settings.fbPage}" target="_blank" class="btn-secondary btn-full" style="text-decoration:none;display:block;text-align:center;margin-top:8px;">📘 Facebook-এ অর্ডার</a>`:''}
  `);
}

async function sendBookPrintWA(bookId, bookTitle, source, waNum) {
  const qty = document.getElementById('poQty').value;
  const type = document.getElementById('poType').value;
  const address = document.getElementById('poAddress').value;
  const note = document.getElementById('poNote').value;

  const msg = `🖨️ প্রিন্ট অর্ডার\n\nবই: ${bookTitle}\nকপি: ${qty}\nধরন: ${type}\nঠিকানা: ${address}\nনোট: ${note||'নেই'}\n\nঅর্ডারকারী: ${currentUser.name}\nমোবাইল: ${currentUser.phone}`;

  await db.collection(ORDERS_COL).add({
    type: 'print', bookId, bookTitle, source,
    qty: Number(qty), bindingType: type,
    address, note,
    userPhone: currentUser.phone, userName: currentUser.name,
    status: 'pending', createdAt: new Date().toISOString()
  });

  window.open(buildWhatsAppLink(waNum, msg), '_blank');
  closeModal();
  showToast('✅ অর্ডার পাঠানো হয়েছে!');
}
