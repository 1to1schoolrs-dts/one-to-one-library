// ============================================
// PERSONAL LIBRARY (Feature 4)
// ============================================

async function renderPersonal(container) {
  container.innerHTML = `
    <div class="page">
      <div class="section-header">
        <span class="section-title">🏡 ব্যক্তিগত লাইব্রেরি</span>
        <button class="btn-accent btn-sm" onclick="showAddPersonalBook()">+ বই যোগ</button>
      </div>
      <div class="search-bar">
        <span>🔍</span>
        <input type="text" id="perSearch" placeholder="বই বা মালিকের নাম খুঁজুন..." oninput="filterPersonal(this.value)">
      </div>
      <div id="personalList"><div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div></div>
    </div>
  `;

  // Show animated slogan
  showBookSlogan();
  loadPersonalBooks();
}

function showBookSlogan() {
  const overlay = document.createElement('div');
  overlay.className = 'book-slogan-overlay';
  overlay.innerHTML = `
    <div class="book-slogan-text">
      <span>আমার বই</span><br>পড়বে সবাই
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.style.animation = 'fadeIn .4s ease reverse forwards';
    setTimeout(() => overlay.remove(), 500);
  }, 3000);
}

async function loadPersonalBooks(search = '') {
  const el = document.getElementById('personalList');
  if (!el) return;
  try {
    const snap = await db.collection(PERSONAL_COL).orderBy('createdAt', 'desc').get();
    let books = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (search) {
      const s = search.toLowerCase();
      books = books.filter(b =>
        b.title?.toLowerCase().includes(s) ||
        b.ownerName?.toLowerCase().includes(s) ||
        b.author?.toLowerCase().includes(s)
      );
    }

    if (books.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏡</div><p>কোনো বই নেই। প্রথম বই যোগ করুন!</p></div>`;
      return;
    }

    el.innerHTML = books.map(b => {
      const isMine = b.ownerPhone === currentUser.phone;
      const statusBadge = b.available !== false
        ? `<span class="badge badge-green">পাওয়া যাচ্ছে</span>`
        : `<span class="badge badge-red">ধার দেওয়া আছে</span>`;

      return `
        <div class="book-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div class="book-card-title">📕 ${b.title}</div>
            ${statusBadge}
          </div>
          <div class="book-card-meta">
            ${b.author ? `<span>✍️ ${b.author}</span>` : ''}
            <span>👤 ${b.ownerName}</span>
            <span>📍 ${b.ownerVillage || ''}, ${b.ownerUpazila || ''}</span>
          </div>
          ${b.description ? `<div class="text-sm text-muted">${b.description}</div>` : ''}
          <div class="book-card-actions">
            ${!isMine && b.available !== false ? `
              <button class="btn-primary btn-sm" onclick="showBorrowRequest('${b.id}','${escHtml(b.title)}','${b.ownerPhone}','${escHtml(b.ownerName)}')">📚 ধার চাই</button>
              <a href="${buildWhatsAppLink(b.ownerPhone, `আমি "${b.title}" বইটি ধার নিতে চাই।`)}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;display:inline-block;">📱 WhatsApp</a>
            ` : ''}
            ${b.ownerMessenger ? `<a href="https://m.me/${b.ownerMessenger}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;display:inline-block;">📘 Messenger</a>` : ''}
            ${isMine ? `<button class="btn-secondary btn-sm" onclick="showMyBookDetail('${b.id}')">⚙️ পরিচালনা</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div class="empty-state"><p>লোড করতে সমস্যা হয়েছে</p></div>`;
  }
}

function filterPersonal(val) {
  loadPersonalBooks(val);
}

function showAddPersonalBook() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📕 আমার বই যোগ করুন</div>
    <div class="input-group">
      <label>বইয়ের নাম *</label>
      <input type="text" id="perTitle" placeholder="বইয়ের নাম">
    </div>
    <div class="input-group">
      <label>লেখক</label>
      <input type="text" id="perAuthor" placeholder="লেখকের নাম">
    </div>
    <div class="input-group">
      <label>সংক্ষিপ্ত বিবরণ</label>
      <textarea id="perDesc" placeholder="বই সম্পর্কে সংক্ষেপে লিখুন..."></textarea>
    </div>
    <div class="input-group">
      <label>WhatsApp নম্বর (ধারের জন্য) *</label>
      <input type="tel" id="perWA" placeholder="01XXXXXXXXX" value="${currentUser.phone}">
    </div>
    <div class="input-group">
      <label>Messenger ID (ঐচ্ছিক)</label>
      <input type="text" id="perMes" placeholder="Facebook username বা ID">
    </div>
    <button class="btn-primary" onclick="submitPersonalBook()">যোগ করুন</button>
  `);
}

async function submitPersonalBook() {
  const title = document.getElementById('perTitle').value.trim();
  const wa = document.getElementById('perWA').value.trim();
  if (!title) return showToast('বইয়ের নাম দিন');
  if (!wa) return showToast('WhatsApp নম্বর দিন');

  try {
    await db.collection(PERSONAL_COL).add({
      title,
      author: document.getElementById('perAuthor').value.trim(),
      description: document.getElementById('perDesc').value.trim(),
      ownerPhone: currentUser.phone,
      ownerName: currentUser.name,
      ownerVillage: currentUser.village,
      ownerUpazila: currentUser.upazila,
      ownerDistrict: currentUser.district,
      ownerWA: wa,
      ownerMessenger: document.getElementById('perMes').value.trim(),
      available: true,
      createdAt: new Date().toISOString()
    });
    closeModal();
    showToast('✅ বই যোগ হয়েছে!');
    navigate('personal');
  } catch(e) {
    showToast('সমস্যা হয়েছে');
  }
}

async function showBorrowRequest(bookId, bookTitle, ownerPhone, ownerName) {
  // Find nearest copy (same district > same upazila first)
  // Already showing the nearest by filtering on UI, here we just show the borrow form
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📚 ধার অনুরোধ</div>
    <div class="card" style="margin-bottom:14px;">
      <div class="text-sm text-muted">বইয়ের নাম</div>
      <div style="font-weight:600;">${bookTitle}</div>
      <div class="text-sm text-muted mt-8">মালিক: ${ownerName}</div>
    </div>
    <div class="input-group">
      <label>ধার নেওয়ার তারিখ</label>
      <input type="date" id="borrFrom" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="input-group">
      <label>ফেরত দেওয়ার তারিখ</label>
      <input type="date" id="borrTo">
    </div>
    <div class="input-group">
      <label>বার্তা (ঐচ্ছিক)</label>
      <textarea id="borrMsg" placeholder="মালিককে কিছু বলতে চাইলে লিখুন..."></textarea>
    </div>
    <button class="btn-primary" onclick="submitBorrowRequest('${bookId}','${escHtml(bookTitle)}','${ownerPhone}','${escHtml(ownerName)}')">অনুরোধ পাঠান</button>
  `);

  // Set min date for return
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('borrTo').value = tomorrow.toISOString().split('T')[0];
}

async function submitBorrowRequest(bookId, bookTitle, ownerPhone, ownerName) {
  const fromDate = document.getElementById('borrFrom').value;
  const toDate = document.getElementById('borrTo').value;
  const msg = document.getElementById('borrMsg').value;

  if (!fromDate || !toDate) return showToast('তারিখ দিন');

  try {
    // Save borrow request
    await db.collection(BORROW_COL).add({
      bookId, bookTitle, ownerPhone, ownerName,
      borrowerPhone: currentUser.phone,
      borrowerName: currentUser.name,
      borrowerVillage: currentUser.village,
      borrowerUpazila: currentUser.upazila,
      fromDate, toDate,
      message: msg,
      status: 'requested',
      createdAt: new Date().toISOString()
    });

    // Mark book as unavailable? No - let owner decide. But notify via WA.
    const waMsg = `📚 বই ধারের অনুরোধ!\n\nবই: ${bookTitle}\nঅনুরোধকারী: ${currentUser.name}\nমোবাইল: ${currentUser.phone}\nএলাকা: ${currentUser.village || ''}, ${currentUser.upazila || ''}\n\nনেওয়ার তারিখ: ${fromDate}\nফেরতের তারিখ: ${toDate}\n${msg ? `বার্তা: ${msg}` : ''}`;

    closeModal();
    showToast('✅ অনুরোধ নথিভুক্ত হয়েছে!');

    // Ask if they want to notify via WA
    setTimeout(() => {
      showModal(`
        <span class="modal-close" onclick="closeModal()">✕</span>
        <div class="modal-title">📱 মালিককে জানান?</div>
        <p class="text-sm text-muted" style="margin-bottom:16px;">আপনার অনুরোধ সেভ হয়েছে। এখন WhatsApp-এ জানাতে পারেন।</p>
        <a href="${buildWhatsAppLink(ownerPhone, waMsg)}" target="_blank" class="btn-primary" style="text-decoration:none;display:block;text-align:center;margin-bottom:8px;">📱 WhatsApp-এ অনুরোধ পাঠান</a>
        <button class="btn-secondary btn-full" onclick="closeModal()">পরে জানাবো</button>
      `);
    }, 300);

  } catch(e) {
    showToast('সমস্যা হয়েছে');
  }
}

async function showMyBookDetail(bookId) {
  try {
    const doc = await db.collection(PERSONAL_COL).doc(bookId).get();
    const b = doc.data();

    // Get borrow requests for this book
    const borrows = await db.collection(BORROW_COL)
      .where('bookId', '==', bookId).orderBy('createdAt', 'desc').get();

    const borrowList = borrows.docs.map(d => {
      const br = d.data();
      return `
        <div class="history-item type-borrow">
          <div class="history-title">${br.borrowerName} (${br.borrowerPhone})</div>
          <div class="history-date">📍 ${br.borrowerVillage || ''}, ${br.borrowerUpazila || ''}</div>
          <div class="history-date">📅 ${br.fromDate} → ${br.toDate}</div>
          <div class="history-status"><span class="badge ${br.status === 'returned' ? 'badge-green' : 'badge-yellow'}">${br.status === 'returned' ? 'ফেরত দিয়েছে' : br.status === 'approved' ? 'ধার দেওয়া আছে' : 'অনুরোধ আছে'}</span></div>
          ${br.status === 'requested' ? `
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="btn-primary btn-sm" onclick="updateBorrowStatus('${d.id}','${bookId}','approved')">✅ অনুমোদন</button>
              <button class="btn-danger btn-sm" onclick="updateBorrowStatus('${d.id}','${bookId}','rejected')">❌ না</button>
            </div>
          ` : ''}
          ${br.status === 'approved' ? `<button class="btn-secondary btn-sm" style="margin-top:8px;" onclick="updateBorrowStatus('${d.id}','${bookId}','returned')">📦 ফেরত পেয়েছি</button>` : ''}
        </div>
      `;
    }).join('') || '<div class="text-muted text-sm">কোনো অনুরোধ নেই</div>';

    showModal(`
      <span class="modal-close" onclick="closeModal()">✕</span>
      <div class="modal-title">⚙️ ${b.title}</div>
      <div style="margin-bottom:4px;"><span class="badge ${b.available !== false ? 'badge-green' : 'badge-red'}">${b.available !== false ? 'পাওয়া যাচ্ছে' : 'ধার দেওয়া আছে'}</span></div>
      <div class="divider"></div>
      <div style="font-weight:600;font-size:14px;margin-bottom:10px;">ধারের অনুরোধ:</div>
      ${borrowList}
      <div class="divider"></div>
      <button class="btn-danger btn-sm btn-full" onclick="deletePersonalBook('${bookId}')">🗑️ বই মুছে ফেলুন</button>
    `);
  } catch(e) {
    showToast('লোড করতে সমস্যা হয়েছে');
  }
}

async function updateBorrowStatus(borrowId, bookId, status) {
  try {
    await db.collection(BORROW_COL).doc(borrowId).update({ status });
    // If approved, mark book unavailable
    if (status === 'approved') {
      await db.collection(PERSONAL_COL).doc(bookId).update({ available: false });
    }
    // If returned, mark available again
    if (status === 'returned') {
      await db.collection(PERSONAL_COL).doc(bookId).update({ available: true });
    }
    showToast('✅ আপডেট হয়েছে');
    closeModal();
    navigate('personal');
  } catch(e) {
    showToast('সমস্যা হয়েছে');
  }
}

async function deletePersonalBook(bookId) {
  if (!confirm('নিশ্চিত? এই বই মুছে ফেলা হবে।')) return;
  try {
    await db.collection(PERSONAL_COL).doc(bookId).delete();
    closeModal();
    showToast('বই মুছে ফেলা হয়েছে');
    navigate('personal');
  } catch(e) {
    showToast('সমস্যা হয়েছে');
  }
}
