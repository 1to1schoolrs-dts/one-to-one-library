// ============================================
// NOTIFICATION SYSTEM
// ============================================
let unreadCount = 0;

async function sendNotif(toPhone, type, data) {
  try {
    await db.collection(NOTIF_COL).add({
      toPhone, type, ...data,
      read: false, createdAt: new Date().toISOString()
    });
  } catch(e) { console.error('Notif:', e); }
}

async function loadNotifCount() {
  try {
    const snap = await db.collection(NOTIF_COL)
      .where('toPhone','==',currentUser.phone).where('read','==',false).get();
    unreadCount = snap.size;
    updateNotifBell();
  } catch(e) {}
}

function updateNotifBell() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

async function showNotifications() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🔔 নোটিফিকেশন
      <button onclick="deleteAllNotifs()" style="float:right;background:none;border:none;color:var(--danger);font-size:13px;cursor:pointer;font-weight:600;">সব মুছুন</button>
    </div>
    <div id="notifList"><div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div></div>
  `);
  await loadNotifList();
}

async function loadNotifList() {
  const el = document.getElementById('notifList');
  if (!el) return;
  try {
    const snap = await db.collection(NOTIF_COL)
      .where('toPhone','==',currentUser.phone).get();
    const items = snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

    if (!items.length) {
      el.innerHTML=`<div class="empty-state"><div class="empty-icon">🔔</div><p>কোনো নোটিফিকেশন নেই</p></div>`;
      return;
    }

    // Mark all as read
    const batch = db.batch();
    items.filter(n=>!n.read).forEach(n=>{
      batch.update(db.collection(NOTIF_COL).doc(n.id),{read:true});
    });
    await batch.commit();
    unreadCount = 0; updateNotifBell();

    el.innerHTML = items.map(n=>`
      <div style="background:${!n.read?'#f0f9f4':'#fff'};border-radius:8px;padding:12px;margin-bottom:8px;border:1px solid var(--border);">
        <div style="display:flex;gap:8px;align-items:flex-start;">
          <div style="font-size:22px;">${notifIcon(n.type)}</div>
          <div style="flex:1;cursor:pointer;" onclick="handleNotifAction('${n.type}','${n.relatedId||''}')">
            <div style="font-weight:600;font-size:14px;">${n.title||''}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">${n.body||''}</div>
            <div style="font-size:11px;color:var(--primary);margin-top:4px;font-weight:600;">→ ক্লিক করে দেখুন</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${timeAgo(n.createdAt)}</div>
          </div>
          <button onclick="deleteNotif('${n.id}')" style="background:none;border:none;color:var(--danger);font-size:18px;cursor:pointer;padding:0 4px;" title="মুছুন">🗑️</button>
        </div>
      </div>`).join('');
  } catch(e) {
    el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;
  }
}

async function deleteNotif(notifId) {
  try {
    await db.collection(NOTIF_COL).doc(notifId).delete();
    showToast('মুছে ফেলা হয়েছে');
    loadNotifList();
  } catch(e) { showToast('সমস্যা হয়েছে'); }
}

async function deleteAllNotifs() {
  if (!confirm('সব নোটিফিকেশন মুছে ফেলবেন?')) return;
  try {
    const snap = await db.collection(NOTIF_COL).where('toPhone','==',currentUser.phone).get();
    const batch = db.batch();
    snap.docs.forEach(d=>batch.delete(d.ref));
    await batch.commit();
    unreadCount = 0; updateNotifBell();
    showToast('✅ সব মুছে ফেলা হয়েছে');
    loadNotifList();
  } catch(e) { showToast('সমস্যা হয়েছে'); }
}

function notifIcon(type) {
  const m={
    'borrow_request':'📚','borrow_approved':'✅','borrow_rejected':'❌',
    'borrow_returned':'📦','return_request':'🔄',
    'purchase_order':'🛒','purchase_confirmed':'✅','purchase_cancelled':'❌',
    'bargain_offer':'💬','bargain_counter':'💬','bargain_accepted':'✅','bargain_rejected':'❌',
    'complaint_reply':'📩','complaint_new':'⚠️'
  };
  return m[type]||'🔔';
}

async function handleNotifAction(type, relatedId) {
  closeModal();

  switch(type) {
    case 'borrow_request':
      // মালিক → সেই বইয়ের পরিচালনা খুলবে
      try {
        const bdoc = await db.collection(BORROW_COL).doc(relatedId).get();
        if (bdoc.exists) {
          navigate('personal');
          setTimeout(()=>showMyBookDetail(bdoc.data().bookId), 700);
        } else navigate('personal');
      } catch(e) { navigate('personal'); }
      break;

    case 'return_request':
      // মালিক → সেই বইয়ের পরিচালনা খুলবে
      try {
        const bdoc = await db.collection(BORROW_COL).doc(relatedId).get();
        if (bdoc.exists) {
          navigate('personal');
          setTimeout(()=>showMyBookDetail(bdoc.data().bookId), 700);
        } else navigate('personal');
      } catch(e) { navigate('personal'); }
      break;

    case 'borrow_approved':
    case 'borrow_rejected':
    case 'borrow_returned':
      // ধার চাওয়া ব্যক্তি → ড্যাশবোর্ড ধার ট্যাব
      navigate('dashboard');
      setTimeout(()=>loadDashTab('borrows'), 700);
      break;

    case 'purchase_order':
      // বিক্রেতা → বিক্রয় অর্ডার প্যানেল
      navigate('bookshop');
      setTimeout(()=>{ showMyShopOrders(); setTimeout(()=>loadMySellOrders(),400); }, 700);
      break;

    case 'purchase_confirmed':
    case 'purchase_cancelled':
      // ক্রেতা → ক্রয় অর্ডার
      navigate('bookshop');
      setTimeout(()=>showMyShopOrders(), 700);
      break;

    case 'bargain_offer':
    case 'bargain_counter':
      // বারগেইন বিস্তারিত — পাল্টা প্রস্তাব বা সম্মত/না
      navigate('bookshop');
      setTimeout(()=>showBargainDetail(relatedId), 700);
      break;

    case 'bargain_accepted':
    case 'bargain_rejected':
      navigate('bookshop');
      setTimeout(()=>{ showMyShopOrders(); setTimeout(()=>loadMyBargainsList(),400); }, 700);
      break;

    case 'complaint_reply':
    case 'complaint_new':
      navigate('dashboard');
      setTimeout(()=>loadDashTab('complaints'), 700);
      break;
  }
}
