// ============================================
// PERSONAL LIBRARY
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
        <input type="text" id="perSearch" placeholder="বই বা মালিকের নাম..." oninput="filterPersonal(this.value)">
      </div>
      <div id="personalList"><div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div></div>
    </div>`;
  showBookSlogan();
  loadPersonalBooks();
}

function showBookSlogan() {
  const overlay = document.createElement('div');
  overlay.className = 'book-slogan-overlay';
  overlay.innerHTML = `<div class="book-slogan-text"><span>আমার বই</span><br>পড়বে সবাই</div>`;
  document.body.appendChild(overlay);
  setTimeout(()=>{overlay.style.opacity='0';overlay.style.transition='opacity 0.5s';setTimeout(()=>overlay.remove(),500);},3000);
}

async function loadPersonalBooks(search='') {
  const el = document.getElementById('personalList');
  if (!el) return;
  try {
    const snap = await db.collection(PERSONAL_COL).orderBy('createdAt','desc').get();
    let books = snap.docs.map(d=>({id:d.id,...d.data()}));

    if (search) {
      const s = search.toLowerCase();
      books = books.filter(b=>b.title?.toLowerCase().includes(s)||b.ownerName?.toLowerCase().includes(s)||b.author?.toLowerCase().includes(s));
    }

    // Sort by proximity
    books.sort((a,b)=>locationScore(b)-locationScore(a));

    if (books.length===0){el.innerHTML=`<div class="empty-state"><div class="empty-icon">🏡</div><p>কোনো বই নেই</p></div>`;return;}

    el.innerHTML = books.map(b=>{
      const isMine = b.ownerPhone===currentUser.phone;
      const nearBadge = locationScore(b)>0 ? `<span class="badge badge-green">📍 কাছাকাছি</span>` : '';
      return `
        <div class="book-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div class="book-card-title">📕 ${b.title}</div>
            <span class="badge ${b.available!==false?'badge-green':'badge-red'}">${b.available!==false?'পাওয়া যাচ্ছে':'ধার দেওয়া'}</span>
          </div>
          <div class="book-card-meta">
            ${b.author?`<span>✍️ ${b.author}</span>`:''}
            ${b.category?`<span class="tag">${b.category}</span>`:''}
            <span>👤 ${b.ownerName}</span>
            <span>📍 ${b.ownerVillage||''}, ${b.ownerUpazila||''}</span>
            ${nearBadge}
          </div>
          <div class="book-card-actions">
            ${!isMine&&b.available!==false?`
              <button class="btn-primary btn-sm" onclick="showBorrowRequest('${b.id}','${escHtml(b.title)}','${b.ownerPhone}','${escHtml(b.ownerName)}')">📚 ধার চাই</button>
              <a href="${buildWhatsAppLink(b.ownerPhone,`আমি "${b.title}" বইটি ধার নিতে চাই।`)}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;display:inline-block;">📱 WhatsApp</a>`:''}
            ${b.ownerMessenger?`<a href="https://m.me/${b.ownerMessenger}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;display:inline-block;">📘 Messenger</a>`:''}
            ${isMine?`<button class="btn-secondary btn-sm" onclick="showMyBookDetail('${b.id}')">⚙️ পরিচালনা</button>`:''}
          </div>
        </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

function locationScore(book) {
  if (!currentUser) return 0;
  let score = 0;
  if (book.ownerDistrict&&currentUser.district&&book.ownerDistrict.trim()===currentUser.district.trim()) score+=10;
  if (book.ownerUpazila&&currentUser.upazila&&book.ownerUpazila.trim()===currentUser.upazila.trim()) score+=20;
  if (book.ownerVillage&&currentUser.village&&book.ownerVillage.trim()===currentUser.village.trim()) score+=30;
  return score;
}

function filterPersonal(val){loadPersonalBooks(val);}

function showAddPersonalBook() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📕 আমার বই যোগ করুন</div>
    <div class="input-group"><label>বইয়ের নাম *</label>
      <input type="text" id="perTitle" placeholder="বইয়ের নাম"></div>
    <div class="input-group"><label>লেখক</label>
      <input type="text" id="perAuthor" placeholder="লেখকের নাম"></div>
    <div class="input-group"><label>ক্যাটাগরি *</label>
      <select id="perCategory">
        ${CATEGORIES.filter(c=>c!=='সব ক্যাটাগরি').map(c=>`<option value="${c}">${c}</option>`).join('')}
      </select></div>
    <div class="input-group"><label>সংক্ষিপ্ত বিবরণ</label>
      <textarea id="perDesc" placeholder="বই সম্পর্কে লিখুন..."></textarea></div>
    <div class="input-group"><label>WhatsApp নম্বর *</label>
      <input type="tel" id="perWA" value="${currentUser.phone}"></div>
    <div class="input-group"><label>Messenger ID (ঐচ্ছিক)</label>
      <input type="text" id="perMes" placeholder="Facebook username"></div>
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
      category: document.getElementById('perCategory').value,
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
    closeModal(); showToast('✅ বই যোগ হয়েছে!'); navigate('personal');
  } catch(e){showToast('সমস্যা হয়েছে');}
}

async function showBorrowRequest(bookId,bookTitle,ownerPhone,ownerName) {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📚 ধার অনুরোধ</div>
    <div class="card" style="margin-bottom:14px;">
      <div class="text-sm text-muted">বইয়ের নাম</div>
      <div style="font-weight:600;">${bookTitle}</div>
      <div class="text-sm text-muted mt-8">মালিক: ${ownerName}</div>
    </div>
    <div class="input-group"><label>ধার নেওয়ার তারিখ</label>
      <input type="date" id="borrFrom" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="input-group"><label>ফেরত দেওয়ার তারিখ</label>
      <input type="date" id="borrTo"></div>
    <div class="input-group"><label>বার্তা (ঐচ্ছিক)</label>
      <textarea id="borrMsg" placeholder="মালিককে কিছু বলতে চাইলে লিখুন..."></textarea></div>
    <button class="btn-primary" onclick="submitBorrowRequest('${bookId}','${escHtml(bookTitle)}','${ownerPhone}','${escHtml(ownerName)}')">অনুরোধ পাঠান</button>
  `);
  const t = new Date(); t.setDate(t.getDate()+1);
  document.getElementById('borrTo').value = t.toISOString().split('T')[0];
}

async function submitBorrowRequest(bookId,bookTitle,ownerPhone,ownerName) {
  const fromDate=document.getElementById('borrFrom').value;
  const toDate=document.getElementById('borrTo').value;
  const msg=document.getElementById('borrMsg').value;
  if(!fromDate||!toDate) return showToast('তারিখ দিন');
  try {
    await db.collection(BORROW_COL).add({
      bookId,bookTitle,ownerPhone,ownerName,
      borrowerPhone:currentUser.phone,
      borrowerName:currentUser.name,
      borrowerVillage:currentUser.village,
      borrowerUpazila:currentUser.upazila,
      fromDate,toDate,message:msg,
      status:'requested',
      createdAt:new Date().toISOString()
    });
    const waMsg = `📚 বই ধারের অনুরোধ!\n\nবই: ${bookTitle}\nঅনুরোধকারী: ${currentUser.name}\nমোবাইল: ${currentUser.phone}\nএলাকা: ${currentUser.village||''}, ${currentUser.upazila||''}\n\nনেওয়ার: ${fromDate}\nফেরত: ${toDate}\n${msg?`বার্তা: ${msg}`:''}`;
    closeModal();
    showToast('✅ অনুরোধ নথিভুক্ত হয়েছে!');
    setTimeout(()=>{
      showModal(`
        <span class="modal-close" onclick="closeModal()">✕</span>
        <div class="modal-title">📱 মালিককে জানান?</div>
        <p class="text-sm text-muted" style="margin-bottom:16px;">আপনার অনুরোধ সেভ হয়েছে।</p>
        <a href="${buildWhatsAppLink(ownerPhone,waMsg)}" target="_blank" class="btn-primary" style="text-decoration:none;display:block;text-align:center;margin-bottom:8px;">📱 WhatsApp-এ জানান</a>
        <button class="btn-secondary btn-full" onclick="closeModal()">পরে জানাবো</button>
      `);
    },300);
  } catch(e){showToast('সমস্যা হয়েছে');}
}

async function showMyBookDetail(bookId) {
  try {
    const doc = await db.collection(PERSONAL_COL).doc(bookId).get();
    const b = doc.data();
    const borrows = await db.collection(BORROW_COL).where('bookId','==',bookId).orderBy('createdAt','desc').get();
    const borrowList = borrows.docs.map(d=>{
      const br=d.data();
      return `<div class="history-item type-borrow">
        <div class="history-title">${br.borrowerName} (${br.borrowerPhone})</div>
        <div class="history-date">📍 ${br.borrowerVillage||''}, ${br.borrowerUpazila||''}</div>
        <div class="history-date">📅 ${br.fromDate} → ${br.toDate}</div>
        <span class="badge ${br.status==='returned'?'badge-green':br.status==='approved'?'badge-blue':'badge-yellow'}">${br.status==='returned'?'ফেরত':br.status==='approved'?'ধার দেওয়া':'অনুরোধ'}</span>
        ${br.status==='requested'?`<div style="display:flex;gap:6px;margin-top:8px;">
          <button class="btn-primary btn-sm" onclick="updateBorrowStatus('${d.id}','${bookId}','approved')">✅ অনুমোদন</button>
          <button class="btn-danger btn-sm" onclick="updateBorrowStatus('${d.id}','${bookId}','rejected')">❌ না</button>
        </div>`:''}
        ${br.status==='approved'?`<button class="btn-secondary btn-sm" style="margin-top:8px;" onclick="updateBorrowStatus('${d.id}','${bookId}','returned')">📦 ফেরত পেয়েছি</button>`:''}
      </div>`;
    }).join('')||'<div class="text-muted text-sm">কোনো অনুরোধ নেই</div>';

    showModal(`
      <span class="modal-close" onclick="closeModal()">✕</span>
      <div class="modal-title">⚙️ ${b.title}</div>
      <span class="badge ${b.available!==false?'badge-green':'badge-red'}">${b.available!==false?'পাওয়া যাচ্ছে':'ধার দেওয়া'}</span>
      <div class="divider"></div>
      <div style="font-weight:600;font-size:14px;margin-bottom:10px;">ধারের অনুরোধ:</div>
      ${borrowList}
      <div class="divider"></div>
      <button class="btn-danger btn-sm btn-full" onclick="deletePersonalBook('${bookId}')">🗑️ বই মুছে ফেলুন</button>
    `);
  } catch(e){showToast('লোড সমস্যা');}
}

async function updateBorrowStatus(borrowId,bookId,status) {
  try {
    await db.collection(BORROW_COL).doc(borrowId).update({status});
    if(status==='approved') await db.collection(PERSONAL_COL).doc(bookId).update({available:false});
    if(status==='returned') await db.collection(PERSONAL_COL).doc(bookId).update({available:true});
    showToast('✅ আপডেট হয়েছে'); closeModal(); navigate('personal');
  } catch(e){showToast('সমস্যা হয়েছে');}
}

async function deletePersonalBook(bookId) {
  if(!confirm('নিশ্চিত?')) return;
  try{await db.collection(PERSONAL_COL).doc(bookId).delete();closeModal();showToast('মুছে ফেলা হয়েছে');navigate('personal');}
  catch(e){showToast('সমস্যা হয়েছে');}
}
