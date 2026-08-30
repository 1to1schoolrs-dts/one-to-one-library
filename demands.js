// ============================================
// পাঠকের চাহিদা — ই-বুক, উন্মুক্ত পাঠাগার, বই বিক্রয় — তিন ফিচারেই ব্যবহৃত
// feature: 'ebook' | 'personal' | 'bookshop'
// ============================================

function demandFeatureLabel(feature) {
  return feature==='ebook' ? 'ই-বুক' : feature==='personal' ? 'উন্মুক্ত পাঠাগার' : 'বই বিক্রয়';
}

function demandButtonsHTML(feature) {
  return `
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <button class="btn-accent btn-sm" style="flex:1;" onclick="showAddDemand('${feature}')">➕ চাহিদা যুক্ত করুন</button>
      <button class="btn-secondary btn-sm" style="flex:1;" onclick="showDemandsList('${feature}')">📢 পাঠকের চাহিদা</button>
    </div>
  `;
}

function showAddDemand(feature) {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">➕ চাহিদা যুক্ত করুন</div>
    <div style="background:#f0f9f4;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px;color:var(--primary-dark);">
      📚 ${demandFeatureLabel(feature)} ফিচারের জন্য চাহিদা
    </div>
    <div class="input-group"><label>বইয়ের নাম *</label><input type="text" id="demTitle" placeholder="যে বইটি খুঁজছেন"></div>
    <div class="input-group"><label>লেখকের নাম *</label><input type="text" id="demAuthor" placeholder="লেখকের নাম"></div>
    <div class="input-group"><label>অতিরিক্ত তথ্য (ঐচ্ছিক)</label><textarea id="demNote" placeholder="সংস্করণ, প্রকাশনী, বা যেকোনো তথ্য..."></textarea></div>
    <button class="btn-primary btn-full" onclick="submitDemand('${feature}')">📢 চাহিদা পাবলিশ করুন</button>
  `);
}

async function submitDemand(feature) {
  const title=document.getElementById('demTitle').value.trim();
  const author=document.getElementById('demAuthor').value.trim();
  const note=document.getElementById('demNote').value.trim();
  if(!title) return showToast('বইয়ের নাম দিন');
  if(!author) return showToast('লেখকের নাম দিন');
  try {
    await db.collection(DEMANDS_COL).add({
      feature, title, author, note,
      requesterPhone: currentUser.phone, requesterName: currentUser.name,
      status: 'open', createdAt: new Date().toISOString()
    });
    closeModal();
    showToast('✅ চাহিদা পাবলিশ হয়েছে!');
  } catch(e) { showToast('সমস্যা: '+e.message); }
}

async function showDemandsList(feature) {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📢 পাঠকের চাহিদা — ${demandFeatureLabel(feature)}</div>
    <div id="demandsListArea"><div class="text-muted text-sm">লোড হচ্ছে...</div></div>
  `);
  const el = document.getElementById('demandsListArea');
  try {
    const snap = await db.collection(DEMANDS_COL).where('feature','==',feature).get();
    const items = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if (!items.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📢</div><p>এখনো কোনো চাহিদা নেই</p></div>`;
      return;
    }
    el.innerHTML = items.map(d=>`
      <div class="history-item">
        <div class="flex-between">
          <div class="history-title">📖 ${d.title}</div>
          <span class="badge ${d.status==='fulfilled'?'badge-green':'badge-yellow'}">${d.status==='fulfilled'?'পূরণ হয়েছে':'খোঁজা হচ্ছে'}</span>
        </div>
        <div class="history-date">✍️ ${d.author}</div>
        ${d.note?`<div class="text-sm text-muted">${d.note}</div>`:''}
        <div class="history-date">👤 ${d.requesterName} · 📅 ${timeAgo(d.createdAt)}</div>
        ${d.requesterPhone===currentUser.phone&&d.status!=='fulfilled'?`<button class="btn-secondary btn-sm" style="margin-top:6px;" onclick="markDemandFulfilled('${d.id}','${feature}')">✅ পূরণ হয়েছে বলে চিহ্নিত করুন</button>`:''}
      </div>`).join('');
  } catch(e) { el.innerHTML = `<div class="empty-state"><p>লোড সমস্যা</p></div>`; }
}

async function markDemandFulfilled(demandId, feature) {
  try {
    await db.collection(DEMANDS_COL).doc(demandId).update({status:'fulfilled'});
    showToast('✅ চাহিদা পূরণ হয়েছে চিহ্নিত হলো');
    showDemandsList(feature);
  } catch(e) { showToast('সমস্যা হয়েছে'); }
}
