const CATEGORIES = [
  'সব ক্যাটাগরি','আকিদা','আত্মউন্নয়ন','অর্থনীতি','একাডেমিক',
  'কুরআন','চিকিৎসা','জীবনী','তথ্য-প্রযুক্তি','তাফসির',
  'দর্শন','নারী','ফিকহ','বিজ্ঞান','রাজনীতি',
  'সাহিত্য','সিরাত','হাদীস','ইতিহাস','উসুল',
  'ভ্রমণ','শিশু-কিশোর','অন্যান্য'
];
let perCurrentCat='সব ক্যাটাগরি';

async function renderPersonal(container) {
  container.innerHTML=`<div class="page">
    <div class="section-header">
      <span class="section-title">🏡 ব্যক্তিগত লাইব্রেরি</span>
      <button class="btn-accent btn-sm" onclick="showAddPersonalBook()">+ বই যোগ</button>
    </div>
    <div id="myBookCount" style="margin-bottom:10px;"></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;" id="perCatChips">
      ${CATEGORIES.map(c=>`<button class="cat-chip ${c==='সব ক্যাটাগরি'?'cat-chip-active':''}" onclick="filterPerCat('${c}')" id="percat-${c}">${c}</button>`).join('')}
    </div>
    <div class="search-bar"><span>🔍</span>
      <input type="text" id="perSearch" placeholder="বই বা মালিকের নাম..." oninput="loadPersonalBooks(this.value)">
    </div>
    <div id="personalList"><div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div></div>
  </div>`;
  showBookSlogan();
  loadMyBookCount();
  loadPersonalBooks();
}

function filterPerCat(cat) {
  perCurrentCat=cat;
  document.querySelectorAll('#perCatChips .cat-chip').forEach(c=>c.classList.remove('cat-chip-active'));
  const el=document.getElementById('percat-'+cat);if(el)el.classList.add('cat-chip-active');
  loadPersonalBooks(document.getElementById('perSearch')?.value||'');
}

async function loadMyBookCount() {
  try {
    const snap=await db.collection(PERSONAL_COL).where('ownerPhone','==',currentUser.phone).get();
    const count=snap.size;
    const el=document.getElementById('myBookCount');if(!el)return;
    if(count<5){
      el.innerHTML=`<div style="background:#fff3cd;border-radius:8px;padding:10px 12px;font-size:13px;color:#856404;">
        📚 আপনি <b>${count}টি</b> বই যোগ করেছেন। ধার চাইতে কমপক্ষে <b>৫টি</b> দরকার।
        <div style="background:#e0d8cc;height:6px;border-radius:4px;margin-top:8px;">
          <div style="background:var(--primary);height:6px;border-radius:4px;width:${Math.min(count/5*100,100)}%;"></div>
        </div>
      </div>`;
    } else {
      el.innerHTML=`<div style="background:#d4edda;border-radius:8px;padding:8px 12px;font-size:13px;color:#155724;">✅ ${count}টি বই — ধার চাইতে পারবেন</div>`;
    }
  } catch(e){}
}

function locationScore(b) {
  if(!currentUser)return 0;let s=0;
  if(b.ownerDistrict&&currentUser.district&&b.ownerDistrict.trim()===currentUser.district.trim())s+=10;
  if(b.ownerUpazila&&currentUser.upazila&&b.ownerUpazila.trim()===currentUser.upazila.trim())s+=20;
  if(b.ownerVillage&&currentUser.village&&b.ownerVillage.trim()===currentUser.village.trim())s+=30;
  return s;
}

async function loadPersonalBooks(search='') {
  const el=document.getElementById('personalList');if(!el)return;
  try {
    const snap=await db.collection(PERSONAL_COL).get();
    let books=snap.docs.map(d=>({id:d.id,...d.data()}));
    books.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(perCurrentCat!=='সব ক্যাটাগরি')books=books.filter(b=>b.category===perCurrentCat);
    if(search){const s=search.toLowerCase();books=books.filter(b=>b.title?.toLowerCase().includes(s)||b.ownerName?.toLowerCase().includes(s));}
    books.sort((a,b)=>locationScore(b)-locationScore(a));
    if(!books.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">🏡</div><p>কোনো বই নেই</p></div>`;return;}
    el.innerHTML=books.map(b=>{
      const isMine=b.ownerPhone===currentUser.phone;
      const near=locationScore(b)>0&&!isMine;
      return `<div class="book-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div class="book-card-title">📕 ${b.title}</div>
          <span class="badge ${b.available!==false?'badge-green':'badge-red'}">${b.available!==false?'আছে':'ধার দেওয়া'}</span>
        </div>
        <div class="book-card-meta">
          ${b.author?`<span>✍️ ${b.author}</span>`:''}
          ${b.category?`<span class="tag">${b.category}</span>`:''}
          <span>👤 ${b.ownerName}</span>
          <span>📍 ${b.ownerVillage||''}, ${b.ownerUpazila||''}</span>
          ${near?`<span class="badge badge-green">📍 কাছাকাছি</span>`:''}
        </div>
        <div class="book-card-actions">
          ${!isMine&&b.available!==false?`<button class="btn-primary btn-sm" onclick="checkBorrowEligibility('${b.id}','${escHtml(b.title)}','${b.ownerPhone}','${escHtml(b.ownerName)}')">📚 ধার চাই</button>`:''}
          ${isMine?`<button class="btn-secondary btn-sm" onclick="showMyBookDetail('${b.id}')">⚙️ পরিচালনা</button>`:''}
        </div>
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা: ${e.message}</p></div>`;}
}

async function checkBorrowEligibility(bookId,bookTitle,ownerPhone,ownerName) {
  try {
    const snap=await db.collection(PERSONAL_COL).where('ownerPhone','==',currentUser.phone).get();
    if(snap.size<5){
      showModal(`
        <span class="modal-close" onclick="closeModal()">✕</span>
        <div class="modal-title">📚 আগে বই যোগ করুন</div>
        <div style="text-align:center;padding:16px 0;">
          <div style="font-size:48px;margin-bottom:12px;">📖</div>
          <p style="font-weight:600;color:var(--primary-dark);">ধার চাইতে হলে নিজের বই যোগ করুন</p>
          <p style="font-size:13px;color:var(--text-muted);margin:8px 0 16px;">আপনি <b>${snap.size}টি</b> বই যোগ করেছেন।<br>কমপক্ষে <b>৫টি</b> দরকার।</p>
          <div style="background:#f5f0e8;border-radius:8px;padding:10px;margin-bottom:16px;">
            <div style="font-size:13px;color:var(--text-muted);">অগ্রগতি: ${snap.size}/৫</div>
            <div style="background:#e0d8cc;height:8px;border-radius:4px;margin-top:6px;">
              <div style="background:var(--primary);height:8px;border-radius:4px;width:${Math.min(snap.size/5*100,100)}%;"></div>
            </div>
          </div>
        </div>
        <button class="btn-primary btn-full" onclick="closeModal();showAddPersonalBook()">+ এখনই বই যোগ করুন</button>
        <button class="btn-secondary btn-full" style="margin-top:8px;" onclick="closeModal()">পরে করব</button>
      `);
      return;
    }
    showBorrowRequest(bookId,bookTitle,ownerPhone,ownerName);
  } catch(e){showToast('সমস্যা হয়েছে');}
}

function showBookSlogan() {
  const o=document.createElement('div');
  o.className='book-slogan-overlay';
  o.innerHTML=`<div class="book-slogan-text"><span>আমার বই</span><br>পড়বে সবাই</div>`;
  document.body.appendChild(o);
  setTimeout(()=>{o.style.opacity='0';o.style.transition='opacity 0.5s';setTimeout(()=>o.remove(),500);},3000);
}

function showAddPersonalBook() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📕 আমার বই যোগ করুন</div>
    <div class="input-group"><label>বইয়ের নাম *</label><input type="text" id="perTitle" placeholder="বইয়ের নাম"></div>
    <div class="input-group"><label>লেখক</label><input type="text" id="perAuthor" placeholder="লেখকের নাম"></div>
    <div class="input-group"><label>ক্যাটাগরি *</label>
      <select id="perCategory">${CATEGORIES.filter(c=>c!=='সব ক্যাটাগরি').map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
    <div class="input-group"><label>সংক্ষিপ্ত বিবরণ</label><textarea id="perDesc" placeholder="বই সম্পর্কে লিখুন..."></textarea></div>
    <button class="btn-primary" onclick="submitPersonalBook()">যোগ করুন</button>
  `);
}

async function submitPersonalBook() {
  const title=document.getElementById('perTitle').value.trim();
  if(!title)return showToast('বইয়ের নাম দিন');
  try{
    await db.collection(PERSONAL_COL).add({
      title,author:document.getElementById('perAuthor').value.trim(),
      category:document.getElementById('perCategory').value,
      description:document.getElementById('perDesc').value.trim(),
      ownerPhone:currentUser.phone,ownerName:currentUser.name,
      ownerVillage:currentUser.village||'',ownerUpazila:currentUser.upazila||'',ownerDistrict:currentUser.district||'',
      available:true,createdAt:new Date().toISOString()
    });
    closeModal();showToast('✅ বই যোগ হয়েছে!');navigate('personal');
  }catch(e){showToast('সমস্যা: '+e.message);}
}

async function showBorrowRequest(bookId,bookTitle,ownerPhone,ownerName) {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📚 ধার অনুরোধ</div>
    <div class="card" style="margin-bottom:14px;background:#f0f9f4;">
      <div style="font-weight:600;">${bookTitle}</div>
      <div class="text-sm text-muted">মালিক: ${ownerName}</div>
    </div>
    <div class="input-group"><label>ধার নেওয়ার তারিখ *</label>
      <input type="date" id="borrFrom" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="input-group"><label>ফেরত দেওয়ার তারিখ *</label><input type="date" id="borrTo"></div>
    <div class="input-group"><label>বার্তা (ঐচ্ছিক)</label>
      <textarea id="borrMsg" placeholder="মালিককে কিছু জানাতে চাইলে..."></textarea></div>
    <div style="background:#e8f4fd;border-radius:8px;padding:10px;margin-bottom:14px;font-size:13px;color:#0c5460;">
      ℹ️ অনুরোধ মালিকের নোটিফিকেশনে যাবে। অনুমোদনের পর রশিদ পাবেন।
    </div>
    <button class="btn-primary btn-full" onclick="submitBorrowRequest('${bookId}','${escHtml(bookTitle)}','${ownerPhone}','${escHtml(ownerName)}')">📚 অনুরোধ পাঠান</button>
  `);
  const t=new Date();t.setDate(t.getDate()+7);
  document.getElementById('borrTo').value=t.toISOString().split('T')[0];
}

async function submitBorrowRequest(bookId,bookTitle,ownerPhone,ownerName) {
  const fromDate=document.getElementById('borrFrom').value;
  const toDate=document.getElementById('borrTo').value;
  const msg=document.getElementById('borrMsg').value;
  if(!fromDate||!toDate)return showToast('তারিখ দিন');
  try{
    const borrowRef=await db.collection(BORROW_COL).add({
      bookId,bookTitle,ownerPhone,ownerName,
      borrowerPhone:currentUser.phone,borrowerName:currentUser.name,
      borrowerVillage:currentUser.village||'',borrowerUpazila:currentUser.upazila||'',
      fromDate,toDate,message:msg,status:'requested',createdAt:new Date().toISOString()
    });
    // Send notification to owner
    await sendNotif(ownerPhone,'borrow_request',{
      title:'📚 নতুন ধারের অনুরোধ',
      body:`${currentUser.name} "${bookTitle}" বইটি ধার চাইছেন`,
      relatedId:borrowRef.id,fromName:currentUser.name,bookTitle
    });
    closeModal();showToast('✅ অনুরোধ পাঠানো হয়েছে!');navigate('personal');
  }catch(e){showToast('সমস্যা: '+e.message);}
}

async function showMyBookDetail(bookId) {
  try{
    const docSnap=await db.collection(PERSONAL_COL).doc(bookId).get();
    if(!docSnap.exists){showToast('বই পাওয়া যায়নি');return;}
    const b=docSnap.data();
    const borrowSnap=await db.collection(BORROW_COL).where('bookId','==',bookId).get();
    const borrows=borrowSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    const borrowList=borrows.length?borrows.map(br=>`
      <div class="history-item type-borrow">
        <div class="flex-between">
          <div class="history-title">👤 ${br.borrowerName}</div>
          <span class="badge ${br.status==='returned'?'badge-green':br.status==='approved'?'badge-blue':br.status==='rejected'?'badge-red':'badge-yellow'}">
            ${br.status==='returned'?'ফেরত':br.status==='approved'?'ধার দেওয়া':br.status==='rejected'?'না':'অনুরোধ'}
          </span>
        </div>
        <div class="history-date">📍 ${br.borrowerVillage||''}, ${br.borrowerUpazila||''}</div>
        <div class="history-date">📅 ${br.fromDate} → ${br.toDate}</div>
        ${br.message?`<div class="text-sm text-muted">"${br.message}"</div>`:''}
        ${br.status==='requested'?`
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button class="btn-primary btn-sm" onclick="approveBorrow('${br.id}','${bookId}','${escHtml(br.borrowerName)}','${escHtml(b.title)}','${br.fromDate}','${br.toDate}','${br.borrowerPhone}')">✅ অনুমোদন</button>
            <button class="btn-danger btn-sm" onclick="rejectBorrow('${br.id}','${br.borrowerPhone}','${escHtml(b.title)}')">❌ না</button>
          </div>`:''}
        ${br.status==='approved'?`<button class="btn-secondary btn-sm" style="margin-top:8px;" onclick="markReturned('${br.id}','${bookId}','${br.borrowerPhone}','${escHtml(b.title)}')">📦 ফেরত পেয়েছি</button>`:''}
      </div>`).join('')
    :'<div class="text-muted text-sm">কোনো অনুরোধ নেই</div>';

    showModal(`
      <span class="modal-close" onclick="closeModal()">✕</span>
      <div class="modal-title">⚙️ ${b.title}</div>
      <span class="badge ${b.available!==false?'badge-green':'badge-red'}" style="margin-bottom:10px;display:inline-block;">${b.available!==false?'পাওয়া যাচ্ছে':'ধার দেওয়া'}</span>
      <div style="display:flex;gap:8px;margin:10px 0;">
        <button class="btn-secondary btn-sm" onclick="showEditPersonalBook('${bookId}')">✏️ এডিট</button>
        <button class="btn-danger btn-sm" onclick="deletePersonalBook('${bookId}')">🗑️ মুছুন</button>
      </div>
      <div class="divider"></div>
      <div style="font-weight:600;font-size:14px;margin-bottom:10px;">📋 ধারের অনুরোধ (${borrows.length}টি):</div>
      ${borrowList}
    `);
  }catch(e){showToast('লোড সমস্যা: '+e.message);}
}

function showEditPersonalBook(bookId) {
  db.collection(PERSONAL_COL).doc(bookId).get().then(doc=>{
    if(!doc.exists)return showToast('পাওয়া যায়নি');
    const b=doc.data();
    showModal(`
      <span class="modal-close" onclick="closeModal()">✕</span>
      <div class="modal-title">✏️ বই এডিট</div>
      <div class="input-group"><label>বইয়ের নাম *</label><input type="text" id="editPerTitle" value="${b.title||''}"></div>
      <div class="input-group"><label>লেখক</label><input type="text" id="editPerAuthor" value="${b.author||''}"></div>
      <div class="input-group"><label>ক্যাটাগরি</label>
        <select id="editPerCategory">${CATEGORIES.filter(c=>c!=='সব ক্যাটাগরি').map(c=>`<option value="${c}" ${c===b.category?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="input-group"><label>বিবরণ</label><textarea id="editPerDesc">${b.description||''}</textarea></div>
      <button class="btn-primary btn-full" onclick="savePersonalBookEdit('${bookId}')">✅ সেভ করুন</button>
    `);
  }).catch(e=>showToast('লোড সমস্যা'));
}

async function savePersonalBookEdit(bookId) {
  const title=document.getElementById('editPerTitle').value.trim();
  if(!title)return showToast('নাম দিন');
  try{
    await db.collection(PERSONAL_COL).doc(bookId).update({
      title,author:document.getElementById('editPerAuthor').value.trim(),
      category:document.getElementById('editPerCategory').value,
      description:document.getElementById('editPerDesc').value.trim()
    });
    closeModal();showToast('✅ আপডেট হয়েছে!');navigate('personal');
  }catch(e){showToast('সমস্যা: '+e.message);}
}

async function approveBorrow(borrowId,bookId,borrowerName,bookTitle,fromDate,toDate,borrowerPhone) {
  try{
    await db.collection(BORROW_COL).doc(borrowId).update({status:'approved'});
    await db.collection(PERSONAL_COL).doc(bookId).update({available:false});
    // Notify borrower
    await sendNotif(borrowerPhone,'borrow_approved',{
      title:'✅ ধারের অনুরোধ অনুমোদিত!',
      body:`"${bookTitle}" বইটি আপনাকে ধার দেওয়া হয়েছে।`,
      relatedId:borrowId,bookTitle
    });
    closeModal();
    showBorrowReceipt({borrowId,bookTitle,borrowerName,ownerName:currentUser.name,
      ownerPhone:currentUser.phone,borrowerPhone,fromDate,toDate});
    showToast('✅ অনুমোদন দেওয়া হয়েছে!');
  }catch(e){showToast('সমস্যা: '+e.message);}
}

async function rejectBorrow(borrowId,borrowerPhone,bookTitle) {
  try{
    await db.collection(BORROW_COL).doc(borrowId).update({status:'rejected'});
    await sendNotif(borrowerPhone,'borrow_rejected',{
      title:'❌ ধারের অনুরোধ প্রত্যাখ্যাত',
      body:`"${bookTitle}" বইটি এই মুহূর্তে ধার দেওয়া সম্ভব হচ্ছে না।`,
      relatedId:borrowId,bookTitle
    });
    closeModal();showToast('প্রত্যাখ্যান করা হয়েছে');navigate('personal');
  }catch(e){showToast('সমস্যা হয়েছে');}
}

async function markReturned(borrowId,bookId,borrowerPhone,bookTitle) {
  try{
    await db.collection(BORROW_COL).doc(borrowId).update({status:'returned'});
    await db.collection(PERSONAL_COL).doc(bookId).update({available:true});
    await sendNotif(borrowerPhone,'borrow_returned',{
      title:'📦 বই ফেরত নিশ্চিত',
      body:`"${bookTitle}" বইটি ফেরত পাওয়া হয়েছে।`,relatedId:borrowId,bookTitle
    });
    closeModal();showToast('✅ ফেরত চিহ্নিত!');navigate('personal');
  }catch(e){showToast('সমস্যা হয়েছে');}
}

async function deletePersonalBook(bookId) {
  if(!confirm('বইটি মুছে ফেলবেন?'))return;
  try{await db.collection(PERSONAL_COL).doc(bookId).delete();closeModal();showToast('মুছে ফেলা হয়েছে');navigate('personal');}
  catch(e){showToast('সমস্যা হয়েছে');}
}

function showBorrowReceipt(data) {
  const date=new Date().toLocaleDateString('bn-BD');
  const receiptId='BOR-'+Date.now();
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🧾 ধারের রশিদ</div>
    <div id="borrowReceiptContent" style="border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:14px;">
      <div style="text-align:center;border-bottom:2px solid var(--primary);padding-bottom:10px;margin-bottom:12px;">
        <div style="font-size:20px;">📚</div>
        <div style="font-family:var(--font-serif);font-size:16px;font-weight:700;color:var(--primary);">ওয়ান টু ওয়ান লাইব্রেরি</div>
        <div style="font-size:12px;color:var(--text-muted);">বই ধারের রশিদ</div>
      </div>
      <div style="font-size:13px;line-height:2.2;">
        <div><b>রশিদ নং:</b> ${receiptId}</div>
        <div><b>তারিখ:</b> ${date}</div>
        <div><b>বইয়ের নাম:</b> ${data.bookTitle}</div>
        <div><b>মালিক:</b> ${data.ownerName}
          <button onclick="copyToClipboard('${data.ownerPhone}')" style="margin-left:6px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:#fff;font-size:11px;cursor:pointer;">📞 ${data.ownerPhone} কপি</button>
        </div>
        <div><b>গ্রহীতা:</b> ${data.borrowerName}
          <button onclick="copyToClipboard('${data.borrowerPhone}')" style="margin-left:6px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:#fff;font-size:11px;cursor:pointer;">📞 ${data.borrowerPhone} কপি</button>
        </div>
        <div><b>ধার নেওয়ার তারিখ:</b> ${data.fromDate||''}</div>
        <div><b>ফেরতের তারিখ:</b> ${data.toDate||''}</div>
        <div><b>অবস্থা:</b> ✅ অনুমোদিত</div>
      </div>
      <div style="border-top:1px dashed var(--border);margin-top:10px;padding-top:10px;text-align:center;font-size:12px;color:var(--text-muted);">
        সময়মতো ফেরত দিন। ধন্যবাদ! 📚
      </div>
    </div>
    <button class="btn-primary btn-full" onclick="printBorrowReceipt()">🖨️ রশিদ প্রিন্ট করুন</button>
  `);
}

function printBorrowReceipt() {
  const c=document.getElementById('borrowReceiptContent');if(!c)return;
  const w=window.open('','_blank');
  w.document.write(`<html><head><title>ধারের রশিদ</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto;font-size:14px;line-height:1.8;}button{display:none;}</style>
    </head><body>${c.innerHTML}<script>window.print();window.onafterprint=()=>window.close();<\/script></body></html>`);
  w.document.close();
}
