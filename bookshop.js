// ============================================
// বই বিক্রয় / ক্রয় ফিচার
// ============================================
const SHOP_COL = 'bookshop';
const SHOP_ORDERS_COL = 'shop_orders';
const LIBRARIES_COL = 'libraries';
const BARGAINS_COL = 'bargains';

let shopCurrentCat = 'সব ক্যাটাগরি';
let shopView = 'books'; // 'books' or 'libraries'
let shopCart = {}; // { libraryId: [{bookId, title, price, qty}] }

async function renderBookshop(container) {
  container.innerHTML = `
    <div class="page">
      <div class="section-header">
        <span class="section-title">🛍️ বই বিক্রয় / ক্রয়</span>
        <button class="btn-accent btn-sm" onclick="showAddLibrary()">+ বই বিক্রি করুন</button>
      </div>

      <!-- View Toggle -->
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button class="btn-primary btn-sm" id="svtab-books" onclick="switchShopView('books')">📚 সব বই</button>
        <button class="btn-secondary btn-sm" id="svtab-libraries" onclick="switchShopView('libraries')">🏪 লাইব্রেরি খুঁজুন</button>
        <button class="btn-secondary btn-sm" onclick="showMyShopOrders()">📦 আমার অর্ডার</button>
      </div>

      <!-- Category chips -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;" id="shopCatChips">
        ${CATEGORIES.map(c=>`<button class="cat-chip ${c==='সব ক্যাটাগরি'?'cat-chip-active':''}" onclick="shopSelectCat('${c}')" id="shopcat-${c}">${c}</button>`).join('')}
      </div>

      <!-- Search -->
      <div class="search-bar"><span>🔍</span>
        <input type="text" id="shopSearch" placeholder="বই, লেখক বা লাইব্রেরি খুঁজুন..." oninput="loadShopBooks()">
      </div>

      <!-- Cart indicator -->
      <div id="cartBar" style="display:none;"></div>

      <div id="shopContent"><div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div></div>
    </div>`;
  loadShopBooks();
}

function switchShopView(view) {
  shopView = view;
  ['books','libraries'].forEach(v=>{
    const b=document.getElementById('svtab-'+v);
    if(b) b.className=v===view?'btn-primary btn-sm':'btn-secondary btn-sm';
  });
  if (view==='libraries') loadLibraries();
  else loadShopBooks();
}

function shopSelectCat(cat) {
  shopCurrentCat = cat;
  document.querySelectorAll('#shopCatChips .cat-chip').forEach(c=>c.classList.remove('cat-chip-active'));
  const el=document.getElementById('shopcat-'+cat);
  if(el) el.classList.add('cat-chip-active');
  loadShopBooks();
}

// ---- SHOP BOOKS ----
async function loadShopBooks(libraryId=null) {
  const el=document.getElementById('shopContent');
  if(!el) return;
  el.innerHTML='<div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div>';
  try {
    const search=(document.getElementById('shopSearch')?.value||'').toLowerCase();
    let snap;
    if (libraryId) {
      snap = await db.collection(SHOP_COL).where('libraryId','==',libraryId).get();
    } else {
      snap = await db.collection(SHOP_COL).where('available','==',true).orderBy('createdAt','desc').get();
    }
    let books=snap.docs.map(d=>({id:d.id,...d.data()}));

    if(shopCurrentCat!=='সব ক্যাটাগরি') books=books.filter(b=>b.category===shopCurrentCat);
    if(search) books=books.filter(b=>b.title?.toLowerCase().includes(search)||b.author?.toLowerCase().includes(search)||b.libraryName?.toLowerCase().includes(search));

    // Sort by proximity
    books.sort((a,b)=>shopLocationScore(b)-shopLocationScore(a));

    if(!books.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><p>কোনো বই পাওয়া যায়নি</p></div>`;return;}

    el.innerHTML=books.map(b=>{
      const isMine=b.sellerPhone===currentUser.phone;
      const near=shopLocationScore(b)>0;
      const priceDiff=b.printPrice&&b.salePrice?Math.round((1-b.salePrice/b.printPrice)*100):0;
      return `<div class="book-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div class="book-card-title">📗 ${b.title}</div>
          ${b.bargainable?`<span class="badge badge-yellow">💬 বারগেইনেবল</span>`:`<span class="badge badge-blue">Fixed Price</span>`}
        </div>
        <div class="book-card-meta">
          ${b.author?`<span>✍️ ${b.author}</span>`:''}
          ${b.publisher?`<span>🏢 ${b.publisher}</span>`:''}
          ${b.category?`<span class="tag">${b.category}</span>`:''}
          <span>🏪 ${b.libraryName}</span>
          <span>📍 ${b.libraryUpazila||''}, ${b.libraryDistrict||''}</span>
          ${near?`<span class="badge badge-green">📍 কাছাকাছি</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin:8px 0;">
          ${b.printPrice?`<span style="font-size:12px;color:var(--text-muted);text-decoration:line-through;">৳${b.printPrice}</span>`:''}
          <span style="font-size:18px;font-weight:700;color:var(--primary);">৳${b.salePrice}</span>
          ${priceDiff>0?`<span class="badge badge-green">${priceDiff}% ছাড়</span>`:''}
          <span style="font-size:12px;color:var(--text-muted);">স্টক: ${b.stock||1}</span>
        </div>
        <div class="book-card-actions">
          ${!isMine?`
            <button class="btn-primary btn-sm" onclick="showBuyBook('${b.id}')">🛒 কিনুন</button>
            ${b.bargainable?`<button class="btn-secondary btn-sm" onclick="showBargain('${b.id}','${escHtml(b.title)}','${b.salePrice}','${b.sellerPhone}','${escHtml(b.libraryName)}')">💬 বারগেইন করুন</button>`:''}
            <button class="btn-secondary btn-sm" onclick="addToCart('${b.id}','${escHtml(b.title)}',${b.salePrice},'${b.libraryId}','${escHtml(b.libraryName)}','${b.sellerPhone}')">🧺 কার্টে যোগ</button>
          `:`<span class="badge badge-blue">আপনার বই</span>`}
        </div>
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা: ${e.message}</p></div>`;}
}

function shopLocationScore(book) {
  if (!currentUser) return 0;
  let score=0;
  if(book.libraryDistrict&&currentUser.district&&book.libraryDistrict.trim()===currentUser.district.trim()) score+=10;
  if(book.libraryUpazila&&currentUser.upazila&&book.libraryUpazila.trim()===currentUser.upazila.trim()) score+=20;
  return score;
}

// ---- LIBRARIES ----
async function loadLibraries() {
  const el=document.getElementById('shopContent');
  if(!el) return;
  el.innerHTML='<div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(LIBRARIES_COL).orderBy('createdAt','desc').get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><div class="empty-icon">🏪</div><p>কোনো লাইব্রেরি নেই</p></div>`;return;}
    
    // Group by district
    const grouped={};
    snap.docs.forEach(d=>{
      const l=d.data();
      const dist=l.district||'অন্যান্য';
      if(!grouped[dist]) grouped[dist]=[];
      grouped[dist].push({id:d.id,...l});
    });

    el.innerHTML=Object.entries(grouped).map(([dist,libs])=>`
      <div style="margin-bottom:16px;">
        <div style="font-weight:700;color:var(--primary-dark);font-size:14px;margin-bottom:8px;padding:6px 10px;background:#f0f9f4;border-radius:6px;">📍 ${dist} (${libs.length}টি)</div>
        ${libs.map(l=>`
          <div class="book-card" style="cursor:pointer;" onclick="loadShopBooks('${l.id}');switchShopView('books')">
            <div class="book-card-title">🏪 ${l.name}</div>
            <div class="book-card-meta">
              <span>📍 ${l.upazila||''}, ${l.district||''}</span>
              <span>📞 ${l.phone||''}</span>
            </div>
            ${l.address?`<div class="text-sm text-muted">${l.address}</div>`:''}
            <div class="book-card-actions">
              <button class="btn-primary btn-sm" onclick="event.stopPropagation();loadShopBooks('${l.id}');switchShopView('books')">📚 বই দেখুন</button>
              <a href="${buildWhatsAppLink(l.phone,`${l.name} লাইব্রেরি থেকে বই কিনতে চাই।`)}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;display:inline-block;" onclick="event.stopPropagation()">📱 যোগাযোগ</a>
            </div>
          </div>`).join('')}
      </div>`).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

// ---- ADD LIBRARY ----
async function showAddLibrary() {
  // Check if user already has a library
  const existing=await db.collection(LIBRARIES_COL).where('ownerPhone','==',currentUser.phone).get();
  if(!existing.empty) {
    const lib=existing.docs[0].data();
    showModal(`
      <span class="modal-close" onclick="closeModal()">✕</span>
      <div class="modal-title">🏪 ${lib.name}</div>
      <div class="card" style="margin-bottom:12px;">
        <div class="text-sm text-muted">আপনার লাইব্রেরি আছে। এখন বই যোগ করুন।</div>
      </div>
      <button class="btn-primary btn-full" onclick="closeModal();showAddShopBook('${existing.docs[0].id}','${escHtml(lib.name)}')">+ বই যোগ করুন</button>
      <button class="btn-secondary btn-full" style="margin-top:8px;" onclick="closeModal();loadShopBooks('${existing.docs[0].id}');switchShopView('books')">📚 আমার বইগুলো দেখুন</button>
    `);
    return;
  }

  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🏪 লাইব্রেরি নিবন্ধন</div>
    <div class="input-group"><label>লাইব্রেরির নাম *</label><input type="text" id="libName" placeholder="যেমন: বই বিচিত্রা"></div>
    <div class="input-group"><label>মালিকের নাম *</label><input type="text" id="libOwner" value="${currentUser.name}"></div>
    <div class="input-group"><label>ফোন নম্বর *</label><input type="tel" id="libPhone" value="${currentUser.phone}"></div>
    <div class="input-group"><label>লাইব্রেরির ঠিকানা *</label><input type="text" id="libAddress" placeholder="রাস্তা, এলাকা"></div>
    <div class="form-row">
      <div class="input-group"><label>উপজেলা *</label><input type="text" id="libUpazila" value="${currentUser.upazila||''}"></div>
      <div class="input-group"><label>জেলা *</label><input type="text" id="libDistrict" value="${currentUser.district||''}"></div>
    </div>
    <div class="input-group"><label>সংক্ষিপ্ত বিবরণ</label><textarea id="libDesc" placeholder="লাইব্রেরি সম্পর্কে লিখুন..."></textarea></div>
    <button class="btn-primary" onclick="submitLibrary()">লাইব্রেরি নিবন্ধন করুন</button>
  `);
}

async function submitLibrary() {
  const name=document.getElementById('libName').value.trim();
  const phone=document.getElementById('libPhone').value.trim();
  const address=document.getElementById('libAddress').value.trim();
  const upazila=document.getElementById('libUpazila').value.trim();
  const district=document.getElementById('libDistrict').value.trim();
  if(!name||!address||!upazila||!district) return showToast('সব তথ্য পূরণ করুন');
  try {
    const ref=await db.collection(LIBRARIES_COL).add({
      name,ownerName:document.getElementById('libOwner').value.trim(),
      phone,address,upazila,district,
      description:document.getElementById('libDesc').value.trim(),
      ownerPhone:currentUser.phone,createdAt:new Date().toISOString()
    });
    closeModal();showToast('✅ লাইব্রেরি নিবন্ধন হয়েছে!');
    setTimeout(()=>showAddShopBook(ref.id,name),400);
  } catch(e){showToast('সমস্যা হয়েছে');}
}

// ---- ADD SHOP BOOK ----
function showAddShopBook(libraryId, libraryName) {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📗 বই যোগ করুন</div>
    <div style="background:#f0f9f4;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px;color:var(--primary-dark);">🏪 ${libraryName}</div>
    <div class="input-group"><label>বইয়ের নাম *</label><input type="text" id="sbTitle" placeholder="বইয়ের নাম"></div>
    <div class="input-group"><label>লেখক</label><input type="text" id="sbAuthor" placeholder="লেখকের নাম"></div>
    <div class="input-group"><label>প্রকাশনী</label><input type="text" id="sbPublisher" placeholder="প্রকাশনীর নাম"></div>
    <div class="input-group"><label>ক্যাটাগরি *</label>
      <select id="sbCategory">${CATEGORIES.filter(c=>c!=='সব ক্যাটাগরি').map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
    <div class="form-row">
      <div class="input-group"><label>মুদ্রিত মূল্য (৳)</label><input type="number" id="sbPrintPrice" placeholder="০" min="0"></div>
      <div class="input-group"><label>বিক্রয় মূল্য (৳) *</label><input type="number" id="sbSalePrice" placeholder="০" min="0"></div>
    </div>
    <div class="form-row">
      <div class="input-group"><label>স্টক (কপি)</label><input type="number" id="sbStock" value="1" min="1"></div>
      <div class="input-group"><label>মূল্য ধরন *</label>
        <select id="sbBargainable">
          <option value="false">Fixed (নির্ধারিত)</option>
          <option value="true">Bargainable (বারগেইন করা যাবে)</option>
        </select></div>
    </div>
    <button class="btn-primary" onclick="submitShopBook('${libraryId}','${escHtml(libraryName)}')">বই যোগ করুন</button>
  `);
}

async function submitShopBook(libraryId, libraryName) {
  const title=document.getElementById('sbTitle').value.trim();
  const salePrice=Number(document.getElementById('sbSalePrice').value);
  if(!title) return showToast('বইয়ের নাম দিন');
  if(!salePrice) return showToast('বিক্রয় মূল্য দিন');

  // Get library info
  const libDoc=await db.collection(LIBRARIES_COL).doc(libraryId).get();
  const lib=libDoc.data();

  try {
    await db.collection(SHOP_COL).add({
      title,author:document.getElementById('sbAuthor').value.trim(),
      publisher:document.getElementById('sbPublisher').value.trim(),
      category:document.getElementById('sbCategory').value,
      printPrice:Number(document.getElementById('sbPrintPrice').value)||0,
      salePrice,
      stock:Number(document.getElementById('sbStock').value)||1,
      bargainable:document.getElementById('sbBargainable').value==='true',
      libraryId,libraryName,
      libraryUpazila:lib?.upazila||'',libraryDistrict:lib?.district||'',
      sellerPhone:currentUser.phone,sellerName:currentUser.name,
      available:true,createdAt:new Date().toISOString()
    });
    closeModal();showToast('✅ বই যোগ হয়েছে!');navigate('bookshop');
  } catch(e){showToast('সমস্যা হয়েছে: '+e.message);}
}

// ---- BUY BOOK ----
async function showBuyBook(bookId) {
  const doc=await db.collection(SHOP_COL).doc(bookId).get();
  const b=doc.data();
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🛒 বই কিনুন</div>
    <div class="card" style="margin-bottom:14px;background:#f0f9f4;">
      <div style="font-weight:600;">${b.title}</div>
      ${b.author?`<div class="text-sm text-muted">✍️ ${b.author}</div>`:''}
      <div style="font-size:18px;font-weight:700;color:var(--primary);margin-top:6px;">৳${b.salePrice} <span style="font-size:13px;color:var(--text-muted);">প্রতি কপি</span></div>
    </div>
    <div class="input-group"><label>কপির সংখ্যা</label>
      <input type="number" id="buyQty" value="1" min="1" max="${b.stock||1}" oninput="updateBuyTotal(${b.salePrice})"></div>
    <div class="card" style="margin-bottom:14px;">
      <div class="flex-between">
        <span>মোট মূল্য:</span>
        <span id="buyTotal" style="font-weight:700;color:var(--primary);font-size:18px;">৳${b.salePrice}</span>
      </div>
    </div>
    <div class="input-group"><label>ডেলিভারি ঠিকানা *</label>
      <textarea id="buyAddress">${currentUser.village||''}, ${currentUser.upazila||''}, ${currentUser.district||''}</textarea></div>
    <div class="input-group"><label>বিশেষ নির্দেশনা</label>
      <input type="text" id="buyNote" placeholder="কিছু জানাতে চাইলে লিখুন..."></div>
    <button class="btn-primary btn-full" onclick="confirmPurchase('${bookId}')">✅ অর্ডার কনফার্ম করুন</button>
  `);
}

function updateBuyTotal(price) {
  const qty=Number(document.getElementById('buyQty').value)||1;
  const el=document.getElementById('buyTotal');
  if(el) el.textContent=`৳${price*qty}`;
}

async function confirmPurchase(bookId) {
  const qty=Number(document.getElementById('buyQty').value)||1;
  const address=document.getElementById('buyAddress').value.trim();
  const note=document.getElementById('buyNote').value.trim();
  if(!address) return showToast('ঠিকানা দিন');

  const doc=await db.collection(SHOP_COL).doc(bookId).get();
  const b=doc.data();
  const total=b.salePrice*qty;
  const orderId='ORD-'+Date.now();

  try {
    await db.collection(SHOP_ORDERS_COL).add({
      orderId,bookId,
      bookTitle:b.title,author:b.author||'',
      libraryId:b.libraryId,libraryName:b.libraryName,
      sellerPhone:b.sellerPhone,sellerName:b.sellerName,
      buyerPhone:currentUser.phone,buyerName:currentUser.name,
      qty,unitPrice:b.salePrice,total,address,note,
      status:'pending',receiptDownloaded:false,
      createdAt:new Date().toISOString()
    });

    // Update stock
    const newStock=(b.stock||1)-qty;
    await db.collection(SHOP_COL).doc(bookId).update({
      stock:newStock, available:newStock>0
    });

    closeModal();
    showToast('✅ অর্ডার হয়েছে!');

    // Show receipt
    setTimeout(()=>showReceipt({
      orderId,bookTitle:b.title,libraryName:b.libraryName,
      qty,unitPrice:b.salePrice,total,address,
      buyerName:currentUser.name,buyerPhone:currentUser.phone,
      sellerPhone:b.sellerPhone,status:'pending'
    }),400);
  } catch(e){showToast('সমস্যা হয়েছে: '+e.message);}
}

// ---- BARGAIN ----
async function showBargain(bookId, bookTitle, currentPrice, sellerPhone, libraryName) {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">💬 বারগেইন করুন</div>
    <div class="card" style="margin-bottom:14px;">
      <div style="font-weight:600;">${bookTitle}</div>
      <div style="color:var(--primary);font-weight:700;margin-top:4px;">বর্তমান মূল্য: ৳${currentPrice}</div>
    </div>
    <div class="input-group"><label>আপনার প্রস্তাবিত মূল্য (৳)</label>
      <input type="number" id="bargainPrice" placeholder="আপনার দাম লিখুন" max="${currentPrice}"></div>
    <div class="input-group"><label>বার্তা (ঐচ্ছিক)</label>
      <textarea id="bargainMsg" placeholder="বিক্রেতাকে কিছু বলতে চাইলে..."></textarea></div>
    <button class="btn-primary btn-full" onclick="submitBargain('${bookId}','${escHtml(bookTitle)}','${currentPrice}','${sellerPhone}','${escHtml(libraryName)}')">💬 প্রস্তাব পাঠান</button>
  `);
}

async function submitBargain(bookId,bookTitle,currentPrice,sellerPhone,libraryName) {
  const price=document.getElementById('bargainPrice').value;
  const msg=document.getElementById('bargainMsg').value;
  if(!price) return showToast('মূল্য লিখুন');
  if(Number(price)>=Number(currentPrice)) return showToast('বর্তমান মূল্যের চেয়ে কম দিন');

  try {
    await db.collection(BARGAINS_COL).add({
      bookId,bookTitle,libraryName,
      currentPrice:Number(currentPrice),
      offeredPrice:Number(price),
      message:msg,
      buyerPhone:currentUser.phone,buyerName:currentUser.name,
      sellerPhone,status:'pending',
      createdAt:new Date().toISOString()
    });

    const waMsg=`💬 বারগেইন প্রস্তাব!\n\nবই: ${bookTitle}\nআপনার মূল্য: ৳${currentPrice}\nআমার প্রস্তাব: ৳${price}\n${msg?`বার্তা: ${msg}\n`:''}\nক্রেতা: ${currentUser.name}\nমোবাইল: ${currentUser.phone}`;

    closeModal();
    showToast('✅ প্রস্তাব পাঠানো হয়েছে!');
    setTimeout(()=>{
      showModal(`
        <span class="modal-close" onclick="closeModal()">✕</span>
        <div class="modal-title">📱 বিক্রেতাকে জানান</div>
        <a href="${buildWhatsAppLink(sellerPhone,waMsg)}" target="_blank" class="btn-primary" style="text-decoration:none;display:block;text-align:center;margin-bottom:8px;">📱 WhatsApp-এ প্রস্তাব পাঠান</a>
        <button class="btn-secondary btn-full" onclick="closeModal()">পরে করব</button>
      `);
    },300);
  } catch(e){showToast('সমস্যা হয়েছে');}
}

// ---- CART ----
function addToCart(bookId,bookTitle,price,libraryId,libraryName,sellerPhone) {
  if(!shopCart[libraryId]) shopCart[libraryId]={libraryName,sellerPhone,items:[]};
  const existing=shopCart[libraryId].items.find(i=>i.bookId===bookId);
  if(existing){existing.qty++;} else {shopCart[libraryId].items.push({bookId,bookTitle,price,qty:1});}
  updateCartBar();
  showToast(`✅ "${bookTitle}" কার্টে যোগ হয়েছে`);
}

function updateCartBar() {
  const el=document.getElementById('cartBar');
  if(!el) return;
  const totalItems=Object.values(shopCart).reduce((s,l)=>s+l.items.reduce((a,i)=>a+i.qty,0),0);
  if(totalItems===0){el.style.display='none';return;}
  const total=Object.values(shopCart).reduce((s,l)=>s+l.items.reduce((a,i)=>a+(i.price*i.qty),0),0);
  el.style.display='block';
  el.innerHTML=`<div style="background:var(--accent);border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <span style="color:#fff;font-weight:600;">🧺 কার্ট: ${totalItems}টি বই · ৳${total}</span>
    <button style="background:#fff;color:var(--primary);border:none;border-radius:6px;padding:5px 10px;font-weight:600;cursor:pointer;" onclick="showCart()">দেখুন →</button>
  </div>`;
}

function showCart() {
  if(!Object.keys(shopCart).length){showToast('কার্ট খালি');return;}
  let html=`<span class="modal-close" onclick="closeModal()">✕</span><div class="modal-title">🧺 আমার কার্ট</div>`;
  Object.entries(shopCart).forEach(([libId,lib])=>{
    const libTotal=lib.items.reduce((s,i)=>s+(i.price*i.qty),0);
    html+=`<div style="font-weight:700;color:var(--primary-dark);margin:12px 0 8px;">🏪 ${lib.libraryName}</div>`;
    lib.items.forEach(item=>{
      html+=`<div class="list-item">
        <div><div style="font-size:14px;font-weight:600;">📗 ${item.bookTitle}</div>
        <div class="text-sm text-muted">৳${item.price} × ${item.qty} = ৳${item.price*item.qty}</div></div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button onclick="changeCartQty('${libId}','${item.bookId}',-1)" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:#fff;cursor:pointer;font-size:16px;">-</button>
          <span style="font-weight:600;">${item.qty}</span>
          <button onclick="changeCartQty('${libId}','${item.bookId}',1)" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:#fff;cursor:pointer;font-size:16px;">+</button>
        </div>
      </div>`;
    });
    html+=`<button class="btn-primary btn-full" style="margin-top:8px;" onclick="checkoutLibrary('${libId}')">✅ ${lib.libraryName} থেকে অর্ডার করুন (৳${libTotal})</button><div class="divider"></div>`;
  });
  showModal(html);
}

function changeCartQty(libId,bookId,delta) {
  const item=shopCart[libId]?.items.find(i=>i.bookId===bookId);
  if(!item) return;
  item.qty+=delta;
  if(item.qty<=0) shopCart[libId].items=shopCart[libId].items.filter(i=>i.bookId!==bookId);
  if(!shopCart[libId].items.length) delete shopCart[libId];
  updateCartBar();
  showCart();
}

async function checkoutLibrary(libId) {
  const lib=shopCart[libId];
  if(!lib) return;
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">✅ অর্ডার কনফার্ম</div>
    <div style="font-weight:700;color:var(--primary-dark);margin-bottom:10px;">🏪 ${lib.libraryName}</div>
    ${lib.items.map(i=>`<div class="list-item"><span>📗 ${i.bookTitle}</span><span style="font-weight:600;">৳${i.price*i.qty}</span></div>`).join('')}
    <div class="card" style="margin:10px 0;"><div class="flex-between"><span>মোট:</span><span style="font-weight:700;color:var(--primary);font-size:18px;">৳${lib.items.reduce((s,i)=>s+(i.price*i.qty),0)}</span></div></div>
    <div class="input-group"><label>ডেলিভারি ঠিকানা *</label>
      <textarea id="cartAddress">${currentUser.village||''}, ${currentUser.upazila||''}, ${currentUser.district||''}</textarea></div>
    <div class="input-group"><label>বিশেষ নির্দেশনা</label>
      <input type="text" id="cartNote" placeholder="কিছু জানাতে চাইলে..."></div>
    <button class="btn-primary btn-full" onclick="submitCartOrder('${libId}')">🛒 অর্ডার দিন</button>
  `);
}

async function submitCartOrder(libId) {
  const lib=shopCart[libId];
  const address=document.getElementById('cartAddress').value.trim();
  const note=document.getElementById('cartNote').value.trim();
  if(!address) return showToast('ঠিকানা দিন');
  const total=lib.items.reduce((s,i)=>s+(i.price*i.qty),0);
  const orderId='ORD-'+Date.now();
  try {
    const orderData={
      orderId,libraryId:libId,libraryName:lib.libraryName,
      sellerPhone:lib.sellerPhone,
      buyerPhone:currentUser.phone,buyerName:currentUser.name,
      items:lib.items,total,address,note,
      status:'pending',receiptDownloaded:false,
      createdAt:new Date().toISOString()
    };
    await db.collection(SHOP_ORDERS_COL).add(orderData);
    delete shopCart[libId];
    updateCartBar();
    closeModal();showToast('✅ অর্ডার হয়েছে!');
    setTimeout(()=>showReceipt({...orderData,bookTitle:lib.items.map(i=>i.bookTitle).join(', ')}),400);
  } catch(e){showToast('সমস্যা হয়েছে');}
}

// ---- RECEIPT ----
function showReceipt(order) {
  const date=new Date().toLocaleDateString('bn-BD');
  const receiptHTML=`
    <div id="receiptContent" style="font-family:var(--font-main);padding:4px;">
      <div style="text-align:center;border-bottom:2px solid var(--primary);padding-bottom:10px;margin-bottom:12px;">
        <div style="font-size:20px;">📚</div>
        <div style="font-family:var(--font-serif);font-size:16px;font-weight:700;color:var(--primary);">ওয়ান টু ওয়ান লাইব্রেরি</div>
        <div style="font-size:12px;color:var(--text-muted);">ক্রয় রশিদ</div>
      </div>
      <div style="font-size:13px;margin-bottom:8px;"><b>অর্ডার নং:</b> ${order.orderId}</div>
      <div style="font-size:13px;margin-bottom:8px;"><b>তারিখ:</b> ${date}</div>
      <div style="font-size:13px;margin-bottom:8px;"><b>বই:</b> ${order.bookTitle}</div>
      <div style="font-size:13px;margin-bottom:8px;"><b>লাইব্রেরি:</b> ${order.libraryName}</div>
      <div style="font-size:13px;margin-bottom:8px;"><b>ক্রেতা:</b> ${order.buyerName} (${order.buyerPhone})</div>
      <div style="font-size:13px;margin-bottom:8px;"><b>ঠিকানা:</b> ${order.address}</div>
      <div style="border-top:1px dashed var(--border);margin:10px 0;padding-top:10px;">
        <div style="font-size:16px;font-weight:700;color:var(--primary);text-align:right;">মোট: ৳${order.total}</div>
      </div>
      <div style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:8px;">ধন্যবাদ আপনাকে! 📚</div>
    </div>`;

  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🧾 ক্রয় রশিদ</div>
    <div style="border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:14px;">
      ${receiptHTML}
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn-primary btn-sm" style="flex:1;" onclick="downloadReceipt('${order.orderId}')">⬇️ ডাউনলোড</button>
      <a href="${buildWhatsAppLink(order.sellerPhone,`আমি অর্ডার নং ${order.orderId} কনফার্ম করেছি। বই: ${order.bookTitle}। মোট: ৳${order.total}`)}" target="_blank" class="btn-secondary btn-sm" style="flex:1;text-decoration:none;text-align:center;display:block;">📱 বিক্রেতাকে জানান</a>
    </div>
  `);
}

function downloadReceipt(orderId) {
  const content=document.getElementById('receiptContent');
  if(!content){showToast('রশিদ পাওয়া যায়নি');return;}
  const printWin=window.open('','_blank');
  printWin.document.write(`<html><head><title>রশিদ - ${orderId}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto;}</style>
    </head><body>${content.innerHTML}<script>window.print();window.onafterprint=()=>window.close();</script></body></html>`);
  printWin.document.close();
  showToast('✅ রশিদ প্রিন্ট/ডাউনলোড হচ্ছে');
}

// ---- MY ORDERS ----
async function showMyShopOrders() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📦 আমার অর্ডার</div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <button class="btn-primary btn-sm" id="ord-buy" onclick="loadMyBuyOrders()">🛒 কিনেছি</button>
      <button class="btn-secondary btn-sm" id="ord-sell" onclick="loadMySellOrders()">🏪 বিক্রি করেছি</button>
    </div>
    <div id="myOrdersList"><div class="text-muted text-sm">লোড হচ্ছে...</div></div>
  `);
  loadMyBuyOrders();
}

async function loadMyBuyOrders() {
  document.getElementById('ord-buy').className='btn-primary btn-sm';
  document.getElementById('ord-sell').className='btn-secondary btn-sm';
  const el=document.getElementById('myOrdersList');
  if(!el) return;
  try {
    const snap=await db.collection(SHOP_ORDERS_COL).where('buyerPhone','==',currentUser.phone).orderBy('createdAt','desc').get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><p>কোনো ক্রয় নেই</p></div>`;return;}
    el.innerHTML=snap.docs.map(d=>{const o=d.data();
      return `<div class="history-item type-order">
        <div class="flex-between"><div class="history-title">📗 ${o.bookTitle||o.items?.map(i=>i.bookTitle).join(', ')||''}</div>
          <span class="badge ${o.status==='confirmed'?'badge-green':'badge-yellow'}">${o.status==='confirmed'?'নিশ্চিত':'অপেক্ষামান'}</span>
        </div>
        <div class="history-date">🏪 ${o.libraryName} · ৳${o.total}</div>
        <div class="history-date">📅 ${formatDate(o.createdAt)}</div>
        <button class="btn-secondary btn-sm" style="margin-top:6px;" onclick="showReceipt(${JSON.stringify(o).replace(/"/g,'&quot;')})">🧾 রশিদ দেখুন</button>
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function loadMySellOrders() {
  document.getElementById('ord-sell').className='btn-primary btn-sm';
  document.getElementById('ord-buy').className='btn-secondary btn-sm';
  const el=document.getElementById('myOrdersList');
  if(!el) return;
  try {
    const snap=await db.collection(SHOP_ORDERS_COL).where('sellerPhone','==',currentUser.phone).orderBy('createdAt','desc').get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><p>কোনো বিক্রয় নেই</p></div>`;return;}
    el.innerHTML=snap.docs.map(d=>{const o=d.data();
      return `<div class="history-item type-order">
        <div class="flex-between"><div class="history-title">📗 ${o.bookTitle||''}</div>
          <span class="badge ${o.status==='confirmed'?'badge-green':'badge-yellow'}">${o.status==='confirmed'?'নিশ্চিত':'অপেক্ষামান'}</span>
        </div>
        <div class="history-date">👤 ${o.buyerName} (${o.buyerPhone}) · ৳${o.total}</div>
        <div class="history-date">📍 ${o.address}</div>
        <div class="history-date">📅 ${formatDate(o.createdAt)}</div>
        ${o.status==='pending'?`<div style="display:flex;gap:6px;margin-top:8px;">
          <button class="btn-primary btn-sm" onclick="confirmSaleOrder('${d.id}','${o.buyerPhone}','${escHtml(o.bookTitle||'')}',${o.total})">✅ নিশ্চিত করুন</button>
          <a href="${buildWhatsAppLink(o.buyerPhone,`আপনার "${o.bookTitle||''}" অর্ডার (${o.orderId}) নিশ্চিত হয়েছে। মোট: ৳${o.total}। ধন্যবাদ!`)}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;display:inline-block;">📱 ক্রেতাকে জানান</a>
        </div>`:''}
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function confirmSaleOrder(orderId,buyerPhone,bookTitle,total) {
  try {
    await db.collection(SHOP_ORDERS_COL).doc(orderId).update({status:'confirmed'});
    showToast('✅ অর্ডার নিশ্চিত হয়েছে!');
    loadMySellOrders();
  } catch(e){showToast('সমস্যা হয়েছে');}
}
