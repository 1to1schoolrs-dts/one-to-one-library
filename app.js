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
  // Load admin-managed categories before rendering pages
  loadCategoriesFromDB().then(()=>{
    if (window.location.hash.includes('admin-')) navigate('admin');
    else navigate('home');
  });
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

// ============================================
// পিন hash করা — plain text সেভ হয় না, নিরাপত্তার জন্য
// ============================================
async function hashPin(pin) {
  const enc = new TextEncoder().encode(pin + 'lib-salt-2026'); // সাধারণ salt, রেইনবো টেবিল আক্রমণ ঠেকাতে
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

// ============================================
// ফাজি সার্চ — এক্সাক্ট ম্যাচ আগে, কাছাকাছি/ভুল বানানও পাওয়া যাবে
// ============================================
function normalizeSearchText(s) {
  return (s||'').toLowerCase().replace(/\s+/g,'').trim();
}

// text-এর মধ্যে query কতটা মেলে তার স্কোর — 0 মানে না মেলা, বেশি স্কোর মানে বেশি প্রাসঙ্গিক
function fuzzyScore(text, query) {
  const t = normalizeSearchText(text);
  const q = normalizeSearchText(query);
  if (!q) return 0;
  if (!t) return 0;
  if (t === q) return 100;           // পুরোপুরি মিলে গেলে
  if (t.startsWith(q)) return 80;    // শুরুতে মিলে
  if (t.includes(q)) return 60;      // মাঝে কোথাও মিলে
  // ভুল বানান/কাছাকাছি — কমন অক্ষরের অনুপাত মাপা হচ্ছে
  let common = 0;
  const tChars = t.split('');
  const qChars = q.split('');
  qChars.forEach(ch => {
    const idx = tChars.indexOf(ch);
    if (idx !== -1) { common++; tChars.splice(idx,1); }
  });
  const ratio = common / Math.max(q.length, 1);
  return ratio >= 0.6 ? Math.round(ratio*40) : 0; // যথেষ্ট কাছাকাছি হলেই দেখাবে
}

// একাধিক ফিল্ড জুড়ে সর্বোচ্চ স্কোর বের করা — যেমন title, author, uploaderName
function fuzzyScoreFields(fields, query) {
  return Math.max(0, ...fields.map(f=>fuzzyScore(f, query)));
}

// ============================================
// রশিদের জন্য প্রিন্ট / PDF / ছবি কপি বাটন
// contentId: রশিদের HTML যে div-এ আছে তার id
// ============================================
function receiptActionButtons(contentId) {
  return `
    <div style="display:flex;gap:8px;margin-top:4px;">
      <button class="btn-primary btn-sm" style="flex:1;" onclick="printReceiptEl('${contentId}')">🖨️ প্রিন্ট</button>
      <button class="btn-secondary btn-sm" style="flex:1;" onclick="downloadReceiptPDF('${contentId}')">📄 PDF</button>
      <button class="btn-secondary btn-sm" style="flex:1;" onclick="copyReceiptImage('${contentId}')">🖼️ কপি</button>
    </div>
  `;
}

function printReceiptEl(contentId) {
  const c = document.getElementById(contentId);
  if (!c) return showToast('রশিদ পাওয়া যায়নি');
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>রশিদ</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto;font-size:14px;line-height:1.8;}button{display:none;}</style>
    </head><body>${c.innerHTML}<script>window.print();window.onafterprint=()=>window.close();<\/script></body></html>`);
  w.document.close();
}

async function downloadReceiptPDF(contentId) {
  const c = document.getElementById(contentId);
  if (!c) return showToast('রশিদ পাওয়া যায়নি');
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    return showToast('PDF লোড হচ্ছে, একটু পর আবার চেষ্টা করুন');
  }
  showToast('PDF তৈরি হচ্ছে...');
  try {
    const canvas = await html2canvas(c, { scale: 2, backgroundColor: '#ffffff', ignoreElements: (el) => el.classList && el.classList.contains('no-capture') });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`রশিদ_${Date.now()}.pdf`);
    showToast('✅ PDF ডাউনলোড হয়েছে!');
  } catch (e) {
    showToast('PDF তৈরিতে সমস্যা হয়েছে');
  }
}

async function copyReceiptImage(contentId) {
  const c = document.getElementById(contentId);
  if (!c) return showToast('রশিদ পাওয়া যায়নি');
  if (typeof html2canvas === 'undefined') {
    return showToast('একটু পর আবার চেষ্টা করুন');
  }
  showToast('ছবি তৈরি হচ্ছে...');
  try {
    const canvas = await html2canvas(c, { scale: 2, backgroundColor: '#ffffff', ignoreElements: (el) => el.classList && el.classList.contains('no-capture') });
    canvas.toBlob(async (blob) => {
      let clipboardWorked = false;
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          clipboardWorked = true;
        }
      } catch (err) {
        clipboardWorked = false;
      }
      if (clipboardWorked) {
        // কিছু মোবাইল ব্রাউজারে কপি "সফল" দেখালেও আসলে কাজ নাও করতে পারে,
        // তাই স্পষ্ট নির্দেশনা দেওয়া হচ্ছে
        showToast('✅ কপি হয়েছে! WhatsApp/Messenger-এ পেস্ট (Long press → Paste) করুন। না হলে নিচের ফাইল ব্যবহার করুন 👇', 4500);
      }
      // নির্ভরযোগ্যতার জন্য সবসময় ছবিও ডাউনলোড করে রাখা হচ্ছে —
      // ক্লিপবোর্ড কাজ না করলেও ব্যবহারকারীর কাছে শেয়ার করার একটা নিশ্চিত উপায় থাকবে
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `রশিদ_${Date.now()}.png`;
      a.click(); URL.revokeObjectURL(url);
      if (!clipboardWorked) {
        showToast('✅ ছবি ডাউনলোড হয়েছে — Gallery থেকে WhatsApp/Messenger-এ শেয়ার করুন', 4000);
      }
    }, 'image/png');
  } catch (e) {
    showToast('ছবি তৈরিতে সমস্যা হয়েছে');
  }
}

window.addEventListener('load',async()=>{
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  setTimeout(async()=>{
    await initAuth();
    document.getElementById('splash').classList.add('hidden');
  },1500);
});
