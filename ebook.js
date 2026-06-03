// ============================================
// E-BOOK FEATURE
// ============================================

async function renderEbook(container) {
  container.innerHTML = `
    <div class="page">
      <div class="section-header">
        <span class="section-title">📖 ই-বুক লাইব্রেরি</span>
        <button class="btn-accent btn-sm" onclick="showUploadEbook()">+ আপলোড</button>
      </div>
      <div class="search-bar">
        <span>🔍</span>
        <input type="text" id="ebookSearch" placeholder="বইয়ের নাম বা লেখক..." oninput="filterEbooks(this.value)">
      </div>
      <div id="ebookList"><div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div></div>
    </div>`;
  loadEbooks();
}

async function loadEbooks(search='') {
  const el = document.getElementById('ebookList');
  if (!el) return;
  try {
    const snap = await db.collection(EBOOKS_COL).orderBy('createdAt','desc').get();
    let books = snap.docs.map(d=>({id:d.id,...d.data()}));
    if (search) {
      const s = search.toLowerCase();
      books = books.filter(b=>b.title?.toLowerCase().includes(s)||b.author?.toLowerCase().includes(s));
    }
    if (books.length===0){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><p>কোনো বই নেই</p></div>`;return;}
    el.innerHTML = books.map(b=>`
      <div class="book-card">
        <div class="book-card-title">📖 ${b.title}</div>
        <div class="book-card-meta">
          ${b.author?`<span>✍️ ${b.author}</span>`:''}
          ${b.category?`<span class="tag">${b.category}</span>`:''}
          <span>👤 ${b.uploaderName||''}</span>
          <span>🕐 ${timeAgo(b.createdAt)}</span>
        </div>
        ${b.description?`<div class="text-sm text-muted">${b.description}</div>`:''}
        <div class="book-card-actions">
          <a href="${b.link}" target="_blank" rel="noopener" class="btn-primary btn-sm" style="text-decoration:none;display:inline-block;">📥 পড়ুন / ডাউনলোড</a>
          <button class="btn-secondary btn-sm" onclick="showPrintOrder('${b.id}','${escHtml(b.title)}')">🖨️ প্রিন্ট অর্ডার</button>
        </div>
      </div>`).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

function filterEbooks(val){loadEbooks(val);}

function showUploadEbook() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📤 ই-বুক আপলোড</div>
    <div class="input-group"><label>বইয়ের নাম *</label>
      <input type="text" id="ebTitle" placeholder="বইয়ের নাম লিখুন"></div>
    <div class="input-group"><label>লেখকের নাম</label>
      <input type="text" id="ebAuthor" placeholder="লেখকের নাম"></div>
    <div class="input-group"><label>ক্যাটাগরি *</label>
      <select id="ebCategory">
        ${CATEGORIES.filter(c=>c!=='সব ক্যাটাগরি').map(c=>`<option value="${c}">${c}</option>`).join('')}
      </select></div>
    <div class="input-group"><label>বইয়ের লিংক *</label>
      <input type="url" id="ebLink" placeholder="https://...">
      <div class="text-sm text-muted" style="margin-top:4px;">Google Drive, Scribd, যেকোনো লিংক দেওয়া যাবে</div>
    </div>
    <div class="input-group"><label>সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)</label>
      <textarea id="ebDesc" placeholder="বই সম্পর্কে লিখুন..."></textarea></div>
    <button class="btn-primary" onclick="submitEbook()">আপলোড করুন</button>
  `);
}

async function submitEbook() {
  const title = document.getElementById('ebTitle').value.trim();
  const link = document.getElementById('ebLink').value.trim();
  if (!title) return showToast('বইয়ের নাম দিন');
  if (!link||!link.startsWith('http')) return showToast('সঠিক লিংক দিন');
  try {
    await db.collection(EBOOKS_COL).add({
      title,
      author: document.getElementById('ebAuthor').value.trim(),
      category: document.getElementById('ebCategory').value,
      link,
      description: document.getElementById('ebDesc').value.trim(),
      uploaderPhone: currentUser.phone,
      uploaderName: currentUser.name,
      createdAt: new Date().toISOString()
    });
    closeModal(); showToast('✅ বই আপলোড হয়েছে!'); navigate('ebook');
  } catch(e){showToast('সমস্যা হয়েছে');}
}

async function showPrintOrder(bookId, bookTitle) {
  const settings = await getSettings();
  const waNum = settings.whatsapp||'01521256504';
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🖨️ প্রিন্ট অর্ডার</div>
    <div class="card" style="margin-bottom:14px;">
      <div class="text-sm text-muted">বইয়ের নাম</div>
      <div style="font-weight:600;">${bookTitle}</div>
    </div>
    <div class="input-group"><label>কপির সংখ্যা</label>
      <input type="number" id="printQty" value="1" min="1" max="100"></div>
    <div class="input-group"><label>বাঁধাই ধরন</label>
      <select id="printType">
        <option>সাধারণ স্টেপলার বাঁধাই</option>
        <option>পার্ফেক্ট বাইন্ডিং</option>
        <option>রিং বাইন্ডিং</option>
      </select></div>
    <div class="input-group"><label>বিশেষ নির্দেশনা (ঐচ্ছিক)</label>
      <textarea id="printNote" placeholder="রঙিন/সাদাকালো..."></textarea></div>
    <div style="display:flex;gap:8px;margin-top:4px;">
      <button class="btn-primary btn-sm" style="flex:1;" onclick="sendPrintOrderWA('${bookId}','${escHtml(bookTitle)}','${waNum}')">📱 WhatsApp অর্ডার</button>
      ${settings.fbPage?`<a href="https://m.me/${settings.fbPage}" target="_blank" class="btn-secondary btn-sm" style="flex:1;text-decoration:none;text-align:center;display:block;">📘 Facebook</a>`:''}
    </div>
  `);
}

async function sendPrintOrderWA(bookId, bookTitle, waNum) {
  const qty = document.getElementById('printQty').value;
  const type = document.getElementById('printType').value;
  const note = document.getElementById('printNote').value;
  const msg = `🖨️ প্রিন্ট অর্ডার\n\nবই: ${bookTitle}\nকপি: ${qty}\nধরন: ${type}\nনোট: ${note||'নেই'}\n\nঅর্ডারকারী: ${currentUser.name}\nমোবাইল: ${currentUser.phone}`;
  await db.collection(ORDERS_COL).add({
    type:'print', bookId, bookTitle,
    qty:Number(qty), bindingType:type, note,
    userPhone:currentUser.phone, userName:currentUser.name,
    status:'pending', createdAt:new Date().toISOString()
  });
  window.open(buildWhatsAppLink(waNum, msg), '_blank');
  closeModal(); showToast('✅ অর্ডার পাঠানো হয়েছে!');
}
