// ============================================
// DASHBOARD — ইউজার হিস্টরি + রিপোর্ট + অভিযোগ
// ============================================
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page">
      <div class="section-header"><span class="section-title">📊 আমার ড্যাশবোর্ড</span></div>
      <div id="myStats" style="margin-bottom:16px;"></div>
      <div style="display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:4px;flex-wrap:wrap;">
        <button class="btn-primary btn-sm" onclick="loadDashTab('borrows')" id="tab-borrows">📚 ধার</button>
        <button class="btn-secondary btn-sm" onclick="loadDashTab('orders')" id="tab-orders">🖨️ প্রিন্ট</button>
        <button class="btn-secondary btn-sm" onclick="loadDashTab('mybooks')" id="tab-mybooks">🏡 আমার বই</button>
        <button class="btn-secondary btn-sm" onclick="loadDashTab('ebooks')" id="tab-ebooks">📖 ই-বুক</button>
        <button class="btn-secondary btn-sm" onclick="loadDashTab('shop')" id="tab-shop">🛍️ কেনাবেচা</button>
        <button class="btn-secondary btn-sm" onclick="loadDashTab('reports')" id="tab-reports">📊 রিপোর্ট</button>
        <button class="btn-secondary btn-sm" onclick="loadDashTab('complaints')" id="tab-complaints">⚠️ অভিযোগ</button>
      </div>
      <div id="dashContent"></div>
    </div>`;
  loadMyStats();
  loadDashTab('borrows');
}

async function loadMyStats() {
  const el=document.getElementById('myStats'); if(!el) return;
  try {
    const [borrows,myBooks,shopOrders]=await Promise.all([
      db.collection(BORROW_COL).where('borrowerPhone','==',currentUser.phone).get(),
      db.collection(PERSONAL_COL).where('ownerPhone','==',currentUser.phone).get(),
      db.collection('shop_orders').where('buyerPhone','==',currentUser.phone).get()
    ]);
    const active=borrows.docs.filter(d=>d.data().status==='approved').length;
    el.innerHTML=`<div class="stats-row">
      <div class="stat-box"><div class="stat-num">${active}</div><div class="stat-lbl">সক্রিয় ধার</div></div>
      <div class="stat-box"><div class="stat-num">${myBooks.size}</div><div class="stat-lbl">আমার বই</div></div>
      <div class="stat-box"><div class="stat-num">${shopOrders.size}</div><div class="stat-lbl">ক্রয়</div></div>
    </div>`;
  } catch(e){}
}

function loadDashTab(tab) {
  ['borrows','orders','mybooks','ebooks','shop','reports','complaints'].forEach(t=>{
    const b=document.getElementById('tab-'+t);
    if(b) b.className=t===tab?'btn-primary btn-sm':'btn-secondary btn-sm';
  });
  switch(tab){
    case 'borrows':    loadMyBorrows(); break;
    case 'orders':     loadMyOrders(); break;
    case 'mybooks':    loadMyPersonalBooks(); break;
    case 'ebooks':     loadMyEbooks(); break;
    case 'shop':       loadMyShopHistory(); break;
    case 'reports':    loadMyReports(); break;
    case 'complaints': loadMyComplaints(); break;
  }
}

// ---- ধার হিস্টরি (active + returned) ----
async function loadMyBorrows() {
  const el=document.getElementById('dashContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    // As borrower
    const borSnap=await db.collection(BORROW_COL).where('borrowerPhone','==',currentUser.phone).get();
    // As owner
    const ownSnap=await db.collection(BORROW_COL).where('ownerPhone','==',currentUser.phone).get();

    const asBorrower=borSnap.docs.map(d=>({id:d.id,role:'borrower',...d.data()}));
    const asOwner=ownSnap.docs.map(d=>({id:d.id,role:'owner',...d.data()}));
    const all=[...asBorrower,...asOwner].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

    if(!all.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📚</div><p>কোনো ধারের রেকর্ড নেই</p></div>`;return;}

    // Separate active vs returned
    const active=all.filter(b=>b.status==='approved'||b.status==='requested');
    const returned=all.filter(b=>b.status==='returned'||b.status==='rejected');

    let html='';

    if(active.length) {
      html+=`<div style="font-weight:700;color:var(--primary-dark);margin-bottom:8px;font-size:14px;">📌 সক্রিয় (${active.length}টি)</div>`;
      html+=active.map(b=>borrowCard(b)).join('');
    }
    if(returned.length) {
      html+=`<div style="font-weight:700;color:var(--text-muted);margin:14px 0 8px;font-size:14px;">✅ সম্পন্ন (${returned.length}টি)</div>`;
      html+=returned.map(b=>borrowCard(b,true)).join('');
    }

    el.innerHTML=html;
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

function borrowCard(b, isHistory=false) {
  const isBorrower=b.role==='borrower';
  const badge=b.status==='returned'?'badge-green':b.status==='approved'?(b.returnRequested?'badge-yellow':'badge-blue'):b.status==='rejected'?'badge-red':'badge-yellow';
  const label=b.status==='returned'?'ফেরত দিয়েছি':b.status==='approved'?(b.returnRequested?'⚡ ফেরত পাঠানো':'ধার নিয়েছি'):b.status==='rejected'?'প্রত্যাখ্যাত':'অনুরোধ করেছি';
  const otherLabel=isBorrower?`মালিক: ${b.ownerName}`:`গ্রহীতা: ${b.borrowerName}`;
  const otherPhone=isBorrower?b.ownerPhone:b.borrowerPhone;

  let actionHTML='';
  if(isBorrower && b.status==='approved' && !b.returnRequested && !isHistory) {
    actionHTML=`<button class="btn-secondary btn-sm" style="margin-top:8px;" onclick="requestReturnBook('${b.id}','${escHtml(b.bookTitle)}','${b.ownerPhone}')">🔄 ফেরত দিতে চাই</button>`;
  }
  if(isBorrower && b.returnRequested && b.status==='approved') {
    actionHTML=`<div style="color:var(--accent);font-size:12px;font-weight:600;margin-top:6px;">⏳ ফেরতের অনুরোধ পাঠানো হয়েছে</div>`;
  }

  return `<div class="history-item type-borrow" onclick="showBorrowDetail('${b.id}')" style="cursor:pointer;">
    <div class="flex-between">
      <div class="history-title">📕 ${b.bookTitle}</div>
      <span class="badge ${badge}" style="font-size:11px;">${label}</span>
    </div>
    <div class="history-date">${otherLabel}</div>
    <div class="history-date">📅 ${b.fromDate} → ${b.toDate}</div>
    ${b.status==='returned'?`<div class="text-sm" style="color:var(--success);">✅ সফলভাবে ফেরত দেওয়া হয়েছে</div>`:''}
    ${actionHTML}
    <div class="text-sm text-muted" style="margin-top:4px;">→ বিস্তারিত দেখতে ক্লিক করুন</div>
  </div>`;
}

async function showBorrowDetail(borrowId) {
  try {
    const doc=await db.collection(BORROW_COL).doc(borrowId).get();
    if(!doc.exists){showToast('পাওয়া যায়নি');return;}
    const b=doc.data();
    const isBorrower=b.borrowerPhone===currentUser.phone;
    showModal(`
      <span class="modal-close" onclick="closeModal()">✕</span>
      <div class="modal-title">📕 ধারের বিস্তারিত</div>
      <div class="card" style="margin-bottom:14px;background:#f0f9f4;">
        <div style="font-weight:700;font-size:16px;">${b.bookTitle}</div>
        <span class="badge ${b.status==='returned'?'badge-green':b.status==='approved'?'badge-blue':'badge-yellow'}">${b.status==='returned'?'ফেরত':b.status==='approved'?'সক্রিয়':'অনুরোধ'}</span>
      </div>
      <div style="font-size:13px;line-height:2.2;">
        <div><b>মালিক:</b> ${b.ownerName}
          <button onclick="copyToClipboard('${b.ownerPhone}')" style="margin-left:6px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:#fff;font-size:11px;cursor:pointer;">📞 ${b.ownerPhone} কপি</button>
        </div>
        <div><b>গ্রহীতা:</b> ${b.borrowerName}
          <button onclick="copyToClipboard('${b.borrowerPhone}')" style="margin-left:6px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:#fff;font-size:11px;cursor:pointer;">📞 ${b.borrowerPhone} কপি</button>
        </div>
        <div><b>📍 গ্রহীতার এলাকা:</b> ${b.borrowerVillage||''}, ${b.borrowerUpazila||''}</div>
        <div><b>ধার নেওয়ার তারিখ:</b> ${b.fromDate}</div>
        <div><b>ফেরতের তারিখ:</b> ${b.toDate}</div>
        ${b.message?`<div><b>বার্তা:</b> "${b.message}"</div>`:''}
        ${b.returnRequested?`<div><b>ফেরতের অনুরোধ:</b> ${b.returnRequestDate?formatDate(b.returnRequestDate):''}</div>`:''}
      </div>
      ${isBorrower&&b.status==='approved'&&!b.returnRequested?`
        <button class="btn-secondary btn-full" style="margin-top:12px;" onclick="closeModal();requestReturnBook('${borrowId}','${escHtml(b.bookTitle)}','${b.ownerPhone}')">🔄 ফেরত দিতে চাই</button>`:''}
      ${!isBorrower&&b.status==='approved'?`
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn-primary btn-sm" style="flex:1;" onclick="closeModal();markReturned('${borrowId}','UNKNOWN','${b.borrowerPhone}','${escHtml(b.bookTitle)}')">📦 ফেরত পেয়েছি</button>
          <button class="btn-secondary btn-sm" style="flex:1;" onclick="closeModal();showComplaintModal('${borrowId}','${escHtml(b.bookTitle)}','${b.borrowerPhone}','${escHtml(b.borrowerName)}')">⚠️ অভিযোগ</button>
        </div>`:''}
    `);
  } catch(e){showToast('লোড সমস্যা');}
}

// ---- প্রিন্ট অর্ডার ----
async function loadMyOrders() {
  const el=document.getElementById('dashContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(ORDERS_COL).where('userPhone','==',currentUser.phone).get();
    const items=snap.docs.map(d=>d.data()).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!items.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">🖨️</div><p>কোনো প্রিন্ট অর্ডার নেই</p></div>`;return;}
    el.innerHTML=items.map(o=>{
      const badge=o.status==='confirmed'?'badge-green':o.status==='cancelled'?'badge-red':'badge-yellow';
      return `<div class="history-item type-order">
        <div class="flex-between"><div class="history-title">🖨️ ${o.bookTitle}</div><span class="badge ${badge}">${o.status==='confirmed'?'নিশ্চিত':o.status==='cancelled'?'বাতিল':'অপেক্ষামান'}</span></div>
        <div class="history-date">📅 ${formatDate(o.createdAt)} · ${o.qty||1} কপি</div>
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

// ---- আমার বই ----
async function loadMyPersonalBooks() {
  const el=document.getElementById('dashContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(PERSONAL_COL).where('ownerPhone','==',currentUser.phone).get();
    if(!snap.size){el.innerHTML=`<div class="empty-state"><div class="empty-icon">🏡</div><p>কোনো বই নেই</p><button class="btn-primary btn-sm" onclick="navigate('personal')" style="margin-top:12px;">বই যোগ করুন</button></div>`;return;}
    const books=snap.docs.map(d=>d.data()).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    el.innerHTML=`<div class="text-sm text-muted" style="margin-bottom:8px;">মোট ${snap.size}টি (${snap.size>=5?'✅ ধার চাওয়ার যোগ্য':'⚠️ আরো '+(5-snap.size)+'টি দরকার'})</div>`+
    books.map(b=>`<div class="history-item">
      <div class="flex-between"><div class="history-title">📕 ${b.title}</div>
        <span class="badge ${b.available!==false?'badge-green':'badge-red'}">${b.available!==false?'আছে':'ধার দেওয়া'}</span></div>
      ${b.author?`<div class="history-date">✍️ ${b.author}</div>`:''}
      <div class="history-date">📅 ${formatDate(b.createdAt)}</div>
    </div>`).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

// ---- ই-বুক আপলোড ----
async function loadMyEbooks() {
  const el=document.getElementById('dashContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(EBOOKS_COL).where('uploaderPhone','==',currentUser.phone).get();
    if(!snap.size){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📖</div><p>কোনো আপলোড নেই</p></div>`;return;}
    const books=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    el.innerHTML=books.map(b=>`<div class="history-item">
      <div class="flex-between"><div class="history-title">📖 ${b.title}</div>
        <button class="btn-danger btn-sm" onclick="deleteMyEbook('${b.id}')">🗑️</button></div>
      <div class="history-date">📅 ${formatDate(b.createdAt)}</div>
    </div>`).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}
async function deleteMyEbook(id){
  if(!confirm('মুছে ফেলবেন?'))return;
  try{await db.collection(EBOOKS_COL).doc(id).delete();showToast('মুছে ফেলা হয়েছে');loadMyEbooks();}
  catch(e){showToast('সমস্যা');}
}

// ---- কেনাবেচা হিস্টরি ----
async function loadMyShopHistory() {
  const el=document.getElementById('dashContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const [buySnap,sellSnap]=await Promise.all([
      db.collection('shop_orders').where('buyerPhone','==',currentUser.phone).get(),
      db.collection('shop_orders').where('sellerPhone','==',currentUser.phone).get()
    ]);
    const all=[
      ...buySnap.docs.map(d=>({id:d.id,role:'buyer',...d.data()})),
      ...sellSnap.docs.map(d=>({id:d.id,role:'seller',...d.data()}))
    ].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!all.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">🛍️</div><p>কোনো কেনাবেচা নেই</p></div>`;return;}
    el.innerHTML=all.map(o=>{
      const badge=o.status==='confirmed'?'badge-green':o.status==='cancelled'?'badge-red':'badge-yellow';
      return `<div class="history-item type-order">
        <div class="flex-between">
          <div class="history-title">${o.role==='buyer'?'🛒':'🏪'} ${o.bookTitle}</div>
          <span class="badge ${badge}">${o.status==='confirmed'?'নিশ্চিত':o.status==='cancelled'?'বাতিল':'অপেক্ষামান'}</span>
        </div>
        <div class="history-date">${o.role==='buyer'?`🏪 ${o.libraryName}`:`👤 ${o.buyerName}`} · ৳${o.total}</div>
        <div class="history-date">📅 ${formatDate(o.createdAt)}</div>
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

// ---- রিপোর্ট ----
async function loadMyReports() {
  const el=document.getElementById('dashContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  const now=new Date();
  const thisMonth=now.getMonth(); const thisYear=now.getFullYear();
  const weekAgo=new Date(now-7*24*3600*1000).toISOString();
  const monthStart=new Date(thisYear,thisMonth,1).toISOString();

  try {
    // Borrow report — as owner
    const ownedSnap=await db.collection(BORROW_COL).where('ownerPhone','==',currentUser.phone).get();
    const owned=ownedSnap.docs.map(d=>d.data());
    const ownedThisMonth=owned.filter(b=>b.createdAt>=monthStart);
    const activeOwned=owned.filter(b=>b.status==='approved');
    const returnedOwned=owned.filter(b=>b.status==='returned');

    // Borrow report — as borrower
    const borrowedSnap=await db.collection(BORROW_COL).where('borrowerPhone','==',currentUser.phone).get();
    const borrowed=borrowedSnap.docs.map(d=>d.data());
    const borrowedThisMonth=borrowed.filter(b=>b.createdAt>=monthStart);
    const activeBorrowed=borrowed.filter(b=>b.status==='approved');

    // Sales report
    const salesSnap=await db.collection('shop_orders').where('sellerPhone','==',currentUser.phone).get();
    const sales=salesSnap.docs.map(d=>d.data());
    const confirmedSales=sales.filter(s=>s.status==='confirmed');
    const salesThisWeek=confirmedSales.filter(s=>s.createdAt>=weekAgo);
    const salesThisMonth=confirmedSales.filter(s=>s.createdAt>=monthStart);
    const totalRevenue=confirmedSales.reduce((s,o)=>s+o.total,0);
    const weekRevenue=salesThisWeek.reduce((s,o)=>s+o.total,0);
    const monthRevenue=salesThisMonth.reduce((s,o)=>s+o.total,0);

    el.innerHTML=`
      <!-- ধার রিপোর্ট - মালিক -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-weight:700;color:var(--primary-dark);margin-bottom:12px;">📚 ধার রিপোর্ট (মালিক হিসেবে)</div>
        <div class="stats-row">
          <div class="stat-box"><div class="stat-num">${ownedThisMonth.length}</div><div class="stat-lbl">এই মাসে ধার</div></div>
          <div class="stat-box"><div class="stat-num">${activeOwned.length}</div><div class="stat-lbl">সক্রিয়</div></div>
          <div class="stat-box"><div class="stat-num">${returnedOwned.length}</div><div class="stat-lbl">ফেরত পেয়েছি</div></div>
        </div>
        ${ownedThisMonth.length?`
          <div style="margin-top:12px;">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px;">এই মাসে ধার দিয়েছেন:</div>
            ${ownedThisMonth.map(b=>`
              <div style="background:#f5f0e8;border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:13px;">
                <div style="font-weight:600;">📕 ${b.bookTitle}</div>
                <div style="color:var(--text-muted);">গ্রহীতা: ${b.borrowerName}
                  <button onclick="copyToClipboard('${b.borrowerPhone}')" style="margin-left:4px;padding:1px 6px;border:1px solid var(--border);border-radius:3px;background:#fff;font-size:10px;cursor:pointer;">📞 ${b.borrowerPhone}</button>
                </div>
                <div style="color:var(--text-muted);">📍 ${b.borrowerVillage||''}, ${b.borrowerUpazila||''}</div>
                <div style="color:var(--text-muted);">📅 ${b.fromDate} → ${b.toDate} · <span class="badge ${b.status==='returned'?'badge-green':b.status==='approved'?'badge-blue':'badge-yellow'}" style="font-size:10px;">${b.status==='returned'?'ফেরত':b.status==='approved'?'সক্রিয়':'অনুরোধ'}</span></div>
              </div>`).join('')}
          </div>`:''} 
      </div>

      <!-- ধার রিপোর্ট - গ্রহীতা -->
      <div class="card" style="margin-bottom:14px;">
        <div style="font-weight:700;color:var(--primary-dark);margin-bottom:12px;">📚 ধার রিপোর্ট (গ্রহীতা হিসেবে)</div>
        <div class="stats-row">
          <div class="stat-box"><div class="stat-num">${borrowedThisMonth.length}</div><div class="stat-lbl">এই মাসে</div></div>
          <div class="stat-box"><div class="stat-num">${activeBorrowed.length}</div><div class="stat-lbl">এখন আছে</div></div>
          <div class="stat-box"><div class="stat-num">${borrowed.filter(b=>b.status==='returned').length}</div><div class="stat-lbl">ফেরত দিয়েছি</div></div>
        </div>
        ${activeBorrowed.length?`
          <div style="margin-top:12px;">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px;">এখন যা আছে (ফেরত দেওয়া হয়নি):</div>
            ${activeBorrowed.map(b=>`
              <div style="background:${new Date(b.toDate)<new Date()?'#ffeaea':'#f5f0e8'};border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:13px;">
                <div style="font-weight:600;">📕 ${b.bookTitle}</div>
                <div style="color:var(--text-muted);">মালিক: ${b.ownerName}
                  <button onclick="copyToClipboard('${b.ownerPhone}')" style="margin-left:4px;padding:1px 6px;border:1px solid var(--border);border-radius:3px;background:#fff;font-size:10px;cursor:pointer;">📞 ${b.ownerPhone}</button>
                </div>
                <div style="color:${new Date(b.toDate)<new Date()?'var(--danger)':'var(--text-muted)'};">📅 ফেরতের তারিখ: ${b.toDate} ${new Date(b.toDate)<new Date()?'⚠️ মেয়াদ শেষ!':''}</div>
                ${!b.returnRequested?`<button class="btn-secondary btn-sm" style="margin-top:6px;" onclick="requestReturnBook('TBD','${escHtml(b.bookTitle)}','${b.ownerPhone}')">🔄 ফেরত দিতে চাই</button>`:'<div style="color:var(--accent);font-size:12px;margin-top:4px;">⏳ ফেরতের অনুরোধ পাঠানো হয়েছে</div>'}
              </div>`).join('')}
          </div>`:''} 
      </div>

      <!-- বিক্রয় রিপোর্ট -->
      ${confirmedSales.length||sales.length?`
      <div class="card">
        <div style="font-weight:700;color:var(--primary-dark);margin-bottom:12px;">🛍️ বিক্রয় রিপোর্ট</div>
        <div class="stats-row">
          <div class="stat-box"><div class="stat-num">৳${weekRevenue}</div><div class="stat-lbl">এই সপ্তাহ</div></div>
          <div class="stat-box"><div class="stat-num">৳${monthRevenue}</div><div class="stat-lbl">এই মাস</div></div>
          <div class="stat-box"><div class="stat-num">৳${totalRevenue}</div><div class="stat-lbl">সর্বমোট</div></div>
        </div>
        ${salesThisMonth.length?`
          <div style="margin-top:12px;">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px;">এই মাসের বিক্রয়:</div>
            ${salesThisMonth.map(s=>`
              <div style="background:#f0f9f4;border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:13px;">
                <div style="font-weight:600;">📗 ${s.bookTitle}</div>
                <div style="color:var(--text-muted);">ক্রেতা: ${s.buyerName}
                  <button onclick="copyToClipboard('${s.buyerPhone}')" style="margin-left:4px;padding:1px 6px;border:1px solid var(--border);border-radius:3px;background:#fff;font-size:10px;cursor:pointer;">📞 ${s.buyerPhone}</button>
                </div>
                <div style="color:var(--primary);font-weight:700;">৳${s.total} · ${s.qty||1} কপি</div>
                <div style="color:var(--text-muted);">📅 ${formatDate(s.createdAt)}</div>
              </div>`).join('')}
          </div>`:''} 
      </div>`:''}
    `;
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা: ${e.message}</p></div>`;}
}

// ---- ইউজার অভিযোগ হিস্টরি ----
async function loadMyComplaints() {
  const el=document.getElementById('dashContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(COMPLAINTS_COL)
      .where('complainantPhone','==',currentUser.phone).get();
    const items=snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!items.length){
      el.innerHTML=`<div class="empty-state"><div class="empty-icon">⚠️</div><p>কোনো অভিযোগ নেই</p></div>`;
      return;
    }
    el.innerHTML=items.map(c=>`
      <div class="history-item" onclick="showComplaintDetail('${c.id}')" style="cursor:pointer;">
        <div class="flex-between">
          <div class="history-title">⚠️ ${c.bookTitle}</div>
          <span class="badge ${c.status==='resolved'?'badge-green':'badge-yellow'}">${c.status==='resolved'?'সমাধান':'অপেক্ষামান'}</span>
        </div>
        <div class="history-date">বিষয়: ${c.type==='not_returned'?'ফেরত দিচ্ছে না':c.type==='damaged'?'বই নষ্ট':'অন্যান্য'}</div>
        <div class="history-date">📅 ${formatDate(c.createdAt)}</div>
        ${c.messages?.length?`<div class="text-sm" style="color:var(--primary);margin-top:4px;">💬 ${c.messages.length}টি বার্তা → দেখতে ক্লিক করুন</div>`:'<div class="text-sm text-muted" style="margin-top:4px;">→ বিস্তারিত দেখতে ক্লিক করুন</div>'}
      </div>`).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function showComplaintDetail(compId) {
  const doc=await db.collection(COMPLAINTS_COL).doc(compId).get();
  const c=doc.data();
  const msgHTML=c.messages?.length?c.messages.map(m=>`
    <div style="background:${m.from==='admin'?'#f0f9f4':'#e8f4fd'};border-radius:8px;padding:10px;margin-bottom:8px;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">${m.from==='admin'?'👨‍💼 অ্যাডমিন':'👤 আপনি'} · ${timeAgo(m.createdAt)}</div>
      <div style="font-size:14px;">${m.text}</div>
    </div>`).join(''):'<div class="text-muted text-sm">এখনো কোনো বার্তা নেই</div>';

  const canReply=c.messages?.some(m=>m.from==='admin')&&c.status!=='resolved';

  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">⚠️ অভিযোগ বিস্তারিত</div>
    <div class="card" style="margin-bottom:12px;background:#fff3cd;">
      <div style="font-weight:600;">${c.bookTitle}</div>
      <div class="text-sm text-muted">${c.description}</div>
    </div>
    <div style="margin-bottom:12px;">${msgHTML}</div>
    ${canReply?`
      <div class="input-group"><label>অ্যাডমিনকে উত্তর দিন</label>
        <textarea id="replyMsg" placeholder="আপনার বার্তা লিখুন..."></textarea></div>
      <button class="btn-primary btn-full" onclick="replyToComplaint('${compId}')">📩 পাঠান</button>`:''}
  `);
}

async function replyToComplaint(compId) {
  const text=document.getElementById('replyMsg').value.trim();
  if(!text) return showToast('বার্তা লিখুন');
  try {
    const doc=await db.collection(COMPLAINTS_COL).doc(compId).get();
    const c=doc.data();
    const messages=[...(c.messages||[]),{from:currentUser.phone,text,createdAt:new Date().toISOString()}];
    await db.collection(COMPLAINTS_COL).doc(compId).update({messages});
    // Notify admin
    const settings=await getSettings();
    if(settings.adminPhone) {
      await sendNotif(settings.adminPhone,'complaint_reply',{
        title:'📩 অভিযোগে নতুন বার্তা',
        body:`${currentUser.name}: ${text.substring(0,50)}...`,
        relatedId:compId
      });
    }
    closeModal();showToast('✅ বার্তা পাঠানো হয়েছে!');
  } catch(e){showToast('সমস্যা হয়েছে');}
}

// ============================================
// ADMIN PANEL
// ============================================
let adminAuthenticated=false;

async function renderAdmin(container) {
  const hash=window.location.hash;
  const isSecret=hash.includes('admin-')&&hash.length>10;
  if(!isSecret&&!adminAuthenticated){
    container.innerHTML=`<div class="page"><div class="empty-state" style="padding-top:80px;"><div class="empty-icon">🔒</div><p>পেজটি পাওয়া যায়নি</p></div></div>`;
    return;
  }
  if(!adminAuthenticated){showAdminLogin(container);return;}
  showAdminPanel(container);
}

function showAdminLogin(container) {
  container.innerHTML=`<div class="page"><div class="card" style="max-width:400px;margin:40px auto;">
    <div style="background:var(--primary-dark);color:#fff;border-radius:var(--radius) var(--radius) 0 0;margin:-16px -16px 16px;padding:20px;text-align:center;font-family:var(--font-serif);font-size:18px;font-weight:700;">🔐 অ্যাডমিন লগইন</div>
    <div class="input-group"><label>পাসওয়ার্ড</label>
      <input type="password" id="adminPassInput" placeholder="পাসওয়ার্ড দিন" onkeydown="if(event.key==='Enter')checkAdminPass()"></div>
    <button class="btn-primary" onclick="checkAdminPass()">প্রবেশ করুন</button>
  </div></div>`;
}

async function checkAdminPass() {
  const pass=document.getElementById('adminPassInput')?.value;
  if(!pass) return;
  const settings=await getSettings();
  if(pass===(settings.adminPass||'admin123')){
    adminAuthenticated=true;
    showAdminPanel(document.getElementById('mainContent'));
  } else showToast('❌ ভুল পাসওয়ার্ড');
}

async function showAdminPanel(container) {
  const settings=await getSettings();
  container.innerHTML=`<div class="page">
    <div style="background:var(--primary-dark);color:#fff;border-radius:var(--radius);margin-bottom:16px;padding:16px;text-align:center;font-family:var(--font-serif);font-size:18px;font-weight:700;">⚙️ অ্যাডমিন প্যানেল</div>
    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;color:var(--primary-dark);margin-bottom:12px;">⚙️ সেটিংস</div>
      <div class="input-group"><label>WhatsApp নম্বর</label><input type="tel" id="setWA" value="${settings.whatsapp||'01521256504'}"></div>
      <div class="input-group"><label>Facebook পেইজ</label><input type="text" id="setFB" value="${settings.fbPage||''}"></div>
      <div class="input-group"><label>অ্যাডমিন ফোন (নোটিফিকেশন পাবেন)</label><input type="tel" id="setAdminPhone" value="${settings.adminPhone||''}"></div>
      <div class="input-group"><label>নতুন পাসওয়ার্ড</label><input type="password" id="setPass" placeholder="খালি = পরিবর্তন নেই"></div>
      <button class="btn-primary" onclick="saveSettings()">✅ সেটিংস সেভ করুন</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:4px;flex-wrap:wrap;">
      <button class="btn-primary btn-sm" onclick="loadAdminTab('complaints')" id="atab-complaints">⚠️ অভিযোগ</button>
      <button class="btn-secondary btn-sm" onclick="loadAdminTab('orders')" id="atab-orders">🖨️ প্রিন্ট</button>
      <button class="btn-secondary btn-sm" onclick="loadAdminTab('shop')" id="atab-shop">🛍️ বিক্রয়</button>
      <button class="btn-secondary btn-sm" onclick="loadAdminTab('report')" id="atab-report">📊 রিপোর্ট</button>
      <button class="btn-secondary btn-sm" onclick="loadAdminTab('borrows')" id="atab-borrows">📚 ধার</button>
      <button class="btn-secondary btn-sm" onclick="loadAdminTab('users')" id="atab-users">👥 ইউজার</button>
      <button class="btn-secondary btn-sm" onclick="loadAdminTab('download')" id="atab-download">💾 ব্যাকআপ</button>
    </div>
    <div id="adminContent"></div>
  </div>`;
  loadAdminTab('complaints');
}

function loadAdminTab(tab) {
  ['complaints','orders','shop','report','borrows','users','download'].forEach(t=>{
    const b=document.getElementById('atab-'+t);
    if(b) b.className=t===tab?'btn-primary btn-sm':'btn-secondary btn-sm';
  });
  switch(tab){
    case 'complaints': loadAdminComplaints(); break;
    case 'orders':     loadAdminOrders(); break;
    case 'shop':       loadAdminShopOrders(); break;
    case 'report':     loadAdminReport(); break;
    case 'borrows':    loadAdminBorrows(); break;
    case 'users':      loadAdminUsers(); break;
    case 'download':   showDownloadPanel(); break;
  }
}

async function saveSettings() {
  const wa=document.getElementById('setWA').value.trim();
  const fb=document.getElementById('setFB').value.trim();
  const pass=document.getElementById('setPass').value.trim();
  const adminPhone=document.getElementById('setAdminPhone').value.trim();
  const update={whatsapp:wa,fbPage:fb,adminPhone};
  if(pass) update.adminPass=pass;
  try{
    await db.collection(SETTINGS_COL).doc('config').set(update,{merge:true});
    showToast('✅ সেটিংস সেভ হয়েছে!');
    if(pass) document.getElementById('setPass').value='';
  }catch(e){showToast('সমস্যা হয়েছে');}
}

// ---- অ্যাডমিন অভিযোগ প্যানেল + মেসেজিং ----
async function loadAdminComplaints() {
  const el=document.getElementById('adminContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(COMPLAINTS_COL).get();
    const items=snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!items.length){el.innerHTML=`<div class="empty-state"><p>কোনো অভিযোগ নেই</p></div>`;return;}
    el.innerHTML=`<div class="text-sm text-muted" style="margin-bottom:8px;">মোট: ${items.length}টি</div>`+
    items.map(c=>`
      <div class="history-item" style="cursor:pointer;" onclick="showAdminComplaintDetail('${c.id}')">
        <div class="flex-between">
          <div class="history-title">⚠️ ${c.bookTitle}</div>
          <span class="badge ${c.status==='resolved'?'badge-green':'badge-yellow'}">${c.status==='resolved'?'সমাধান':'অপেক্ষামান'}</span>
        </div>
        <div class="history-date">অভিযোগকারী: ${c.complainantName} (${c.complainantPhone})</div>
        <div class="history-date">সংশ্লিষ্ট: ${c.targetName} (${c.targetPhone})</div>
        <div class="history-date">বিষয়: ${c.type==='not_returned'?'ফেরত দিচ্ছে না':c.type==='damaged'?'বই নষ্ট':'অন্যান্য'}</div>
        <div class="history-date">📅 ${formatDate(c.createdAt)} · 💬 ${c.messages?.length||0}টি বার্তা</div>
        <div style="color:var(--primary);font-size:12px;margin-top:4px;">→ ক্লিক করে বার্তা পাঠান</div>
      </div>`).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function showAdminComplaintDetail(compId) {
  const doc=await db.collection(COMPLAINTS_COL).doc(compId).get();
  const c=doc.data();

  const msgHTML=(c.messages||[]).map(m=>`
    <div style="background:${m.from==='admin'?'#f0f9f4':'#e8f4fd'};border-radius:8px;padding:10px;margin-bottom:8px;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">${m.from==='admin'?'👨‍💼 অ্যাডমিন':`👤 ${m.from}`} · ${timeAgo(m.createdAt)}</div>
      <div style="font-size:14px;">${m.text}</div>
    </div>`).join('')||'<div class="text-muted text-sm">এখনো কোনো বার্তা নেই</div>';

  const msgCount=(c.messages||[]).filter(m=>m.from==='admin').length;
  const canReply=msgCount<3;

  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">⚠️ অভিযোগ ব্যবস্থাপনা</div>
    <div class="card" style="margin-bottom:12px;background:#fff3cd;">
      <div style="font-weight:600;">📕 ${c.bookTitle}</div>
      <div class="text-sm">${c.description}</div>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div style="font-size:13px;line-height:2;">
        <div><b>অভিযোগকারী:</b> ${c.complainantName}
          <button onclick="copyToClipboard('${c.complainantPhone}')" style="margin-left:4px;padding:1px 6px;border:1px solid var(--border);border-radius:3px;background:#fff;font-size:10px;cursor:pointer;">📞 ${c.complainantPhone} কপি</button>
        </div>
        <div><b>সংশ্লিষ্ট:</b> ${c.targetName}
          <button onclick="copyToClipboard('${c.targetPhone}')" style="margin-left:4px;padding:1px 6px;border:1px solid var(--border);border-radius:3px;background:#fff;font-size:10px;cursor:pointer;">📞 ${c.targetPhone} কপি</button>
        </div>
      </div>
    </div>
    <div style="margin-bottom:12px;">${msgHTML}</div>
    ${canReply?`
      <div class="input-group"><label>বার্তা পাঠান (${3-msgCount}টি বাকি)</label>
        <textarea id="adminReplyMsg" placeholder="অভিযোগকারীকে বার্তা লিখুন..."></textarea></div>
      <div style="display:flex;gap:8px;">
        <button class="btn-primary btn-sm" style="flex:1;" onclick="adminSendComplaintMsg('${compId}','${c.complainantPhone}','${c.targetPhone}')">📩 পাঠান</button>
        ${c.status!=='resolved'?`<button class="btn-secondary btn-sm" onclick="resolveComplaint('${compId}')">✅ সমাধান চিহ্নিত</button>`:''}
      </div>`:
    `<div style="background:#d4edda;border-radius:8px;padding:10px;text-align:center;font-size:13px;color:#155724;">সর্বোচ্চ ৩টি বার্তা পাঠানো হয়েছে</div>`}
  `);
}

async function adminSendComplaintMsg(compId,complainantPhone,targetPhone) {
  const text=document.getElementById('adminReplyMsg').value.trim();
  if(!text) return showToast('বার্তা লিখুন');
  try {
    const doc=await db.collection(COMPLAINTS_COL).doc(compId).get();
    const c=doc.data();
    const messages=[...(c.messages||[]),{from:'admin',text,createdAt:new Date().toISOString()}];
    await db.collection(COMPLAINTS_COL).doc(compId).update({messages});
    // Notify both parties
    await sendNotif(complainantPhone,'complaint_reply',{
      title:'📩 অ্যাডমিনের বার্তা',
      body:text.substring(0,80),relatedId:compId
    });
    await sendNotif(targetPhone,'complaint_reply',{
      title:'📩 অ্যাডমিনের বার্তা',
      body:text.substring(0,80),relatedId:compId
    });
    closeModal();showToast('✅ বার্তা পাঠানো হয়েছে!');loadAdminComplaints();
  } catch(e){showToast('সমস্যা হয়েছে');}
}

async function resolveComplaint(compId) {
  try{
    await db.collection(COMPLAINTS_COL).doc(compId).update({status:'resolved'});
    closeModal();showToast('✅ সমাধান চিহ্নিত!');loadAdminComplaints();
  }catch(e){showToast('সমস্যা হয়েছে');}
}

// ---- অ্যাডমিন: বিক্রয় রিপোর্ট ----
async function loadAdminReport() {
  const el=document.getElementById('adminContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  const now=new Date();
  const weekAgo=new Date(now-7*24*3600*1000).toISOString();
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString();
  try {
    const [shopSnap,borrowSnap]=await Promise.all([
      db.collection('shop_orders').get(),
      db.collection(BORROW_COL).get()
    ]);
    const allSales=shopSnap.docs.map(d=>d.data());
    const confirmed=allSales.filter(s=>s.status==='confirmed');
    const weekSales=confirmed.filter(s=>s.createdAt>=weekAgo);
    const monthSales=confirmed.filter(s=>s.createdAt>=monthStart);
    const totalRev=confirmed.reduce((s,o)=>s+o.total,0);
    const weekRev=weekSales.reduce((s,o)=>s+o.total,0);
    const monthRev=monthSales.reduce((s,o)=>s+o.total,0);

    const allBorrows=borrowSnap.docs.map(d=>d.data());
    const activeBorrows=allBorrows.filter(b=>b.status==='approved');
    const returnedBorrows=allBorrows.filter(b=>b.status==='returned');
    const monthBorrows=allBorrows.filter(b=>b.createdAt>=monthStart);

    // Library-wise sales
    const bySeller={};
    confirmed.forEach(s=>{
      if(!bySeller[s.libraryName]) bySeller[s.libraryName]={total:0,count:0,phone:s.sellerPhone};
      bySeller[s.libraryName].total+=s.total;
      bySeller[s.libraryName].count++;
    });

    el.innerHTML=`
      <div class="card" style="margin-bottom:14px;">
        <div style="font-weight:700;color:var(--primary-dark);margin-bottom:12px;">🛍️ বিক্রয় সারসংক্ষেপ</div>
        <div class="stats-row">
          <div class="stat-box"><div class="stat-num">৳${weekRev}</div><div class="stat-lbl">এই সপ্তাহ</div></div>
          <div class="stat-box"><div class="stat-num">৳${monthRev}</div><div class="stat-lbl">এই মাস</div></div>
          <div class="stat-box"><div class="stat-num">৳${totalRev}</div><div class="stat-lbl">সর্বমোট</div></div>
        </div>
        <div style="margin-top:12px;font-size:13px;font-weight:600;">লাইব্রেরি অনুযায়ী বিক্রয়:</div>
        ${Object.entries(bySeller).map(([name,data])=>`
          <div style="background:#f0f9f4;border-radius:6px;padding:8px 10px;margin-top:8px;">
            <div style="font-weight:600;">🏪 ${name}</div>
            <div style="color:var(--primary);font-weight:700;">৳${data.total} · ${data.count}টি অর্ডার</div>
            <button onclick="copyToClipboard('${data.phone}')" style="padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:#fff;font-size:11px;cursor:pointer;margin-top:4px;">📞 ${data.phone} কপি</button>
          </div>`).join('')}
      </div>
      <div class="card">
        <div style="font-weight:700;color:var(--primary-dark);margin-bottom:12px;">📚 ধার সারসংক্ষেপ</div>
        <div class="stats-row">
          <div class="stat-box"><div class="stat-num">${monthBorrows.length}</div><div class="stat-lbl">এই মাস</div></div>
          <div class="stat-box"><div class="stat-num">${activeBorrows.length}</div><div class="stat-lbl">সক্রিয়</div></div>
          <div class="stat-box"><div class="stat-num">${returnedBorrows.length}</div><div class="stat-lbl">ফেরত</div></div>
        </div>
        ${activeBorrows.filter(b=>new Date(b.toDate)<new Date()).length?`
          <div style="background:#ffeaea;border-radius:8px;padding:10px;margin-top:10px;">
            <div style="font-weight:600;color:var(--danger);">⚠️ মেয়াদোত্তীর্ণ: ${activeBorrows.filter(b=>new Date(b.toDate)<new Date()).length}টি বই</div>
            <div style="font-size:12px;color:var(--text-muted);">যে বইগুলোর ফেরতের তারিখ পার হয়ে গেছে</div>
          </div>`:''}
      </div>
    `;
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

// ---- অ্যাডমিন: প্রিন্ট অর্ডার ----
async function loadAdminOrders() {
  const el=document.getElementById('adminContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(ORDERS_COL).get();
    const items=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!items.length){el.innerHTML=`<div class="empty-state"><p>কোনো অর্ডার নেই</p></div>`;return;}
    el.innerHTML=items.map(o=>{
      const badge=o.status==='confirmed'?'badge-green':o.status==='cancelled'?'badge-red':'badge-yellow';
      return `<div class="history-item type-order">
        <div class="flex-between"><div class="history-title">🖨️ ${o.bookTitle}</div><span class="badge ${badge}">${o.status==='confirmed'?'নিশ্চিত':o.status==='cancelled'?'বাতিল':'অপেক্ষামান'}</span></div>
        <div class="history-date">👤 ${o.userName}
          <button onclick="copyToClipboard('${o.userPhone}')" style="margin-left:4px;padding:1px 6px;border:1px solid var(--border);border-radius:3px;background:#fff;font-size:10px;cursor:pointer;">📞 ${o.userPhone}</button>
        </div>
        <div class="history-date">📅 ${formatDate(o.createdAt)} · ${o.qty||1} কপি</div>
        ${o.status==='pending'?`<div style="display:flex;gap:6px;margin-top:8px;">
          <button class="btn-primary btn-sm" onclick="updateOrderStatus('${o.id}','confirmed')">✅ নিশ্চিত</button>
          <button class="btn-danger btn-sm" onclick="updateOrderStatus('${o.id}','cancelled')">❌ বাতিল</button>
        </div>`:''}
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}
async function updateOrderStatus(id,status){
  try{await db.collection(ORDERS_COL).doc(id).update({status});showToast('✅ আপডেট!');loadAdminOrders();}
  catch(e){showToast('সমস্যা');}
}

// ---- অ্যাডমিন: সকল বিক্রয় অর্ডার ----
async function loadAdminShopOrders() {
  const el=document.getElementById('adminContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection('shop_orders').get();
    const items=snap.docs.map(d=>d.data()).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    const total=items.filter(o=>o.status==='confirmed').reduce((s,o)=>s+o.total,0);
    if(!items.length){el.innerHTML=`<div class="empty-state"><p>কোনো বিক্রয় নেই</p></div>`;return;}
    el.innerHTML=`<div class="card" style="margin-bottom:12px;background:#f0f9f4;">
      <div class="flex-between"><span>মোট বিক্রয়: ${items.length}টি</span>
        <span style="font-weight:700;color:var(--primary);">নিশ্চিত: ৳${total}</span></div>
    </div>`+
    items.map(o=>{
      const badge=o.status==='confirmed'?'badge-green':o.status==='cancelled'?'badge-red':'badge-yellow';
      return `<div class="history-item type-order">
        <div class="flex-between"><div class="history-title">📗 ${o.bookTitle}</div><span class="badge ${badge}">${o.status==='confirmed'?'নিশ্চিত':o.status==='cancelled'?'বাতিল':'অপেক্ষামান'}</span></div>
        <div class="history-date">🏪 ${o.libraryName}</div>
        <div class="history-date">ক্রেতা: ${o.buyerName}
          <button onclick="copyToClipboard('${o.buyerPhone}')" style="margin-left:4px;padding:1px 6px;border:1px solid var(--border);border-radius:3px;background:#fff;font-size:10px;cursor:pointer;">📞 ${o.buyerPhone}</button>
        </div>
        <div class="history-date">💰 ৳${o.total} · 📅 ${formatDate(o.createdAt)}</div>
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

// ---- অ্যাডমিন: ধার রেকর্ড ----
async function loadAdminBorrows() {
  const el=document.getElementById('adminContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(BORROW_COL).get();
    const items=snap.docs.map(d=>d.data()).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!items.length){el.innerHTML=`<div class="empty-state"><p>কোনো রেকর্ড নেই</p></div>`;return;}
    const overdue=items.filter(b=>b.status==='approved'&&new Date(b.toDate)<new Date());
    el.innerHTML=(overdue.length?`<div style="background:#ffeaea;border-radius:8px;padding:10px;margin-bottom:12px;font-weight:600;color:var(--danger);">⚠️ মেয়াদোত্তীর্ণ: ${overdue.length}টি বই ফেরত আসেনি</div>`:'')+
    items.map(b=>{
      const badge=b.status==='returned'?'badge-green':b.status==='approved'?'badge-blue':'badge-yellow';
      const overDue=b.status==='approved'&&new Date(b.toDate)<new Date();
      return `<div class="history-item type-borrow" style="${overDue?'border-left-color:var(--danger);':''}">
        <div class="flex-between"><div class="history-title">📕 ${b.bookTitle}</div><span class="badge ${badge}">${b.status==='returned'?'ফেরত':b.status==='approved'?'ধার দেওয়া':'অনুরোধ'}</span></div>
        <div class="history-date">👤 ${b.borrowerName}
          <button onclick="copyToClipboard('${b.borrowerPhone}')" style="margin-left:4px;padding:1px 6px;border:1px solid var(--border);border-radius:3px;background:#fff;font-size:10px;cursor:pointer;">📞 ${b.borrowerPhone}</button>
        </div>
        <div class="history-date">🏡 মালিক: ${b.ownerName}
          <button onclick="copyToClipboard('${b.ownerPhone}')" style="margin-left:4px;padding:1px 6px;border:1px solid var(--border);border-radius:3px;background:#fff;font-size:10px;cursor:pointer;">📞 ${b.ownerPhone}</button>
        </div>
        <div class="history-date ${overDue?'text-red':''}">📅 ${b.fromDate} → ${b.toDate} ${overDue?'⚠️ মেয়াদ শেষ!':''}</div>
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

// ---- অ্যাডমিন: ইউজার ----
async function loadAdminUsers(search='') {
  const el=document.getElementById('adminContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(USERS_COL).get();
    let users=snap.docs.map(d=>d.data()).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    el.innerHTML=`
      <div class="search-bar" style="margin-bottom:10px;"><span>🔍</span>
        <input type="text" id="userSearch" placeholder="নাম, নম্বর, গ্রাম, উপজেলা, জেলা..."
          value="${search}" oninput="loadAdminUsers(this.value)">
      </div>
      <div id="userListArea"></div>`;
    const s=search.toLowerCase();
    if(s) users=users.filter(u=>u.name?.toLowerCase().includes(s)||u.phone?.includes(s)||u.village?.toLowerCase().includes(s)||u.upazila?.toLowerCase().includes(s)||u.district?.toLowerCase().includes(s));
    const listEl=document.getElementById('userListArea'); if(!listEl) return;
    listEl.innerHTML=`<div class="text-sm text-muted" style="margin-bottom:8px;">মোট: ${users.length} জন</div>`+
    users.map(u=>`<div class="history-item">
      <div class="history-title">👤 ${u.name}</div>
      <div class="history-date">📞 ${u.phone}
        <button onclick="copyToClipboard('${u.phone}')" style="margin-left:4px;padding:1px 6px;border:1px solid var(--border);border-radius:3px;background:#fff;font-size:10px;cursor:pointer;">কপি</button>
      </div>
      <div class="history-date">📍 ${u.village||''}, ${u.upazila||''}, ${u.district||''}</div>
      <div class="history-date">📅 ${formatDate(u.createdAt)}</div>
    </div>`).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

// ---- ব্যাকআপ ----
function showDownloadPanel() {
  const el=document.getElementById('adminContent'); if(!el) return;
  el.innerHTML=`<div class="card">
    <div style="font-weight:700;color:var(--primary-dark);margin-bottom:12px;">💾 ডেটা ব্যাকআপ (CSV)</div>
    <p class="text-sm text-muted" style="margin-bottom:14px;">সব ডেটা Excel-এ ডাউনলোড করে রাখুন।</p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button class="btn-primary" onclick="downloadCSV('users')">👥 সকল ইউজার</button>
      <button class="btn-primary" onclick="downloadCSV('ebooks')">📖 সকল ই-বুক</button>
      <button class="btn-primary" onclick="downloadCSV('personal_books')">🏡 ব্যক্তিগত লাইব্রেরি</button>
      <button class="btn-primary" onclick="downloadCSV('orders')">🖨️ প্রিন্ট অর্ডার</button>
      <button class="btn-primary" onclick="downloadCSV('shop_orders')">🛍️ বিক্রয় অর্ডার</button>
      <button class="btn-primary" onclick="downloadCSV('borrows')">📚 ধারের রেকর্ড</button>
      <button class="btn-primary" onclick="downloadCSV('libraries')">🏪 লাইব্রেরি তালিকা</button>
      <button class="btn-primary" onclick="downloadCSV('complaints')">⚠️ অভিযোগ</button>
      <button class="btn-accent" onclick="downloadAllCSV()" style="margin-top:4px;">⬇️ সব একসাথে</button>
    </div>
  </div>`;
}

async function downloadCSV(colName) {
  showToast('ডাউনলোড হচ্ছে...');
  try {
    const snap=await db.collection(colName).get();
    if(snap.empty){showToast('কোনো ডেটা নেই');return;}
    const rows=snap.docs.map(d=>d.data());
    const headers=Object.keys(rows[0]);
    const csv=[headers.join(','),
      ...rows.map(r=>headers.map(h=>{
        const v=r[h]!=null?(typeof r[h]==='object'?JSON.stringify(r[h]):r[h]).toString():'';
        return `"${v.replace(/"/g,'""')}"`;
      }).join(','))
    ].join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=`${colName}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();URL.revokeObjectURL(url);
    showToast(`✅ ${snap.size}টি রেকর্ড ডাউনলোড!`);
  } catch(e){showToast('সমস্যা: '+e.message);}
}

async function downloadAllCSV() {
  const cols=['users','ebooks','personal_books','orders','shop_orders','borrows','libraries','complaints'];
  for(const col of cols){await downloadCSV(col);await new Promise(r=>setTimeout(r,800));}
}
