// ============================================
// DASHBOARD - User History
// ============================================
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page">
      <div class="section-header"><span class="section-title">📊 আমার ড্যাশবোর্ড</span></div>
      <div id="myStats" style="margin-bottom:16px;"></div>
      <div style="display:flex;gap:8px;margin-bottom:14px;overflow-x:auto;padding-bottom:4px;">
        <button class="btn-primary btn-sm" onclick="loadDashTab('orders')" id="tab-orders">📦 অর্ডার</button>
        <button class="btn-secondary btn-sm" onclick="loadDashTab('borrows')" id="tab-borrows">📚 ধার</button>
        <button class="btn-secondary btn-sm" onclick="loadDashTab('mybooks')" id="tab-mybooks">🏡 আমার বই</button>
        <button class="btn-secondary btn-sm" onclick="loadDashTab('ebooks')" id="tab-ebooks">📖 আপলোড</button>
      </div>
      <div id="dashContent"></div>
    </div>`;
  loadMyStats(); loadDashTab('orders');
}

async function loadMyStats() {
  const el = document.getElementById('myStats');
  if (!el) return;
  try {
    const [orders,borrows,myBooks,myEbooks] = await Promise.all([
      db.collection(ORDERS_COL).where('userPhone','==',currentUser.phone).get(),
      db.collection(BORROW_COL).where('borrowerPhone','==',currentUser.phone).get(),
      db.collection(PERSONAL_COL).where('ownerPhone','==',currentUser.phone).get(),
      db.collection(EBOOKS_COL).where('uploaderPhone','==',currentUser.phone).get()
    ]);
    el.innerHTML = `<div class="stats-row">
      <div class="stat-box"><div class="stat-num">${orders.size}</div><div class="stat-lbl">অর্ডার</div></div>
      <div class="stat-box"><div class="stat-num">${borrows.size}</div><div class="stat-lbl">ধার</div></div>
      <div class="stat-box"><div class="stat-num">${myBooks.size}</div><div class="stat-lbl">আমার বই</div></div>
      <div class="stat-box"><div class="stat-num">${myEbooks.size}</div><div class="stat-lbl">আপলোড</div></div>
    </div>`;
  } catch(e){}
}

function loadDashTab(tab) {
  ['orders','borrows','mybooks','ebooks'].forEach(t=>{
    const b=document.getElementById('tab-'+t);
    if(b) b.className=t===tab?'btn-primary btn-sm':'btn-secondary btn-sm';
  });
  switch(tab){
    case 'orders': loadMyOrders(); break;
    case 'borrows': loadMyBorrows(); break;
    case 'mybooks': loadMyPersonalBooks(); break;
    case 'ebooks': loadMyEbooks(); break;
  }
}

async function loadMyOrders() {
  const el=document.getElementById('dashContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(ORDERS_COL).where('userPhone','==',currentUser.phone).orderBy('createdAt','desc').get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📦</div><p>কোনো অর্ডার নেই</p></div>`;return;}
    el.innerHTML=snap.docs.map(d=>{const o=d.data();
      const badge=o.status==='confirmed'?'badge-green':o.status==='cancelled'?'badge-red':'badge-yellow';
      const label=o.status==='confirmed'?'নিশ্চিত':o.status==='cancelled'?'বাতিল':'অপেক্ষামান';
      return `<div class="history-item type-order">
        <div class="flex-between"><div class="history-title">${o.type==='print'?'🖨️':'📗'} ${o.bookTitle}</div><span class="badge ${badge}">${label}</span></div>
        <div class="history-date">📅 ${formatDate(o.createdAt)} · ${o.qty||1} কপি</div>
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function loadMyBorrows() {
  const el=document.getElementById('dashContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(BORROW_COL).where('borrowerPhone','==',currentUser.phone).orderBy('createdAt','desc').get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📚</div><p>কোনো ধারের রেকর্ড নেই</p></div>`;return;}
    el.innerHTML=snap.docs.map(d=>{const b=d.data();
      const badge=b.status==='returned'?'badge-green':b.status==='approved'?'badge-blue':b.status==='rejected'?'badge-red':'badge-yellow';
      const label=b.status==='returned'?'ফেরত':b.status==='approved'?'অনুমোদিত':b.status==='rejected'?'না':'অপেক্ষামান';
      return `<div class="history-item type-borrow">
        <div class="flex-between"><div class="history-title">📕 ${b.bookTitle}</div><span class="badge ${badge}">${label}</span></div>
        <div class="history-date">👤 ${b.ownerName} · 📅 ${b.fromDate}→${b.toDate}</div>
        ${b.status==='approved'?`<a href="${buildWhatsAppLink(b.ownerPhone,`"${b.bookTitle}" বইটি ফেরত দিতে চাই।`)}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;display:inline-block;margin-top:6px;">📱 ফেরত যোগাযোগ</a>`:''}
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function loadMyPersonalBooks() {
  const el=document.getElementById('dashContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(PERSONAL_COL).where('ownerPhone','==',currentUser.phone).orderBy('createdAt','desc').get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><div class="empty-icon">🏡</div><p>কোনো বই নেই</p><button class="btn-primary btn-sm" onclick="navigate('personal')" style="margin-top:12px;">বই যোগ করুন</button></div>`;return;}
    el.innerHTML=snap.docs.map(d=>{const b=d.data();
      return `<div class="history-item">
        <div class="flex-between"><div class="history-title">📕 ${b.title}</div><span class="badge ${b.available!==false?'badge-green':'badge-red'}">${b.available!==false?'আছে':'ধার দেওয়া'}</span></div>
        <div class="history-date">📅 ${formatDate(b.createdAt)}</div>
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function loadMyEbooks() {
  const el=document.getElementById('dashContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(EBOOKS_COL).where('uploaderPhone','==',currentUser.phone).orderBy('createdAt','desc').get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📖</div><p>কোনো আপলোড নেই</p></div>`;return;}
    el.innerHTML=snap.docs.map(d=>{const b=d.data();
      return `<div class="history-item">
        <div class="flex-between"><div class="history-title">📖 ${b.title}</div>
        <button class="btn-danger btn-sm" onclick="deleteMyEbook('${d.id}')">🗑️</button></div>
        <div class="history-date">📅 ${formatDate(b.createdAt)}</div>
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function deleteMyEbook(id) {
  if(!confirm('মুছে ফেলবেন?')) return;
  try{await db.collection(EBOOKS_COL).doc(id).delete();showToast('মুছে ফেলা হয়েছে');loadMyEbooks();}
  catch(e){showToast('সমস্যা হয়েছে');}
}

// ============================================
// ADMIN PANEL
// ============================================
let adminAuthenticated = false;

async function renderAdmin(container) {
  const hash = window.location.hash;
  const isSecretURL = hash.includes('admin-') && hash.length > 10;
  if (!isSecretURL && !adminAuthenticated) {
    container.innerHTML=`<div class="page"><div class="empty-state" style="padding-top:80px;"><div class="empty-icon">🔒</div><p>পেজটি পাওয়া যায়নি</p></div></div>`;
    return;
  }
  if (!adminAuthenticated) { showAdminLogin(container); return; }
  showAdminPanel(container);
}

function showAdminLogin(container) {
  container.innerHTML=`
    <div class="page">
      <div class="card" style="max-width:400px;margin:40px auto;">
        <div style="background:var(--primary-dark);color:#fff;border-radius:var(--radius) var(--radius) 0 0;margin:-16px -16px 16px;padding:20px;text-align:center;font-family:var(--font-serif);font-size:18px;font-weight:700;">🔐 অ্যাডমিন লগইন</div>
        <div class="input-group"><label>পাসওয়ার্ড</label>
        <input type="password" id="adminPassInput" placeholder="পাসওয়ার্ড দিন" onkeydown="if(event.key==='Enter')checkAdminPass()"></div>
        <button class="btn-primary" onclick="checkAdminPass()">প্রবেশ করুন</button>
      </div>
    </div>`;
}

async function checkAdminPass() {
  const pass=document.getElementById('adminPassInput')?.value;
  if(!pass) return;
  const settings=await getSettings();
  if(pass===(settings.adminPass||'admin123')){
    adminAuthenticated=true;
    showAdminPanel(document.getElementById('mainContent'));
  } else { showToast('❌ ভুল পাসওয়ার্ড'); }
}

async function showAdminPanel(container) {
  const settings=await getSettings();
  container.innerHTML=`
    <div class="page">
      <div style="background:var(--primary-dark);color:#fff;border-radius:var(--radius);margin-bottom:16px;padding:16px;text-align:center;font-family:var(--font-serif);font-size:18px;font-weight:700;">⚙️ অ্যাডমিন প্যানেল</div>
      <div class="card" style="margin-bottom:16px;">
        <div style="font-weight:700;color:var(--primary-dark);margin-bottom:12px;">⚙️ সেটিংস</div>
        <div class="input-group"><label>WhatsApp নম্বর</label><input type="tel" id="setWA" value="${settings.whatsapp||'01521256504'}" placeholder="01XXXXXXXXX"></div>
        <div class="input-group"><label>Facebook পেইজ Username</label><input type="text" id="setFB" value="${settings.fbPage||''}" placeholder="yourpage"></div>
        <div class="input-group"><label>নতুন পাসওয়ার্ড (খালি = পরিবর্তন নেই)</label><input type="password" id="setPass" placeholder="নতুন পাসওয়ার্ড"></div>
        <button class="btn-primary" onclick="saveSettings()">✅ সেটিংস সেভ করুন</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px;overflow-x:auto;padding-bottom:4px;">
        <button class="btn-primary btn-sm" onclick="loadAdminTab('orders')" id="atab-orders">📦 অর্ডার</button>
        <button class="btn-secondary btn-sm" onclick="loadAdminTab('borrows')" id="atab-borrows">📚 ধার</button>
        <button class="btn-secondary btn-sm" onclick="loadAdminTab('users')" id="atab-users">👥 ইউজার</button>
        <button class="btn-secondary btn-sm" onclick="loadAdminTab('ebooks')" id="atab-ebooks">📖 ই-বুক</button>
        <button class="btn-secondary btn-sm" onclick="loadAdminTab('download')" id="atab-download">💾 ডাউনলোড</button>
      </div>
      <div id="adminContent"></div>
    </div>`;
  loadAdminTab('orders');
}

function loadAdminTab(tab) {
  ['orders','borrows','users','ebooks','download'].forEach(t=>{
    const b=document.getElementById('atab-'+t);
    if(b) b.className=t===tab?'btn-primary btn-sm':'btn-secondary btn-sm';
  });
  switch(tab){
    case 'orders': loadAdminOrders(); break;
    case 'borrows': loadAdminBorrows(); break;
    case 'users': loadAdminUsers(); break;
    case 'ebooks': loadAdminEbooks(); break;
    case 'download': showDownloadPanel(); break;
  }
}

async function saveSettings() {
  const wa=document.getElementById('setWA').value.trim();
  const fb=document.getElementById('setFB').value.trim();
  const pass=document.getElementById('setPass').value.trim();
  const update={whatsapp:wa,fbPage:fb};
  if(pass) update.adminPass=pass;
  try{
    await db.collection(SETTINGS_COL).doc('config').set(update,{merge:true});
    showToast('✅ সেটিংস সেভ হয়েছে!');
    if(pass) document.getElementById('setPass').value='';
  }catch(e){showToast('সমস্যা হয়েছে');}
}

async function loadAdminOrders() {
  const el=document.getElementById('adminContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(ORDERS_COL).orderBy('createdAt','desc').limit(50).get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><p>কোনো অর্ডার নেই</p></div>`;return;}
    el.innerHTML=snap.docs.map(d=>{const o=d.data();
      const badge=o.status==='confirmed'?'badge-green':o.status==='cancelled'?'badge-red':'badge-yellow';
      const label=o.status==='confirmed'?'নিশ্চিত':o.status==='cancelled'?'বাতিল':'অপেক্ষামান';
      return `<div class="history-item type-order">
        <div class="flex-between"><div class="history-title">🖨️ ${o.bookTitle}</div><span class="badge ${badge}">${label}</span></div>
        <div class="history-date">👤 ${o.userName} · 📞 ${o.userPhone}</div>
        <div class="history-date">📅 ${formatDate(o.createdAt)} · ${o.qty||1} কপি</div>
        ${o.address?`<div class="history-date">📍 ${o.address}</div>`:''}
        ${o.status==='pending'?`<div style="display:flex;gap:6px;margin-top:8px;">
          <button class="btn-primary btn-sm" onclick="updateOrderStatus('${d.id}','confirmed')">✅ নিশ্চিত</button>
          <button class="btn-danger btn-sm" onclick="updateOrderStatus('${d.id}','cancelled')">❌ বাতিল</button>
          <a href="${buildWhatsAppLink(o.userPhone,`আপনার "${o.bookTitle}" অর্ডার নিশ্চিত হয়েছে! ধন্যবাদ।`)}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;display:inline-block;">📱 নোটিফাই</a>
        </div>`:''}
      </div>`;
    }).join('');
  }catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function updateOrderStatus(id,status) {
  try{await db.collection(ORDERS_COL).doc(id).update({status});showToast('✅ আপডেট হয়েছে');loadAdminOrders();}
  catch(e){showToast('সমস্যা হয়েছে');}
}

async function loadAdminBorrows() {
  const el=document.getElementById('adminContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(BORROW_COL).orderBy('createdAt','desc').limit(50).get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><p>কোনো রেকর্ড নেই</p></div>`;return;}
    el.innerHTML=snap.docs.map(d=>{const b=d.data();
      const badge=b.status==='returned'?'badge-green':b.status==='approved'?'badge-blue':b.status==='rejected'?'badge-red':'badge-yellow';
      const label=b.status==='returned'?'ফেরত':b.status==='approved'?'ধার দেওয়া':b.status==='rejected'?'না':'অনুরোধ';
      return `<div class="history-item type-borrow">
        <div class="flex-between"><div class="history-title">📕 ${b.bookTitle}</div><span class="badge ${badge}">${label}</span></div>
        <div class="history-date">🔵 ${b.borrowerName} (${b.borrowerPhone})</div>
        <div class="history-date">🟢 ${b.ownerName} (${b.ownerPhone})</div>
        <div class="history-date">📅 ${b.fromDate} → ${b.toDate}</div>
      </div>`;
    }).join('');
  }catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function loadAdminUsers(search='') {
  const el=document.getElementById('adminContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(USERS_COL).orderBy('createdAt','desc').get();
    let users = snap.docs.map(d=>({id:d.id,...d.data()}));
    if(snap.empty){el.innerHTML=`<div class="empty-state"><p>কোনো ইউজার নেই</p></div>`;return;}
    el.innerHTML=`
      <div class="search-bar" style="margin-bottom:10px;">
        <span>🔍</span>
        <input type="text" id="userSearch" placeholder="নাম, নম্বর, গ্রাম, উপজেলা, জেলা..." 
          value="${search}" oninput="loadAdminUsers(this.value)">
      </div>
      <div id="userListArea"></div>`;
    
    const s = search.toLowerCase();
    if(s) {
      users = users.filter(u=>
        u.name?.toLowerCase().includes(s)||
        u.phone?.includes(s)||
        u.village?.toLowerCase().includes(s)||
        u.upazila?.toLowerCase().includes(s)||
        u.district?.toLowerCase().includes(s)
      );
    }
    
    const listEl = document.getElementById('userListArea');
    if(!listEl) return;
    listEl.innerHTML = `<div class="text-sm text-muted" style="margin-bottom:10px;">মোট: ${users.length} জন</div>`+
    users.map(u=>`<div class="history-item">
        <div class="history-title">👤 ${u.name}</div>
        <div class="history-date">📞 ${u.phone}</div>
        <div class="history-date">📍 ${u.village||''}, ${u.upazila||''}, ${u.district||''}</div>
        <div class="history-date">📅 ${formatDate(u.createdAt)}</div>
      </div>`).join('');
  }catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function loadAdminEbooks() {
  const el=document.getElementById('adminContent'); if(!el) return;
  el.innerHTML='<div class="text-muted text-sm">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(EBOOKS_COL).orderBy('createdAt','desc').get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><p>কোনো ই-বুক নেই</p></div>`;return;}
    el.innerHTML=snap.docs.map(d=>{const b=d.data();
      return `<div class="history-item">
        <div class="flex-between"><div class="history-title">📖 ${b.title}</div>
        <button class="btn-danger btn-sm" onclick="adminDelete('${EBOOKS_COL}','${d.id}','ebooks')">🗑️</button></div>
        <div class="history-date">✍️ ${b.author||''} · 👤 ${b.uploaderName}</div>
        <a href="${b.link}" target="_blank" class="text-sm" style="color:var(--primary);">🔗 লিংক দেখুন</a>
      </div>`;
    }).join('');
  }catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function adminDelete(col,id,tab) {
  if(!confirm('মুছে ফেলবেন?')) return;
  try{await db.collection(col).doc(id).delete();showToast('মুছে ফেলা হয়েছে');loadAdminTab(tab);}
  catch(e){showToast('সমস্যা হয়েছে');}
}

// ---- CSV DOWNLOAD ----
function showDownloadPanel() {
  const el=document.getElementById('adminContent');
  if(!el) return;
  el.innerHTML=`
    <div class="card" style="margin-bottom:12px;">
      <div style="font-weight:700;color:var(--primary-dark);margin-bottom:12px;">💾 ডেটা ব্যাকআপ (CSV)</div>
      <p class="text-sm text-muted" style="margin-bottom:14px;">যেকোনো সময় সব ডেটা Excel-এ ডাউনলোড করে রাখুন। অ্যাপ বন্ধ হলেও ডেটা থাকবে।</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn-primary" onclick="downloadCSV('users')">👥 সকল ইউজারের তালিকা</button>
        <button class="btn-primary" onclick="downloadCSV('ebooks')">📖 সকল ই-বুকের তালিকা</button>
        <button class="btn-primary" onclick="downloadCSV('personal')">🏡 ব্যক্তিগত লাইব্রেরি তালিকা</button>
        <button class="btn-primary" onclick="downloadCSV('orders')">📦 সকল অর্ডারের তালিকা</button>
        <button class="btn-primary" onclick="downloadCSV('borrows')">📚 সকল ধারের তালিকা</button>
        <button class="btn-accent" onclick="downloadAllCSV()" style="margin-top:4px;">⬇️ সব একসাথে ডাউনলোড করুন</button>
      </div>
    </div>`;
}

async function downloadCSV(colName) {
  showToast('ডাউনলোড হচ্ছে...');
  try {
    const snap = await db.collection(colName).get();
    if (snap.empty) { showToast('কোনো ডেটা নেই'); return; }

    const rows = snap.docs.map(d => d.data());
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${(r[h]||'').toString().replace(/"/g,'""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${colName}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast(`✅ ${snap.size}টি রেকর্ড ডাউনলোড হয়েছে`);
  } catch(e) { showToast('ডাউনলোড সমস্যা: '+e.message); }
}

async function downloadAllCSV() {
  const collections = ['users','ebooks','personal_books','orders','borrows'];
  for (const col of collections) {
    await downloadCSV(col);
    await new Promise(r => setTimeout(r, 800));
  }
}
