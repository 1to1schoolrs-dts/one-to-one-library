// ============================================
// BOOK LIST FEATURE (Feature 3)
// ============================================

async function renderBooklist(container) {
  container.innerHTML = `
    <div class="page">
      <div class="section-header">
        <span class="section-title">🛒 বইয়ের তালিকা</span>
        <button class="btn-accent btn-sm" onclick="showAddBookToList()">+ যোগ করুন</button>
      </div>
      <div class="search-bar">
        <span>🔍</span>
        <input type="text" id="blSearch" placeholder="নাম, লেখক বা প্রকাশনী খুঁজুন..." oninput="filterBooklist(this.value)">
      </div>
      <div id="booklistItems"><div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div></div>
    </div>
  `;
  loadBooklist();
}

async function loadBooklist(search = '') {
  const el = document.getElementById('booklistItems');
  if (!el) return;
  try {
    const snap = await db.collection(BOOKLIST_COL).orderBy('createdAt', 'desc').get();
    let books = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (search) {
      const s = search.toLowerCase();
      books = books.filter(b =>
        b.title?.toLowerCase().includes(s) ||
        b.author?.toLowerCase().includes(s) ||
        b.publisher?.toLowerCase().includes(s)
      );
    }

    if (books.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>কোনো বই নেই</p></div>`;
      return;
    }

    el.innerHTML = books.map(b => `
      <div class="book-card">
        <div class="book-card-title">📗 ${b.title}</div>
        <div class="book-card-meta">
          ${b.author ? `<span>✍️ ${b.author}</span>` : ''}
          ${b.publisher ? `<span>🏢 ${b.publisher}</span>` : ''}
          ${b.price ? `<span>💰 ৳${b.price}</span>` : ''}
        </div>
        ${b.notes ? `<div class="text-sm text-muted">${b.notes}</div>` : ''}
        <div class="book-card-actions">
          <button class="btn-primary btn-sm" onclick="showBookOrder('${b.id}','${escHtml(b.title)}','${b.price||0}')">🛒 অর্ডার করুন</button>
        </div>
      </div>
    `).join('');
  } catch(e) {
    el.innerHTML = `<div class="empty-state"><p>লোড করতে সমস্যা হয়েছে</p></div>`;
  }
}

function filterBooklist(val) {
  loadBooklist(val);
}

function showAddBookToList() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📗 বই যোগ করুন</div>
    <div class="input-group">
      <label>বইয়ের নাম *</label>
      <input type="text" id="blTitle" placeholder="বইয়ের নাম">
    </div>
    <div class="input-group">
      <label>লেখক</label>
      <input type="text" id="blAuthor" placeholder="লেখকের নাম">
    </div>
    <div class="input-group">
      <label>প্রকাশনী</label>
      <input type="text" id="blPublisher" placeholder="প্রকাশনীর নাম">
    </div>
    <div class="input-group">
      <label>মূল্য (টাকা)</label>
      <input type="number" id="blPrice" placeholder="০" min="0">
    </div>
    <div class="input-group">
      <label>অতিরিক্ত তথ্য (ঐচ্ছিক)</label>
      <textarea id="blNotes" placeholder="সংস্করণ, ISBN ইত্যাদি..."></textarea>
    </div>
    <button class="btn-primary" onclick="submitBookToList()">যোগ করুন</button>
  `);
}

async function submitBookToList() {
  const title = document.getElementById('blTitle').value.trim();
  if (!title) return showToast('বইয়ের নাম দিন');

  try {
    await db.collection(BOOKLIST_COL).add({
      title,
      author: document.getElementById('blAuthor').value.trim(),
      publisher: document.getElementById('blPublisher').value.trim(),
      price: Number(document.getElementById('blPrice').value) || 0,
      notes: document.getElementById('blNotes').value.trim(),
      addedBy: currentUser.phone,
      addedByName: currentUser.name,
      createdAt: new Date().toISOString()
    });
    closeModal();
    showToast('✅ বই তালিকায় যোগ হয়েছে!');
    navigate('booklist');
  } catch(e) {
    showToast('সমস্যা হয়েছে');
  }
}

async function showBookOrder(bookId, bookTitle, price) {
  const settings = await getSettings();
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🛒 বই অর্ডার</div>
    <div class="card" style="margin-bottom:14px;">
      <div class="text-sm text-muted">বইয়ের নাম</div>
      <div style="font-weight:600;">${bookTitle}</div>
      ${price ? `<div style="color:var(--primary);font-weight:600;margin-top:4px;">৳${price} প্রতি কপি</div>` : ''}
    </div>
    <div class="input-group">
      <label>কপির সংখ্যা</label>
      <input type="number" id="blQty" value="1" min="1" max="50" oninput="updateBookOrderTotal(${price})">
    </div>
    ${price ? `<div class="card" style="margin-bottom:14px;background:#f0f9f4;">
      <div class="flex-between">
        <span class="text-sm">মোট মূল্য (আনুমানিক)</span>
        <span id="blTotal" style="font-weight:700;color:var(--primary);">৳${price}</span>
      </div>
    </div>` : ''}
    <div class="input-group">
      <label>ডেলিভারি ঠিকানা</label>
      <textarea id="blAddress" placeholder="আপনার সম্পূর্ণ ঠিকানা">${currentUser.village || ''}, ${currentUser.upazila || ''}, ${currentUser.district || ''}</textarea>
    </div>
    <div class="input-group">
      <label>বিশেষ নির্দেশনা (ঐচ্ছিক)</label>
      <input type="text" id="blOrderNote" placeholder="যেকোনো নির্দেশনা">
    </div>
    <div style="display:flex;gap:8px;margin-top:4px;">
      ${settings.whatsapp ? `<button class="btn-primary btn-sm" style="flex:1;" onclick="sendBookOrderWA('${bookId}','${escHtml(bookTitle)}',${price},'${settings.whatsapp}')">📱 WhatsApp অর্ডার</button>` : ''}
      ${settings.fbPage ? `<a href="${buildFbLink(settings.fbPage)}" target="_blank" class="btn-secondary btn-sm" style="flex:1;text-decoration:none;text-align:center;display:block;">📘 Facebook অর্ডার</a>` : ''}
    </div>
  `);
}

function updateBookOrderTotal(price) {
  const qty = Number(document.getElementById('blQty').value) || 1;
  const el = document.getElementById('blTotal');
  if (el) el.textContent = `৳${price * qty}`;
}

async function sendBookOrderWA(bookId, bookTitle, price, waNum) {
  const qty = Number(document.getElementById('blQty').value) || 1;
  const address = document.getElementById('blAddress').value;
  const note = document.getElementById('blOrderNote').value;

  const msg = `📦 বই অর্ডার\n\nবই: ${bookTitle}\nসংখ্যা: ${qty} কপি\n${price ? `মোট: ৳${price * qty}\n` : ''}ঠিকানা: ${address}\nনোট: ${note || 'নেই'}\n\nঅর্ডারকারী: ${currentUser.name}\nমোবাইল: ${currentUser.phone}`;

  await db.collection(ORDERS_COL).add({
    type: 'book',
    bookId, bookTitle, qty, price,
    total: price * qty,
    address,
    note,
    userPhone: currentUser.phone,
    userName: currentUser.name,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  window.open(buildWhatsAppLink(waNum, msg), '_blank');
  closeModal();
  showToast('✅ অর্ডার পাঠানো হয়েছে!');
}
