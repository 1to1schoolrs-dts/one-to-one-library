// ============================================
// NOTIFICATION SYSTEM
// ============================================
let unreadCount = 0;

// Send a notification to a user
async function sendNotif(toPhone, type, data) {
  try {
    await db.collection(NOTIF_COL).add({
      toPhone,
      type,
      ...data,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch(e) { console.error('Notif error:', e); }
}

// Load unread count and update bell
async function loadNotifCount() {
  try {
    const snap = await db.collection(NOTIF_COL)
      .where('toPhone', '==', currentUser.phone)
      .where('read', '==', false).get();
    unreadCount = snap.size;
    updateNotifBell();
  } catch(e) {}
}

function updateNotifBell() {
  const bell = document.getElementById('notifBell');
  const badge = document.getElementById('notifBadge');
  if (!bell) return;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// Show notification panel
async function showNotifications() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🔔 নোটিফিকেশন</div>
    <div id="notifList"><div class="text-muted text-sm">লোড হচ্ছে...</div></div>
  `);
  await loadNotifList();
}

async function loadNotifList() {
  const el = document.getElementById('notifList');
  if (!el) return;
  try {
    const snap = await db.collection(NOTIF_COL)
      .where('toPhone', '==', currentUser.phone)
      .get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!items.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><p>কোনো নোটিফিকেশন নেই</p></div>`;
      return;
    }

    // Mark all as read
    const batch = db.batch();
    items.filter(n => !n.read).forEach(n => {
      batch.update(db.collection(NOTIF_COL).doc(n.id), { read: true });
    });
    await batch.commit();
    unreadCount = 0;
    updateNotifBell();

    el.innerHTML = items.map(n => {
      const icon = notifIcon(n.type);
      const bg = n.read ? '' : 'background:#f0f9f4;';
      return `<div style="${bg}border-radius:8px;padding:12px;margin-bottom:8px;border:1px solid var(--border);" onclick="handleNotifAction('${n.id}','${n.type}','${n.relatedId||''}')">
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <div style="font-size:24px;">${icon}</div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:14px;">${n.title||''}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">${n.body||''}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${timeAgo(n.createdAt)}</div>
          </div>
          ${!n.read?`<span class="badge badge-green" style="font-size:10px;">নতুন</span>`:''}
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div class="empty-state"><p>লোড সমস্যা</p></div>`;
  }
}

function notifIcon(type) {
  const icons = {
    'borrow_request': '📚',
    'borrow_approved': '✅',
    'borrow_rejected': '❌',
    'borrow_returned': '📦',
    'purchase_order': '🛒',
    'purchase_confirmed': '✅',
    'purchase_cancelled': '❌',
    'bargain_offer': '💬',
    'bargain_counter': '💬',
    'bargain_accepted': '✅',
    'bargain_rejected': '❌',
  };
  return icons[type] || '🔔';
}

async function handleNotifAction(notifId, type, relatedId) {
  closeModal();
  // Navigate to relevant section
  if (type.startsWith('borrow')) navigate('personal');
  else if (type.startsWith('purchase') || type.startsWith('bargain')) navigate('bookshop');
}
