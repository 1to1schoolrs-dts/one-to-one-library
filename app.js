let currentPage = 'home';
let pageHistory = [];

function showApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('splash').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('userGreeting').textContent = currentUser?.name?.split(' ')[0]||'';
  // Load notification count
  loadNotifCount();
  // Refresh notif count every 30 seconds
  setInterval(loadNotifCount, 30000);
  if (window.location.hash.includes('admin-')) navigate('admin');
  else navigate('home');
}

function navigate(page, addHistory=true) {
  if (addHistory && currentPage!==page) pageHistory.push(currentPage);
  currentPage = page;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const nb=document.getElementById('nav-'+page);
  if(nb) nb.classList.add('active');
  updateBackButton();
  const c=document.getElementById('mainContent');
  switch(page) {
    case 'home':      renderHome(c); break;
    case 'ebook':     renderEbook(c); break;
    case 'bookshop':  renderBookshop(c); break;
    case 'personal':  renderPersonal(c); break;
    case 'dashboard': renderDashboard(c); break;
    case 'admin':     renderAdmin(c); break;
  }
}

function updateBackButton() {
  const ex=document.getElementById('backBtn'); if(ex) ex.remove();
  if(pageHistory.length>0 && currentPage!=='home') {
    const btn=document.createElement('button');
    btn.id='backBtn'; btn.innerHTML='← ফিরে যান'; btn.onclick=goBack;
    btn.style.cssText=`position:fixed;top:58px;left:0;right:0;z-index:40;background:#f0f9f4;border:none;border-bottom:1px solid #e0d8cc;padding:8px 16px;font-family:var(--font-main);font-size:13px;color:var(--primary);text-align:left;cursor:pointer;font-weight:600;`;
    document.getElementById('app').appendChild(btn);
    document.getElementById('mainContent').style.paddingTop='calc(58px + 34px)';
  } else {
    document.getElementById('mainContent').style.paddingTop='58px';
  }
}

function goBack() {
  if(pageHistory.length>0){const p=pageHistory.pop();navigate(p,false);}
}

function showModal(html) {
  document.getElementById('modalBox').innerHTML=html;
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal(e) {
  if(e&&e.target!==document.getElementById('modal')) return;
  document.getElementById('modal').classList.add('hidden');
}
function showToast(msg,duration=2800) {
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'),duration);
}
function formatDate(iso) {
  if(!iso) return '';
  const d=new Date(iso);
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}
function timeAgo(iso) {
  const diff=Date.now()-new Date(iso).getTime();
  const mins=Math.floor(diff/60000);
  if(mins<1) return 'এইমাত্র';
  if(mins<60) return `${mins} মিনিট আগে`;
  const hrs=Math.floor(mins/60);
  if(hrs<24) return `${hrs} ঘণ্টা আগে`;
  return `${Math.floor(hrs/24)} দিন আগে`;
}
async function getSettings() {
  try{const d=await db.collection(SETTINGS_COL).doc('config').get();if(d.exists)return d.data();}catch(e){}
  return {whatsapp:'01521256504',fbPage:'',adminPass:'admin123'};
}
function buildWhatsAppLink(phone,msg) {
  return `https://wa.me/${phone.replace(/^0/,'880')}?text=${encodeURIComponent(msg)}`;
}
function escHtml(str) {
  return (str||'').replace(/'/g,"\\'").replace(/"/g,'&quot;');
}
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(()=>showToast('✅ কপি হয়েছে!')).catch(()=>{
    const el=document.createElement('textarea');el.value=text;document.body.appendChild(el);
    el.select();document.execCommand('copy');document.body.removeChild(el);showToast('✅ কপি হয়েছে!');
  });
}

window.addEventListener('load',async()=>{
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  setTimeout(async()=>{
    await initAuth();
    document.getElementById('splash').classList.add('hidden');
  },1500);
});
