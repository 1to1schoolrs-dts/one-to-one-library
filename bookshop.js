// ============================================
// বই বিক্রয় / ক্রয় ফিচার
// ============================================
const SHOP_COL = 'bookshop';
const SHOP_ORDERS_COL = 'shop_orders';
const LIBRARIES_COL = 'libraries';
const BARGAINS_COL = 'bargains';

let shopCurrentCat = 'সব ক্যাটাগরি';
let shopView = 'books';
let shopCart = {};
let userLibrary = null; // cache করা লাইব্রেরি

async function renderBookshop(container) {
  // Check if user has library
  await checkUserLibrary();

  container.innerHTML = `
    <div class="page">
      <div class="section-header">
        <span class="section-title">🛍️ বই বিক্রয় / ক্রয়</span>
        <button class="btn-accent btn-sm" id="shopTopBtn" onclick="${userLibrary ? `showAddShopBook('${userLibrary.id}','${escHtml(userLibrary.name)}')` : 'showAddLibrary()'}">
          ${userLibrary ? '+ নতুন বই যোগ' : '+ বই বিক্রি করুন'}
        </button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <button class="btn-primary btn-sm" id="svtab-books" onclick="switchShopView('books')">📚 সব বই</button>
        <button class="btn-secondary btn-sm" id="svtab-libraries" onclick="switchShopView('libraries')">🏪 লাইব্রেরি</button>
        <button class="btn-secondary btn-sm" onclick="showMyShopOrders()">📦 আমার অর্ডার</button>
        ${userLibrary ? `<button class="btn-secondary btn-sm" onclick="showMyLibraryBooks()">🏪 আমার বই</button>` : ''}
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;" id="shopCatChips">
        ${CATEGORIES.map(c=>`<button class="cat-chip ${c==='সব ক্যাটাগরি'?'cat-chip-active':''}" onclick="shopSelectCat('${c}')" id="shopcat-${c}">${c}</button>`).join('')}
      </div>

      <div class="search-bar"><span>🔍</span>
        <input type="text" id="shopSearch" placeholder="বই, লেখক বা লাইব্রেরি খুঁজুন..." oninput="loadShopBooks()">
      </div>

      <div id="cartBar"></div>
      <div id="shopContent"><div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div></div>
    </div>`;
  loadShopBooks();
}

async function checkUserLibrary() {
  try {
    const snap = await db.collection(LIBRARIES_COL).where('ownerPhone','==',currentUser.phone).get();
    userLibrary = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch(e) { userLibrary = null; }
}

function switchShopView(view) {
  shopView = view;
  ['books','libraries'].forEach(v=>{
    const b=document.getElementById('svtab-'+v);
    if(b) b.className=v===view?'btn-primary btn-sm':'btn-secondary btn-sm';
  });
  if(view==='libraries') loadLibraries();
  else loadShopBooks();
}

function shopSelectCat(cat) {
  shopCurrentCat = cat;
  document.querySelectorAll('#shopCatChips .cat-chip').forEach(c=>c.classList.remove('cat-chip-active'));
  const el=document.getElementById('shopcat-'+cat);
  if(el) el.classList.add('cat-chip-active');
  loadShopBooks();
}

async function loadShopBooks(libraryId=null) {
  const el=document.getElementById('shopContent');
  if(!el) return;
  el.innerHTML='<div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div>';
  try {
    const search=(document.getElementById('shopSearch')?.value||'').toLowerCase();
    // No orderBy to avoid index requirement
    const snap = libraryId
      ? await db.collection(SHOP_COL).where('libraryId','==',libraryId).get()
      : await db.collection(SHOP_COL).where('available','==',true).get();

    let books = snap.docs.map(d=>({id:d.id,...d.data()}));

    // Sort by createdAt descending in JS
    books.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

    if(shopCurrentCat!=='সব ক্যাটাগরি') books=books.filter(b=>b.category===shopCurrentCat);
    if(search) books=books.filter(b=>
      b.title?.toLowerCase().includes(search)||
      b.author?.toLowerCase().includes(search)||
      b.libraryName?.toLowerCase().includes(search)
    );

    // Sort by proximity
    books.sort((a,b)=>shopLocationScore(b)-shopLocationScore(a));

    if(!books.length){
      el.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><p>${libraryId?'এই লাইব্রেরিতে কোনো বই নেই':'কোনো বই পাওয়া যায়নি'}</p></div>`;
      return;
    }

    el.innerHTML=books.map(b=>{
      const isMine=b.sellerPhone===currentUser.phone;
      const near=shopLocationScore(b)>0;
      const priceDiff=b.printPrice&&b.salePrice?Math.round((1-b.salePrice/b.printPrice)*100):0;
      return `<div class="book-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div class="book-card-title">📗 ${b.title}</div>
          ${b.bargainable?`<span class="badge badge-yellow">💬 বারগেইন</span>`:`<span class="badge badge-blue">Fixed</span>`}
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
            ${b.bargainable?`<button class="btn-secondary btn-sm" onclick="showBargain('${b.id}','${escHtml(b.title)}','${b.salePrice}','${b.sellerPhone}','${escHtml(b.libraryName)}')">💬 বারগেইন</button>`:''}
            <button class="btn-secondary btn-sm" onclick="addToCart('${b.id}','${escHtml(b.title)}',${b.salePrice},'${b.libraryId}','${escHtml(b.libraryName)}','${b.sellerPhone}')">🧺 কার্ট</button>
          `:`<span class="badge badge-blue">আপনার বই</span>
            <button class="btn-danger btn-sm" onclick="deleteShopBook('${b.id}')">🗑️</button>`}
        </div>
      </div>`;
    }).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা: ${e.message}</p></div>`;}
}

async function deleteShopBook(id) {
  if(!confirm('বইটি মুছে ফেলবেন?')) return;
  try{ await db.collection(SHOP_COL).doc(id).delete(); showToast('মুছে ফেলা হয়েছে'); navigate('bookshop'); }
  catch(e){ showToast('সমস্যা হয়েছে'); }
}

function shopLocationScore(book) {
  if(!currentUser) return 0;
  let score=0;
  if(book.libraryDistrict&&currentUser.district&&book.libraryDistrict.trim()===currentUser.district.trim()) score+=10;
  if(book.libraryUpazila&&currentUser.upazila&&book.libraryUpazila.trim()===currentUser.upazila.trim()) score+=20;
  return score;
}

async function loadLibraries() {
  const el=document.getElementById('shopContent');
  if(!el) return;
  el.innerHTML='<div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div>';
  try {
    const snap=await db.collection(LIBRARIES_COL).get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><div class="empty-icon">🏪</div><p>কোনো লাইব্রেরি নেই</p></div>`;return;}
    const grouped={};
    snap.docs.forEach(d=>{
      const l=d.data(); const dist=l.district||'অন্যান্য';
      if(!grouped[dist]) grouped[dist]=[];
      grouped[dist].push({id:d.id,...l});
    });
    el.innerHTML=Object.entries(grouped).map(([dist,libs])=>`
      <div style="margin-bottom:16px;">
        <div style="font-weight:700;color:var(--primary-dark);font-size:14px;margin-bottom:8px;padding:6px 10px;background:#f0f9f4;border-radius:6px;">📍 ${dist} (${libs.length}টি)</div>
        ${libs.map(l=>`<div class="book-card">
          <div class="book-card-title">🏪 ${l.name}</div>
          <div class="book-card-meta">
            <span>📍 ${l.upazila||''}, ${l.district||''}</span>
            <span>📞 ${l.phone||''}</span>
          </div>
          ${l.address?`<div class="text-sm text-muted">${l.address}</div>`:''}
          <div class="book-card-actions">
            <button class="btn-primary btn-sm" onclick="loadShopBooks('${l.id}');switchShopView('books')">📚 বই দেখুন</button>
            <a href="${buildWhatsAppLink(l.phone,`${l.name} লাইব্রেরি থেকে বই কিনতে চাই।`)}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;display:inline-block;">📱 যোগাযোগ</a>
          </div>
        </div>`).join('')}
      </div>`).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function showMyLibraryBooks() {
  if(!userLibrary) return showToast('আপনার লাইব্রেরি নেই');
  loadShopBooks(userLibrary.id);
  document.getElementById('shopContent').scrollIntoView();
}

async function showAddLibrary() {
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
    <div class="input-group"><label>সংক্ষিপ্ত বিবরণ</label><textarea id="libDesc" placeholder="লাইব্রেরি সম্পর্কে..."></textarea></div>
    <button class="btn-primary" onclick="submitLibrary()">নিবন্ধন করুন</button>
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
      name, ownerName:document.getElementById('libOwner').value.trim(),
      phone, address, upazila, district,
      description:document.getElementById('libDesc').value.trim(),
      ownerPhone:currentUser.phone, createdAt:new Date().toISOString()
    });
    userLibrary={id:ref.id,name,ownerPhone:currentUser.phone,phone,upazila,district};
    closeModal(); showToast('✅ লাইব্রেরি নিবন্ধন হয়েছে!');
    setTimeout(()=>showAddShopBook(ref.id,name),400);
  } catch(e){showToast('সমস্যা হয়েছে: '+e.message);}
}

function showAddShopBook(libraryId, libraryName) {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📗 বই যোগ করুন</div>
    <div style="background:#f0f9f4;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px;color:var(--primary-dark);">🏪 ${libraryName}</div>
    <div class="input-group"><label>বইয়ের নাম *</label><input type="text" id="sbTitle" placeholder="বইয়ের নাম"></div>
    <div class="input-group"><label>লেখক *</label><input type="text" id="sbAuthor" placeholder="লেখকের নাম"></div>
    <div class="input-group"><label>প্রকাশনী</label><input type="text" id="sbPublisher" placeholder="প্রকাশনীর নাম"></div>
    <div class="input-group"><label>ক্যাটাগরি *</label>
      <select id="sbCategory">${CATEGORIES.filter(c=>c!=='সব ক্যাটাগরি').map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
    <div class="input-group"><label>বই সম্পর্কে সংক্ষেপে লিখুন *</label>
      <textarea id="sbDesc" placeholder="বইয়ের বিষয়বস্তু, সংস্করণ ইত্যাদি..."></textarea></div>
    <div class="form-row">
      <div class="input-group"><label>মুদ্রিত মূল্য (৳)</label><input type="number" id="sbPrintPrice" placeholder="০" min="0"></div>
      <div class="input-group"><label>বিক্রয় মূল্য (৳) *</label><input type="number" id="sbSalePrice" placeholder="০" min="0"></div>
    </div>
    <div class="form-row">
      <div class="input-group"><label>স্টক (কপি)</label><input type="number" id="sbStock" value="1" min="1"></div>
      <div class="input-group"><label>মূল্য ধরন *</label>
        <select id="sbBargainable">
          <option value="false">Fixed মূল্য</option>
          <option value="true">Bargainable</option>
        </select></div>
    </div>
    <button class="btn-primary" onclick="submitShopBook('${libraryId}','${escHtml(libraryName)}')">বই যোগ করুন</button>
  `);
}

async function submitShopBook(libraryId, libraryName) {
  const title=document.getElementById('sbTitle').value.trim();
  const author=document.getElementById('sbAuthor').value.trim();
  const desc=document.getElementById('sbDesc').value.trim();
  const salePrice=Number(document.getElementById('sbSalePrice').value);
  if(!title) return showToast('বইয়ের নাম দিন');
  if(!author) return showToast('লেখকের নাম দিন');
  if(!desc) return showToast('বই সম্পর্কে লিখুন');
  if(!salePrice) return showToast('বিক্রয় মূল্য দিন');

  const libDoc=await db.collection(LIBRARIES_COL).doc(libraryId).get();
  const lib=libDoc.data();
  try {
    await db.collection(SHOP_COL).add({
      title, author,
      publisher:document.getElementById('sbPublisher').value.trim(),
      category:document.getElementById('sbCategory').value,
      description:desc,
      printPrice:Number(document.getElementById('sbPrintPrice').value)||0,
      salePrice,
      stock:Number(document.getElementById('sbStock').value)||1,
      bargainable:document.getElementById('sbBargainable').value==='true',
      libraryId, libraryName,
      libraryUpazila:lib?.upazila||'',
      libraryDistrict:lib?.district||'',
      sellerPhone:currentUser.phone,
      sellerName:currentUser.name,
      available:true,
      createdAt:new Date().toISOString()
    });
    closeModal(); showToast('✅ বই যোগ হয়েছে!'); navigate('bookshop');
  } catch(e){showToast('সমস্যা হয়েছে: '+e.message);}
}

async function showBuyBook(bookId) {
  const doc=await db.collection(SHOP_COL).doc(bookId).get();
  const b=doc.data();
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🛒 বই কিনুন</div>
    <div class="card" style="margin-bottom:14px;background:#f0f9f4;">
      <div style="font-weight:600;">${b.title}</div>
      ${b.author?`<div class="text-sm text-muted">✍️ ${b.author}</div>`:''}
      ${b.description?`<div class="text-sm text-muted" style="margin-top:4px;">${b.description}</div>`:''}
      <div style="font-size:18px;font-weight:700;color:var(--primary);margin-top:6px;">৳${b.salePrice} <span style="font-size:13px;color:var(--text-muted);">প্রতি কপি</span></div>
    </div>
    <div class="input-group"><label>কপির সংখ্যা</label>
      <input type="number" id="buyQty" value="1" min="1" max="${b.stock||1}" oninput="updateBuyTotal(${b.salePrice})"></div>
    <div class="card" style="margin-bottom:14px;">
      <div class="flex-between"><span>মোট মূল্য:</span>
        <span id="buyTotal" style="font-weight:700;color:var(--primary);font-size:18px;">৳${b.salePrice}</span>
      </div>
    </div>
    <div class="input-group"><label>ডেলিভারি ঠিকানা *</label>
      <textarea id="buyAddress">${currentUser.village||''}, ${currentUser.upazila||''}, ${currentUser.district||''}</textarea></div>
    <div class="input-group"><label>বিশেষ নির্দেশনা</label>
      <input type="text" id="buyNote" placeholder="কিছু জানাতে চাইলে..."></div>
    <button class="btn-primary btn-full" onclick="confirmPurchase('${bookId}')">✅ অর্ডার কনফার্ম</button>
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
    const orderData={
      orderId, bookId, bookTitle:b.title, author:b.author||'',
      libraryId:b.libraryId, libraryName:b.libraryName,
      sellerPhone:b.sellerPhone, sellerName:b.sellerName,
      buyerPhone:currentUser.phone, buyerName:currentUser.name,
      qty, unitPrice:b.salePrice, total, address, note,
      status:'pending', createdAt:new Date().toISOString()
    };
    await db.collection(SHOP_ORDERS_COL).add(orderData);
    const newStock=(b.stock||1)-qty;
    await db.collection(SHOP_COL).doc(bookId).update({stock:newStock,available:newStock>0});
    closeModal(); showToast('✅ অর্ডার হয়েছে!');
    setTimeout(()=>showReceipt(orderData),400);
  } catch(e){showToast('সমস্যা হয়েছে: '+e.message);}
}

async function showBargain(bookId,bookTitle,currentPrice,sellerPhone,libraryName) {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">💬 বারগেইন করুন</div>
    <div class="card" style="margin-bottom:14px;">
      <div style="font-weight:600;">${bookTitle}</div>
      <div style="color:var(--primary);font-weight:700;margin-top:4px;">বর্তমান মূল্য: ৳${currentPrice}</div>
    </div>
    <div class="input-group"><label>আপনার প্রস্তাবিত মূল্য (৳) *</label>
      <input type="number" id="bargainPrice" placeholder="আপনার দাম" max="${currentPrice}"></div>
    <div class="input-group"><label>বার্তা</label>
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
      currentPrice:Number(currentPrice),offeredPrice:Number(price),
      message:msg,buyerPhone:currentUser.phone,buyerName:currentUser.name,
      sellerPhone,status:'pending',createdAt:new Date().toISOString()
    });
    const waMsg=`💬 বারগেইন প্রস্তাব!\n\nবই: ${bookTitle}\nআপনার মূল্য: ৳${currentPrice}\nআমার প্রস্তাব: ৳${price}\n${msg?`বার্তা: ${msg}\n`:''}\nক্রেতা: ${currentUser.name} (${currentUser.phone})`;
    closeModal(); showToast('✅ প্রস্তাব পাঠানো হয়েছে!');
    setTimeout(()=>showModal(`
      <span class="modal-close" onclick="closeModal()">✕</span>
      <div class="modal-title">📱 বিক্রেতাকে জানান</div>
      <a href="${buildWhatsAppLink(sellerPhone,waMsg)}" target="_blank" class="btn-primary" style="text-decoration:none;display:block;text-align:center;margin-bottom:8px;">📱 WhatsApp-এ পাঠান</a>
      <button class="btn-secondary btn-full" onclick="closeModal()">পরে করব</button>
    `),300);
  } catch(e){showToast('সমস্যা হয়েছে');}
}

function addToCart(bookId,bookTitle,price,libraryId,libraryName,sellerPhone) {
  if(!shopCart[libraryId]) shopCart[libraryId]={libraryName,sellerPhone,items:[]};
  const ex=shopCart[libraryId].items.find(i=>i.bookId===bookId);
  if(ex){ex.qty++;}else{shopCart[libraryId].items.push({bookId,bookTitle,price,qty:1});}
  updateCartBar();
  showToast(`✅ কার্টে যোগ হয়েছে`);
}

function updateCartBar() {
  const el=document.getElementById('cartBar');
  if(!el) return;
  const total=Object.values(shopCart).reduce((s,l)=>s+l.items.reduce((a,i)=>a+(i.price*i.qty),0),0);
  const count=Object.values(shopCart).reduce((s,l)=>s+l.items.reduce((a,i)=>a+i.qty,0),0);
  if(!count){el.innerHTML='';return;}
  el.innerHTML=`<div style="background:var(--accent);border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <span style="color:#fff;font-weight:600;">🧺 ${count}টি বই · ৳${total}</span>
    <button style="background:#fff;color:var(--primary);border:none;border-radius:6px;padding:5px 10px;font-weight:600;cursor:pointer;" onclick="showCart()">কার্ট →</button>
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
        <div class="text-sm text-muted">৳${item.price}×${item.qty}=৳${item.price*item.qty}</div></div>
        <div style="display:flex;gap:4px;align-items:center;">
          <button onclick="changeCartQty('${libId}','${item.bookId}',-1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:#fff;cursor:pointer;">-</button>
          <span style="font-weight:600;min-width:16px;text-align:center;">${item.qty}</span>
          <button onclick="changeCartQty('${libId}','${item.bookId}',1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:#fff;cursor:pointer;">+</button>
        </div>
      </div>`;
    });
    html+=`<button class="btn-primary btn-full" style="margin-top:8px;" onclick="checkoutLibrary('${libId}')">✅ অর্ডার করুন (৳${libTotal})</button><div class="divider"></div>`;
  });
  showModal(html);
}

function changeCartQty(libId,bookId,delta) {
  const item=shopCart[libId]?.items.find(i=>i.bookId===bookId);
  if(!item) return;
  item.qty+=delta;
  if(item.qty<=0) shopCart[libId].items=shopCart[libId].items.filter(i=>i.bookId!==bookId);
  if(!shopCart[libId]?.items.length) delete shopCart[libId];
  updateCartBar(); showCart();
}

async function checkoutLibrary(libId) {
  const lib=shopCart[libId];
  if(!lib) return;
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">✅ অর্ডার কনফার্ম</div>
    <div style="font-weight:700;color:var(--primary-dark);margin-bottom:10px;">🏪 ${lib.libraryName}</div>
    ${lib.items.map(i=>`<div class="list-item"><span>📗 ${i.bookTitle} ×${i.qty}</span><span style="font-weight:600;">৳${i.price*i.qty}</span></div>`).join('')}
    <div class="card" style="margin:10px 0;"><div class="flex-between"><span>মোট:</span>
      <span style="font-weight:700;color:var(--primary);font-size:18px;">৳${lib.items.reduce((s,i)=>s+(i.price*i.qty),0)}</span></div></div>
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
      bookTitle:lib.items.map(i=>i.bookTitle).join(', '),
      items:lib.items,total,address,note,
      status:'pending',createdAt:new Date().toISOString()
    };
    await db.collection(SHOP_ORDERS_COL).add(orderData);
    delete shopCart[libId]; updateCartBar();
    closeModal(); showToast('✅ অর্ডার হয়েছে!');
    setTimeout(()=>showReceipt(orderData),400);
  } catch(e){showToast('সমস্যা হয়েছে: '+e.message);}
}

function showReceipt(order) {
  const date=new Date().toLocaleDateString('bn-BD');
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🧾 ক্রয় রশিদ</div>
    <div id="receiptContent" style="border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:14px;font-family:var(--font-main);">
      <div style="text-align:center;border-bottom:2px solid var(--primary);padding-bottom:10px;margin-bottom:12px;">
        <div style="font-size:20px;">📚</div>
        <div style="font-family:var(--font-serif);font-size:16px;font-weight:700;color:var(--primary);">ওয়ান টু ওয়ান লাইব্রেরি</div>
        <div style="font-size:12px;color:var(--text-muted);">ক্রয় রশিদ</div>
      </div>
      <div style="font-size:13px;line-height:2;">
        <div><b>অর্ডার নং:</b> ${order.orderId}</div>
        <div><b>তারিখ:</b> ${date}</div>
        <div><b>বই:</b> ${order.bookTitle}</div>
        <div><b>লাইব্রেরি:</b> ${order.libraryName}</div>
        <div><b>ক্রেতা:</b> ${order.buyerName} (${order.buyerPhone})</div>
        <div><b>ঠিকানা:</b> ${order.address}</div>
      </div>
      <div style="border-top:1px dashed var(--border);margin-top:10px;padding-top:10px;text-align:right;">
        <div style="font-size:18px;font-weight:700;color:var(--primary);">মোট: ৳${order.total}</div>
      </div>
      <div style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:8px;">ধন্যবাদ! 📚</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn-primary btn-sm" style="flex:1;" onclick="printReceipt('${order.orderId}')">🖨️ প্রিন্ট / ডাউনলোড</button>
      <a href="${buildWhatsAppLink(order.sellerPhone,`অর্ডার নং ${order.orderId} কনফার্ম। বই: ${order.bookTitle}। মোট: ৳${order.total}`)}" target="_blank" class="btn-secondary btn-sm" style="flex:1;text-decoration:none;text-align:center;display:block;">📱 বিক্রেতাকে জানান</a>
    </div>
  `);
}

function printReceipt(orderId) {
  const c=document.getElementById('receiptContent');
  if(!c) return;
  const w=window.open('','_blank');
  w.document.write(`<html><head><title>রশিদ-${orderId}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto;font-size:14px;}
    h2{color:#1a5c38;text-align:center;}</style>
    </head><body>${c.innerHTML}<script>window.print();window.onafterprint=()=>window.close();<\/script></body></html>`);
  w.document.close();
}

async function showMyShopOrders() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📦 আমার অর্ডার</div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <button class="btn-primary btn-sm" id="ord-buy" onclick="loadMyBuyOrders()">🛒 কিনেছি</button>
      <button class="btn-secondary btn-sm" id="ord-sell" onclick="loadMySellOrders()">🏪 বিক্রি</button>
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
    const snap=await db.collection(SHOP_ORDERS_COL).where('buyerPhone','==',currentUser.phone).get();
    const orders=snap.docs.map(d=>d.data()).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!orders.length){el.innerHTML=`<div class="empty-state"><p>কোনো ক্রয় নেই</p></div>`;return;}
    el.innerHTML=orders.map(o=>`<div class="history-item type-order">
      <div class="flex-between"><div class="history-title">📗 ${o.bookTitle}</div>
        <span class="badge ${o.status==='confirmed'?'badge-green':'badge-yellow'}">${o.status==='confirmed'?'নিশ্চিত':'অপেক্ষামান'}</span></div>
      <div class="history-date">🏪 ${o.libraryName} · ৳${o.total}</div>
      <div class="history-date">📅 ${formatDate(o.createdAt)}</div>
      <button class="btn-secondary btn-sm" style="margin-top:6px;" onclick="showReceipt(${JSON.stringify(o).replace(/"/g,'&quot;')})">🧾 রশিদ</button>
    </div>`).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function loadMySellOrders() {
  document.getElementById('ord-sell').className='btn-primary btn-sm';
  document.getElementById('ord-buy').className='btn-secondary btn-sm';
  const el=document.getElementById('myOrdersList');
  if(!el) return;
  try {
    const snap=await db.collection(SHOP_ORDERS_COL).where('sellerPhone','==',currentUser.phone).get();
    const orders=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!orders.length){el.innerHTML=`<div class="empty-state"><p>কোনো বিক্রয় নেই</p></div>`;return;}
    el.innerHTML=orders.map(o=>`<div class="history-item type-order">
      <div class="flex-between"><div class="history-title">📗 ${o.bookTitle}</div>
        <span class="badge ${o.status==='confirmed'?'badge-green':'badge-yellow'}">${o.status==='confirmed'?'নিশ্চিত':'অপেক্ষামান'}</span></div>
      <div class="history-date">👤 ${o.buyerName} (${o.buyerPhone}) · ৳${o.total}</div>
      <div class="history-date">📍 ${o.address}</div>
      <div class="history-date">📅 ${formatDate(o.createdAt)}</div>
      ${o.status==='pending'?`<div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn-primary btn-sm" onclick="confirmSaleOrder('${o.id}','${o.buyerPhone}','${escHtml(o.bookTitle)}',${o.total})">✅ নিশ্চিত</button>
        <a href="${buildWhatsAppLink(o.buyerPhone,`আপনার "${o.bookTitle}" অর্ডার (${o.orderId}) নিশ্চিত হয়েছে। মোট: ৳${o.total}`)}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;display:inline-block;">📱 জানান</a>
      </div>`:''}
    </div>`).join('');
  } catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function confirmSaleOrder(orderId,buyerPhone,bookTitle,total) {
  try{
    await db.collection(SHOP_ORDERS_COL).doc(orderId).update({status:'confirmed'});
    showToast('✅ অর্ডার নিশ্চিত!'); loadMySellOrders();
  }catch(e){showToast('সমস্যা হয়েছে');}
}
