// ============================================
// E-BOOK FEATURE
// ============================================
let ebCurrentCat = 'সব ক্যাটাগরি';
let ebFilterUploaderPhone = null; // ক্লিকযোগ্য "আপলোডকারী" ট্যাগের জন্য

async function renderEbook(container) {
  container.innerHTML = `
    <div class="page">
      <div class="section-header">
        <span class="section-title">📖 ই-বুক লাইব্রেরি</span>
        <button class="btn-accent btn-sm" onclick="showUploadEbook()">+ আপলোড</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;" id="ebCatChips">
        ${CATEGORIES.map(c=>`<button class="cat-chip ${c==='সব ক্যাটাগরি'?'cat-chip-active':''}" onclick="filterEbCat('${c}')" id="ebcat-${c}">${c}</button>`).join('')}
      </div>
      ${demandButtonsHTML('ebook')}
      <div class="search-bar"><span>🔍</span>
        <input type="text" id="ebookSearch" placeholder="বইয়ের নাম বা লেখক..." oninput="loadEbooks()">
      </div>
      <div id="ebookList"><div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div></div>
    </div>`;
  loadEbooks();
}

function filterEbCat(cat) {
  ebCurrentCat = cat;
  document.querySelectorAll('#ebCatChips .cat-chip').forEach(c=>c.classList.remove('cat-chip-active'));
  const el=document.getElementById('ebcat-'+cat);
  if(el) el.classList.add('cat-chip-active');
  loadEbooks();
}

// লেখকের নামে ক্লিক করলে সেই লেখকের সব বই দেখাবে
function filterEbookByAuthor(authorName) {
  ebCurrentCat = 'সব ক্যাটাগরি';
  document.querySelectorAll('#ebCatChips .cat-chip').forEach(c=>c.classList.remove('cat-chip-active'));
  const el=document.getElementById('ebcat-সব ক্যাটাগরি');
  if(el) el.classList.add('cat-chip-active');
  const searchInput=document.getElementById('ebookSearch');
  if(searchInput) searchInput.value=authorName;
  loadEbooks();
  showToast(`✍️ "${authorName}" এর সব বই`);
}

// আপলোডকারীর নামে ক্লিক করলে তার সব বই দেখাবে
function filterEbookByUploader(uploaderPhone, uploaderName) {
  ebCurrentCat = 'সব ক্যাটাগরি';
  document.querySelectorAll('#ebCatChips .cat-chip').forEach(c=>c.classList.remove('cat-chip-active'));
  const el=document.getElementById('ebcat-সব ক্যাটাগরি');
  if(el) el.classList.add('cat-chip-active');
  ebFilterUploaderPhone = uploaderPhone;
  const searchInput=document.getElementById('ebookSearch');
  if(searchInput) searchInput.value='';
  loadEbooks();
  showToast(`👤 "${uploaderName}" এর সব বই`);
}

function clearEbookFilter() {
  ebFilterUploaderPhone = null;
  const searchInput=document.getElementById('ebookSearch');
  if(searchInput) searchInput.value='';
  ebCurrentCat='সব ক্যাটাগরি';
  document.querySelectorAll('#ebCatChips .cat-chip').forEach(c=>c.classList.remove('cat-chip-active'));
  const el=document.getElementById('ebcat-সব ক্যাটাগরি');
  if(el) el.classList.add('cat-chip-active');
  loadEbooks();
}

async function loadEbooks() {
  const el=document.getElementById('ebookList');
  if(!el) return;
  const search=(document.getElementById('ebookSearch')?.value||'').toLowerCase();
  try {
    const snap=await db.collection(EBOOKS_COL).get();
    let books=snap.docs.map(d=>({id:d.id,...d.data()}));
    books.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(ebCurrentCat!=='সব ক্যাটাগরি') books=books.filter(b=>b.category===ebCurrentCat);
    if(ebFilterUploaderPhone) books=books.filter(b=>b.uploaderPhone===ebFilterUploaderPhone);
    if(search) {
      books = books.map(b=>({...b, _score: fuzzyScoreFields([b.title,b.author,b.uploaderName], search)}))
        .filter(b=>b._score>0)
        .sort((a,b)=>b._score-a._score);
    }
    if(!books.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><p>কোনো বই নেই</p><button class="btn-secondary btn-sm" style="margin-top:10px;" onclick="clearEbookFilter()">সব দেখুন</button></div>`;return;}
    const filterBanner = ebFilterUploaderPhone
      ? `<div style="background:#e8f4fd;border-radius:8px;padding:8px 12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;font-size:13px;">
          <span>👤 ${books[0]?.uploaderName||''} এর বই দেখাচ্ছে</span>
          <button onclick="clearEbookFilter()" style="background:none;border:none;color:var(--primary);font-weight:600;cursor:pointer;">✕ ফিল্টার সরান</button>
        </div>` : '';
    el.innerHTML=filterBanner+books.map(b=>`
      <div class="book-card">
        <div class="book-card-title">📖 ${b.title}</div>
        <div class="book-card-meta">
          ${b.author?`<button class="tag-btn" onclick="filterEbookByAuthor('${escHtml(b.author)}')">✍️ ${b.author}</button>`:''}
          ${b.category?`<button class="tag-btn" onclick="filterEbCat('${b.category}')">${b.category}</button>`:''}
          ${b.uploaderName?`<button class="tag-btn" onclick="filterEbookByUploader('${b.uploaderPhone}','${escHtml(b.uploaderName)}')">👤 ${b.uploaderName}</button>`:''}
          <span>🕐 ${timeAgo(b.createdAt)}</span>
        </div>
        <div class="book-card-actions">
          <a href="${b.link}" target="_blank" rel="noopener" class="btn-primary btn-sm" style="text-decoration:none;display:inline-block;">📥 পড়ুন</a>
          <button class="btn-secondary btn-sm" onclick="showPrintOrder('${b.id}','${escHtml(b.title)}')">🖨️ প্রিন্ট অর্ডার</button>
          <button class="btn-secondary btn-sm" onclick='showEbookDetails(${JSON.stringify(b).replace(/'/g,"&#39;")})'>🔍 বিস্তারিত</button>
        </div>
      </div>`).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

function showEbookDetails(b) {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📖 ${b.title}</div>
    <div style="font-size:14px;line-height:2.2;">
      ${b.author?`<div><b>✍️ লেখক:</b> ${b.author}</div>`:''}
      ${b.translator?`<div><b>🌐 অনুবাদক:</b> ${b.translator}</div>`:''}
      ${b.category?`<div><b>🏷️ ক্যাটাগরি:</b> ${b.category}</div>`:''}
      <div><b>👤 আপলোডকারী:</b> ${b.uploaderName||''}</div>
      <div><b>🕐 যোগ হয়েছে:</b> ${timeAgo(b.createdAt)}</div>
    </div>
    ${b.description?`<div class="card" style="margin-top:10px;"><div class="text-sm text-muted" style="margin-bottom:4px;">বিবরণ:</div>${b.description}</div>`:''}
    <a href="${b.link}" target="_blank" rel="noopener" class="btn-primary btn-full" style="text-decoration:none;display:block;text-align:center;margin-top:14px;">📥 পড়ুন / ডাউনলোড</a>
  `);
}

function showUploadEbook() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📤 ই-বুক আপলোড</div>
    <div class="input-group"><label>বইয়ের নাম *</label><input type="text" id="ebTitle" placeholder="বইয়ের নাম"></div>
    <div class="input-group"><label>লেখকের নাম</label><input type="text" id="ebAuthor" placeholder="লেখকের নাম"></div>
    <div class="input-group"><label>অনুবাদক (ঐচ্ছিক)</label><input type="text" id="ebTranslator" placeholder="অনুবাদকের নাম"></div>
    <div class="input-group"><label>ক্যাটাগরি *</label>
      <select id="ebCategory">${CATEGORIES.filter(c=>c!=='সব ক্যাটাগরি').map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
    <div class="input-group"><label>বইয়ের লিংক *</label>
      <input type="url" id="ebLink" placeholder="https://...">
      <div class="text-sm text-muted" style="margin-top:4px;">Google Drive, Scribd, যেকোনো লিংক</div></div>
    <div class="input-group"><label>সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)</label>
      <textarea id="ebDesc" placeholder="বই সম্পর্কে লিখুন..."></textarea></div>
    <button class="btn-primary" onclick="submitEbook()">আপলোড করুন</button>
  `);
}

async function submitEbook() {
  const title=document.getElementById('ebTitle').value.trim();
  const link=document.getElementById('ebLink').value.trim();
  if(!title) return showToast('বইয়ের নাম দিন');
  if(!link||!link.startsWith('http')) return showToast('সঠিক লিংক দিন');
  try {
    await db.collection(EBOOKS_COL).add({
      title, author:document.getElementById('ebAuthor').value.trim(),
      translator:document.getElementById('ebTranslator').value.trim(),
      category:document.getElementById('ebCategory').value,
      link, description:document.getElementById('ebDesc').value.trim(),
      uploaderPhone:currentUser.phone, uploaderName:currentUser.name,
      createdAt:new Date().toISOString()
    });
    closeModal(); showToast('✅ বই আপলোড হয়েছে!'); navigate('ebook');
  } catch(e){showToast('সমস্যা হয়েছে');}
}

async function showPrintOrder(bookId, bookTitle) {
  const settings=await getSettings();
  const waNum=settings.whatsapp||'01521256504';
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🖨️ প্রিন্ট অর্ডার</div>
    <div class="card" style="margin-bottom:14px;"><div style="font-weight:600;">${bookTitle}</div></div>
    <div class="input-group"><label>কপির সংখ্যা</label><input type="number" id="printQty" value="1" min="1"></div>
    <div class="input-group"><label>বাঁধাই ধরন</label>
      <select id="printType">
        <option>সাধারণ স্টেপলার বাঁধাই</option>
        <option>পার্ফেক্ট বাইন্ডিং</option>
        <option>রিং বাইন্ডিং</option>
      </select></div>
    <div class="input-group"><label>বিশেষ নির্দেশনা</label>
      <textarea id="printNote" placeholder="রঙিন/সাদাকালো, কাগজের সাইজ..."></textarea></div>
    <button class="btn-primary btn-full" onclick="sendPrintOrderWA('${bookId}','${escHtml(bookTitle)}','${waNum}')">📱 WhatsApp অর্ডার</button>
  `);
}

async function sendPrintOrderWA(bookId,bookTitle,waNum) {
  const qty=document.getElementById('printQty').value;
  const type=document.getElementById('printType').value;
  const note=document.getElementById('printNote').value;
  const msg=`🖨️ প্রিন্ট অর্ডার\n\nবই: ${bookTitle}\nকপি: ${qty}\nধরন: ${type}\nনোট: ${note||'নেই'}\n\nঅর্ডারকারী: ${currentUser.name}\nমোবাইল: ${currentUser.phone}`;
  await db.collection(ORDERS_COL).add({
    type:'print',bookId,bookTitle,qty:Number(qty),bindingType:type,note,
    userPhone:currentUser.phone,userName:currentUser.name,
    status:'pending',createdAt:new Date().toISOString()
  });
  window.open(buildWhatsAppLink(waNum,msg),'_blank');
  closeModal(); showToast('✅ অর্ডার পাঠানো হয়েছে!');
}
