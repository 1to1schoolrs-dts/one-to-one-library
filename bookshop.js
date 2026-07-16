const SHOP_COL='bookshop',SHOP_ORDERS_COL='shop_orders',LIBRARIES_COL='libraries',BARGAINS_COL='bargains';
let shopCurrentCat='সব ক্যাটাগরি',shopView='books',shopCart={},userLibrary=null;

async function renderBookshop(container){
  await checkUserLibrary();
  container.innerHTML=`<div class="page">
    <div class="section-header">
      <span class="section-title">🛍️ বই বিক্রয় / ক্রয়</span>
      <button class="btn-accent btn-sm" onclick="${userLibrary?`showAddShopBook('${userLibrary.id}','${escHtml(userLibrary.name)}')`:'showAddLibrary()'}">
        ${userLibrary?'+ নতুন বই যোগ':'+ বই বিক্রি করুন'}
      </button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <button class="btn-primary btn-sm" id="svtab-books" onclick="switchShopView('books')">📚 সব বই</button>
      <button class="btn-secondary btn-sm" id="svtab-libraries" onclick="switchShopView('libraries')">🏪 লাইব্রেরি</button>
      <button class="btn-secondary btn-sm" onclick="showMyShopOrders()">📦 আমার অর্ডার</button>
      ${userLibrary?`<button class="btn-secondary btn-sm" onclick="loadMyLibraryBooks()">🏪 আমার লাইব্রেরি</button>`:''}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;" id="shopCatChips">
      ${CATEGORIES.map(c=>`<button class="cat-chip ${c==='সব ক্যাটাগরি'?'cat-chip-active':''}" onclick="shopSelectCat('${c}')" id="shopcat-${c}">${c}</button>`).join('')}
    </div>
    <div class="search-bar"><span>🔍</span>
      <input type="text" id="shopSearch" placeholder="বই, লেখক বা লাইব্রেরি..." oninput="loadShopBooks()">
    </div>
    <div id="cartBar"></div>
    <div id="shopContent"><div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div></div>
  </div>`;
  loadShopBooks();
}

async function checkUserLibrary(){
  try{const s=await db.collection(LIBRARIES_COL).where('ownerPhone','==',currentUser.phone).get();
  userLibrary=s.empty?null:{id:s.docs[0].id,...s.docs[0].data()};}catch(e){userLibrary=null;}
}
function switchShopView(v){
  shopView=v;
  ['books','libraries'].forEach(t=>{const b=document.getElementById('svtab-'+t);if(b)b.className=t===v?'btn-primary btn-sm':'btn-secondary btn-sm';});
  v==='libraries'?loadLibraries():loadShopBooks();
}
function shopSelectCat(cat){
  shopCurrentCat=cat;
  document.querySelectorAll('#shopCatChips .cat-chip').forEach(c=>c.classList.remove('cat-chip-active'));
  const el=document.getElementById('shopcat-'+cat);if(el)el.classList.add('cat-chip-active');
  loadShopBooks();
}
async function loadShopBooks(filterLibId=null){
  const el=document.getElementById('shopContent');if(!el)return;
  el.innerHTML='<div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div>';
  try{
    const search=(document.getElementById('shopSearch')?.value||'').toLowerCase();
    const snap=filterLibId?await db.collection(SHOP_COL).where('libraryId','==',filterLibId).get()
      :await db.collection(SHOP_COL).where('available','==',true).get();
    let books=snap.docs.map(d=>({id:d.id,...d.data()}));
    books.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(shopCurrentCat!=='সব ক্যাটাগরি')books=books.filter(b=>b.category===shopCurrentCat);
    if(search)books=books.filter(b=>b.title?.toLowerCase().includes(search)||b.author?.toLowerCase().includes(search)||b.libraryName?.toLowerCase().includes(search));
    books.sort((a,b)=>shopLocScore(b)-shopLocScore(a));
    if(!books.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><p>কোনো বই পাওয়া যায়নি</p></div>`;return;}
    el.innerHTML=books.map(b=>{
      const isMine=b.sellerPhone===currentUser.phone;
      const near=shopLocScore(b)>0&&!isMine;
      const pct=b.printPrice&&b.salePrice?Math.round((1-b.salePrice/b.printPrice)*100):0;
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
        ${b.description?`<div class="text-sm text-muted">${b.description}</div>`:''}
        <div style="display:flex;align-items:center;gap:10px;margin:8px 0;">
          ${b.printPrice?`<span style="font-size:12px;color:var(--text-muted);text-decoration:line-through;">৳${b.printPrice}</span>`:''}
          <span style="font-size:18px;font-weight:700;color:var(--primary);">৳${b.salePrice}</span>
          ${pct>0?`<span class="badge badge-green">${pct}% ছাড়</span>`:''}
          <span style="font-size:12px;color:var(--text-muted);">স্টক: ${b.stock||1}</span>
        </div>
        <div class="book-card-actions">
          ${isMine?`<span class="badge badge-blue">আপনার বই</span>
            <button class="btn-secondary btn-sm" onclick="showEditShopBook('${b.id}')">✏️ এডিট</button>
            <button class="btn-danger btn-sm" onclick="deleteShopBook('${b.id}')">🗑️</button>`
          :`<button class="btn-primary btn-sm" onclick="showBuyBook('${b.id}')">🛒 কিনুন</button>
            ${b.bargainable?`<button class="btn-secondary btn-sm" onclick="showBargainStart('${b.id}','${escHtml(b.title)}','${b.salePrice}','${b.sellerPhone}','${escHtml(b.libraryName)}')">💬 বারগেইন</button>`:''}
            <button class="btn-secondary btn-sm" onclick="addToCart('${b.id}','${escHtml(b.title)}',${b.salePrice},'${b.libraryId}','${escHtml(b.libraryName)}','${b.sellerPhone}')">🧺 কার্ট</button>`}
        </div>
      </div>`;
    }).join('');
  }catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা: ${e.message}</p></div>`;}
}
function shopLocScore(b){
  if(!currentUser)return 0;let s=0;
  if(b.libraryDistrict&&currentUser.district&&b.libraryDistrict.trim()===currentUser.district.trim())s+=10;
  if(b.libraryUpazila&&currentUser.upazila&&b.libraryUpazila.trim()===currentUser.upazila.trim())s+=20;
  return s;
}
async function loadMyLibraryBooks(){if(!userLibrary)return;switchShopView('books');loadShopBooks(userLibrary.id);}

async function loadLibraries(){
  const el=document.getElementById('shopContent');if(!el)return;
  el.innerHTML='<div class="text-muted text-sm text-center" style="padding:20px;">লোড হচ্ছে...</div>';
  try{
    const snap=await db.collection(LIBRARIES_COL).get();
    if(snap.empty){el.innerHTML=`<div class="empty-state"><div class="empty-icon">🏪</div><p>কোনো লাইব্রেরি নেই</p></div>`;return;}
    const grouped={};
    snap.docs.forEach(d=>{const l=d.data();const dist=l.district||'অন্যান্য';if(!grouped[dist])grouped[dist]=[];grouped[dist].push({id:d.id,...l});});
    el.innerHTML=Object.entries(grouped).map(([dist,libs])=>`
      <div style="margin-bottom:16px;">
        <div style="font-weight:700;color:var(--primary-dark);font-size:14px;margin-bottom:8px;padding:6px 10px;background:#f0f9f4;border-radius:6px;">📍 ${dist} (${libs.length}টি)</div>
        ${libs.map(l=>`<div class="book-card">
          <div class="book-card-title">🏪 ${l.name}</div>
          <div class="book-card-meta"><span>📍 ${l.upazila||''}, ${l.district||''}</span><span>👤 ${l.ownerName||''}</span></div>
          ${l.address?`<div class="text-sm text-muted">${l.address}</div>`:''}
          <button class="btn-primary btn-sm" onclick="loadShopBooks('${l.id}');switchShopView('books')">📚 বই দেখুন</button>
        </div>`).join('')}
      </div>`).join('');
  }catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function showAddLibrary(){
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🏪 লাইব্রেরি নিবন্ধন</div>
    <div class="input-group"><label>লাইব্রেরির নাম *</label><input type="text" id="libName" placeholder="যেমন: বই বিচিত্রা"></div>
    <div class="input-group"><label>মালিকের নাম *</label><input type="text" id="libOwner" value="${currentUser.name}"></div>
    <div class="input-group"><label>ফোন *</label><input type="tel" id="libPhone" value="${currentUser.phone}"></div>
    <div class="input-group"><label>ঠিকানা *</label><input type="text" id="libAddress" placeholder="রাস্তা, এলাকা"></div>
    <div class="form-row">
      <div class="input-group"><label>উপজেলা *</label><input type="text" id="libUpazila" value="${currentUser.upazila||''}"></div>
      <div class="input-group"><label>জেলা *</label><input type="text" id="libDistrict" value="${currentUser.district||''}"></div>
    </div>
    <button class="btn-primary" onclick="submitLibrary()">নিবন্ধন করুন</button>
  `);
}
async function submitLibrary(){
  const name=document.getElementById('libName').value.trim();
  const address=document.getElementById('libAddress').value.trim();
  const upazila=document.getElementById('libUpazila').value.trim();
  const district=document.getElementById('libDistrict').value.trim();
  if(!name||!address||!upazila||!district)return showToast('সব তথ্য পূরণ করুন');
  try{
    const ref=await db.collection(LIBRARIES_COL).add({
      name,ownerName:document.getElementById('libOwner').value.trim(),
      phone:document.getElementById('libPhone').value.trim(),
      address,upazila,district,ownerPhone:currentUser.phone,createdAt:new Date().toISOString()
    });
    userLibrary={id:ref.id,name,upazila,district,ownerPhone:currentUser.phone};
    closeModal();showToast('✅ লাইব্রেরি নিবন্ধন হয়েছে!');
    setTimeout(()=>showAddShopBook(ref.id,name),400);
  }catch(e){showToast('সমস্যা: '+e.message);}
}

function showAddShopBook(libId,libName){
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📗 বই যোগ করুন</div>
    <div style="background:#f0f9f4;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px;">🏪 ${libName}</div>
    <div class="input-group"><label>বইয়ের নাম *</label><input type="text" id="sbTitle"></div>
    <div class="input-group"><label>লেখক *</label><input type="text" id="sbAuthor"></div>
    <div class="input-group"><label>প্রকাশনী</label><input type="text" id="sbPublisher"></div>
    <div class="input-group"><label>ক্যাটাগরি *</label>
      <select id="sbCategory">${CATEGORIES.filter(c=>c!=='সব ক্যাটাগরি').map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
    <div class="input-group"><label>বই সম্পর্কে লিখুন *</label><textarea id="sbDesc" placeholder="বিষয়বস্তু, সংস্করণ..."></textarea></div>
    <div class="form-row">
      <div class="input-group"><label>মুদ্রিত মূল্য (৳)</label><input type="number" id="sbPrintPrice" min="0" value="0"></div>
      <div class="input-group"><label>বিক্রয় মূল্য (৳) *</label><input type="number" id="sbSalePrice" min="0"></div>
    </div>
    <div class="form-row">
      <div class="input-group"><label>স্টক</label><input type="number" id="sbStock" value="1" min="1"></div>
      <div class="input-group"><label>মূল্য ধরন</label>
        <select id="sbBargainable"><option value="false">Fixed মূল্য</option><option value="true">Bargainable</option></select></div>
    </div>
    <button class="btn-primary" onclick="submitShopBook('${libId}','${escHtml(libName)}')">বই যোগ করুন</button>
  `);
}
async function submitShopBook(libId,libName){
  const title=document.getElementById('sbTitle').value.trim();
  const author=document.getElementById('sbAuthor').value.trim();
  const desc=document.getElementById('sbDesc').value.trim();
  const salePrice=Number(document.getElementById('sbSalePrice').value);
  if(!title)return showToast('বইয়ের নাম দিন');
  if(!author)return showToast('লেখকের নাম দিন');
  if(!desc)return showToast('বই সম্পর্কে লিখুন');
  if(!salePrice)return showToast('বিক্রয় মূল্য দিন');
  const libDoc=await db.collection(LIBRARIES_COL).doc(libId).get();
  const lib=libDoc.data();
  try{
    await db.collection(SHOP_COL).add({
      title,author,publisher:document.getElementById('sbPublisher').value.trim(),
      category:document.getElementById('sbCategory').value,description:desc,
      printPrice:Number(document.getElementById('sbPrintPrice').value)||0,salePrice,
      stock:Number(document.getElementById('sbStock').value)||1,
      bargainable:document.getElementById('sbBargainable').value==='true',
      libraryId:libId,libraryName:libName,
      libraryUpazila:lib?.upazila||'',libraryDistrict:lib?.district||'',
      sellerPhone:currentUser.phone,sellerName:currentUser.name,
      available:true,createdAt:new Date().toISOString()
    });
    closeModal();showToast('✅ বই যোগ হয়েছে!');navigate('bookshop');
  }catch(e){showToast('সমস্যা: '+e.message);}
}

async function showEditShopBook(bookId){
  const doc=await db.collection(SHOP_COL).doc(bookId).get();
  const b=doc.data();
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">✏️ বই এডিট</div>
    <div class="input-group"><label>বইয়ের নাম *</label><input type="text" id="editSbTitle" value="${b.title||''}"></div>
    <div class="input-group"><label>লেখক</label><input type="text" id="editSbAuthor" value="${b.author||''}"></div>
    <div class="input-group"><label>বই সম্পর্কে</label><textarea id="editSbDesc">${b.description||''}</textarea></div>
    <div class="form-row">
      <div class="input-group"><label>মুদ্রিত মূল্য</label><input type="number" id="editSbPrint" value="${b.printPrice||0}"></div>
      <div class="input-group"><label>বিক্রয় মূল্য *</label><input type="number" id="editSbSale" value="${b.salePrice||0}"></div>
    </div>
    <div class="form-row">
      <div class="input-group"><label>স্টক</label><input type="number" id="editSbStock" value="${b.stock||1}"></div>
      <div class="input-group"><label>মূল্য ধরন</label>
        <select id="editSbBarg"><option value="false" ${!b.bargainable?'selected':''}>Fixed</option><option value="true" ${b.bargainable?'selected':''}>Bargainable</option></select></div>
    </div>
    <button class="btn-primary btn-full" onclick="saveShopBookEdit('${bookId}')">✅ সেভ করুন</button>
    <button class="btn-danger btn-full" style="margin-top:8px;" onclick="deleteShopBook('${bookId}')">🗑️ মুছুন</button>
  `);
}
async function saveShopBookEdit(bookId){
  const title=document.getElementById('editSbTitle').value.trim();
  const salePrice=Number(document.getElementById('editSbSale').value);
  if(!title)return showToast('নাম দিন');if(!salePrice)return showToast('মূল্য দিন');
  try{
    await db.collection(SHOP_COL).doc(bookId).update({
      title,author:document.getElementById('editSbAuthor').value.trim(),
      description:document.getElementById('editSbDesc').value.trim(),
      printPrice:Number(document.getElementById('editSbPrint').value)||0,salePrice,
      stock:Number(document.getElementById('editSbStock').value)||1,
      bargainable:document.getElementById('editSbBarg').value==='true'
    });
    closeModal();showToast('✅ আপডেট হয়েছে!');navigate('bookshop');
  }catch(e){showToast('সমস্যা: '+e.message);}
}
async function deleteShopBook(id){
  if(!confirm('বইটি মুছে ফেলবেন?'))return;
  try{await db.collection(SHOP_COL).doc(id).delete();closeModal();showToast('মুছে ফেলা হয়েছে');navigate('bookshop');}
  catch(e){showToast('সমস্যা হয়েছে');}
}

// ---- BUY ----
async function showBuyBook(bookId){
  const doc=await db.collection(SHOP_COL).doc(bookId).get();const b=doc.data();
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🛒 বই কিনুন</div>
    <div class="card" style="margin-bottom:14px;background:#f0f9f4;">
      <div style="font-weight:600;">${b.title}</div>
      ${b.author?`<div class="text-sm text-muted">✍️ ${b.author}</div>`:''}
      ${b.description?`<div class="text-sm text-muted">${b.description}</div>`:''}
      <div style="font-size:18px;font-weight:700;color:var(--primary);margin-top:6px;">৳${b.salePrice}</div>
    </div>
    <div class="input-group"><label>কপির সংখ্যা</label>
      <input type="number" id="buyQty" value="1" min="1" max="${b.stock||1}" oninput="updateBuyTotal(${b.salePrice})"></div>
    <div class="card" style="margin-bottom:14px;"><div class="flex-between"><span>মোট:</span>
      <span id="buyTotal" style="font-weight:700;color:var(--primary);font-size:18px;">৳${b.salePrice}</span></div></div>
    <div class="input-group"><label>ডেলিভারি ঠিকানা *</label>
      <textarea id="buyAddress">${currentUser.village||''}, ${currentUser.upazila||''}, ${currentUser.district||''}</textarea></div>
    <div class="input-group"><label>বিশেষ নির্দেশনা</label><input type="text" id="buyNote" placeholder="কিছু জানাতে চাইলে..."></div>
    <div style="background:#e8f4fd;border-radius:8px;padding:10px;margin-bottom:12px;font-size:13px;color:#0c5460;">
      ℹ️ বিক্রেতা অনুমোদন দিলে উভয়পক্ষের নাম্বারসহ রশিদ পাবেন।
    </div>
    <button class="btn-primary btn-full" onclick="confirmPurchase('${bookId}')">✅ অর্ডার কনফার্ম</button>
  `);
}
function updateBuyTotal(price){
  const qty=Number(document.getElementById('buyQty').value)||1;
  const el=document.getElementById('buyTotal');if(el)el.textContent=`৳${price*qty}`;
}
async function confirmPurchase(bookId){
  const qty=Number(document.getElementById('buyQty').value)||1;
  const address=document.getElementById('buyAddress').value.trim();
  const note=document.getElementById('buyNote').value.trim();
  if(!address)return showToast('ঠিকানা দিন');
  const doc=await db.collection(SHOP_COL).doc(bookId).get();const b=doc.data();
  const total=b.salePrice*qty;const orderId='ORD-'+Date.now();
  try{
    const orderData={orderId,bookId,bookTitle:b.title,author:b.author||'',
      libraryId:b.libraryId,libraryName:b.libraryName,
      sellerPhone:b.sellerPhone,sellerName:b.sellerName,
      buyerPhone:currentUser.phone,buyerName:currentUser.name,
      qty,unitPrice:b.salePrice,total,address,note,
      status:'pending',createdAt:new Date().toISOString()};
    await db.collection(SHOP_ORDERS_COL).add(orderData);
    const newStock=(b.stock||1)-qty;
    await db.collection(SHOP_COL).doc(bookId).update({stock:newStock,available:newStock>0});
    // Notify seller
    await sendNotif(b.sellerPhone,'purchase_order',{
      title:'🛒 নতুন ক্রয় অর্ডার!',
      body:`${currentUser.name} "${b.title}" বইটি কিনতে চাইছেন। ৳${total}`,
      relatedId:orderId,bookTitle:b.title
    });
    closeModal();showToast('✅ অর্ডার পাঠানো হয়েছে! বিক্রেতা অনুমোদন দিলে রশিদ পাবেন।');
    navigate('bookshop');
  }catch(e){showToast('সমস্যা: '+e.message);}
}

// ---- BARGAIN (2x2 system) ----
async function showBargainStart(bookId,bookTitle,originalPrice,sellerPhone,libraryName){
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">💬 বারগেইন শুরু করুন</div>
    <div class="card" style="margin-bottom:14px;">
      <div style="font-weight:600;">${bookTitle}</div>
      <div style="color:var(--primary);font-weight:700;">নির্ধারিত মূল্য: ৳${originalPrice}</div>
    </div>
    <div style="background:#fff3cd;border-radius:8px;padding:10px;margin-bottom:14px;font-size:13px;color:#856404;">
      💬 আপনি সর্বোচ্চ <b>২ বার</b> দাম প্রস্তাব করতে পারবেন। বিক্রেতাও ২ বার পাল্টা প্রস্তাব করতে পারবেন।
    </div>
    <div class="input-group"><label>আপনার প্রস্তাবিত মূল্য (৳) *</label>
      <input type="number" id="bargainPrice1" placeholder="আপনার দাম" max="${originalPrice}"></div>
    <div class="input-group"><label>বার্তা (ঐচ্ছিক)</label>
      <textarea id="bargainMsg1" placeholder="বিক্রেতাকে কিছু বলতে চাইলে..."></textarea></div>
    <button class="btn-primary btn-full" onclick="submitBargainOffer('${bookId}','${escHtml(bookTitle)}','${originalPrice}','${sellerPhone}','${escHtml(libraryName)}')">💬 প্রস্তাব পাঠান</button>
  `);
}

async function submitBargainOffer(bookId,bookTitle,originalPrice,sellerPhone,libraryName){
  const price=Number(document.getElementById('bargainPrice1').value);
  const msg=document.getElementById('bargainMsg1').value;
  if(!price)return showToast('মূল্য লিখুন');
  if(price>=Number(originalPrice))return showToast('নির্ধারিত মূল্যের চেয়ে কম দিন');
  try{
    const bargainRef=await db.collection(BARGAINS_COL).add({
      bookId,bookTitle,libraryName,originalPrice:Number(originalPrice),
      currentPrice:price,
      buyerPhone:currentUser.phone,buyerName:currentUser.name,
      sellerPhone,
      status:'pending',
      currentTurn:'seller',
      buyerRounds:1,sellerRounds:0,
      rounds:[{by:'buyer',byName:currentUser.name,price,message:msg,createdAt:new Date().toISOString()}],
      createdAt:new Date().toISOString()
    });
    await sendNotif(sellerPhone,'bargain_offer',{
      title:'💬 বারগেইন প্রস্তাব!',
      body:`${currentUser.name} "${bookTitle}" বইয়ের জন্য ৳${price} প্রস্তাব করেছেন`,
      relatedId:bargainRef.id,bookTitle
    });
    closeModal();showToast('✅ প্রস্তাব পাঠানো হয়েছে!');
  }catch(e){showToast('সমস্যা হয়েছে');}
}

// Show bargain detail and response options
async function showBargainDetail(bargainId){
  const doc=await db.collection(BARGAINS_COL).doc(bargainId).get();
  if(!doc.exists)return showToast('পাওয়া যায়নি');
  const bg=doc.data();
  const isBuyer=bg.buyerPhone===currentUser.phone;
  const isSeller=bg.sellerPhone===currentUser.phone;
  const myTurn=(isBuyer&&bg.currentTurn==='buyer')||(isSeller&&bg.currentTurn==='seller');

  // Count my rounds
  const myRounds=isBuyer?bg.buyerRounds:bg.sellerRounds;
  const canCounter=myTurn&&myRounds<2&&bg.status==='pending';

  const roundsHTML=bg.rounds.map((r,i)=>`
    <div style="background:${r.by==='buyer'?'#e8f4fd':'#f0f9f4'};border-radius:8px;padding:10px;margin-bottom:8px;">
      <div style="font-size:12px;color:var(--text-muted);">${r.by==='buyer'?'ক্রেতা':'বিক্রেতা'}: ${r.byName} — রাউন্ড ${Math.floor(i/2)+1}</div>
      <div style="font-weight:700;color:var(--primary);font-size:16px;">৳${r.price}</div>
      ${r.message?`<div class="text-sm text-muted">"${r.message}"</div>`:''}
      <div style="font-size:11px;color:var(--text-muted);">${timeAgo(r.createdAt)}</div>
    </div>`).join('');

  let actionHTML='';
  if(bg.status==='pending'&&myTurn){
    actionHTML=`
      <div class="divider"></div>
      <div style="font-weight:600;margin-bottom:10px;">আপনার পালা (${myRounds}/${isBuyer?2:2} প্রস্তাব করেছেন):</div>
      <div style="display:flex;gap:8px;margin-bottom:${canCounter?'10px':'0'};">
        <button class="btn-primary btn-sm" style="flex:1;" onclick="acceptBargainOffer('${bargainId}')">✅ সম্মত হন</button>
        <button class="btn-danger btn-sm" style="flex:1;" onclick="rejectBargainOffer('${bargainId}')">❌ না</button>
      </div>
      ${canCounter?`
        <div class="input-group" style="margin-top:8px;"><label>পাল্টা প্রস্তাব (৳)</label>
          <input type="number" id="counterPrice" placeholder="আপনার দাম" 
            ${isBuyer?`max="${bg.currentPrice}"`:`min="${bg.currentPrice}"`}></div>
        <div class="input-group"><label>বার্তা</label>
          <textarea id="counterMsg" placeholder="কিছু বলতে চাইলে..."></textarea></div>
        <button class="btn-secondary btn-full" onclick="submitCounterOffer('${bargainId}')">💬 পাল্টা প্রস্তাব পাঠান</button>
      `:'<div class="text-sm text-muted text-center" style="margin-top:8px;">আপনার সর্বোচ্চ ২টি প্রস্তাব শেষ</div>'}
    `;
  } else if(bg.status==='pending'&&!myTurn){
    actionHTML=`<div style="background:#fff3cd;border-radius:8px;padding:10px;text-align:center;font-size:13px;color:#856404;">⏳ অপরপক্ষের সাড়ার অপেক্ষায়...</div>`;
  }

  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">💬 বারগেইন বিস্তারিত</div>
    <div class="card" style="margin-bottom:14px;">
      <div style="font-weight:600;">${bg.bookTitle}</div>
      <div style="font-size:13px;color:var(--text-muted);">মূল মূল্য: ৳${bg.originalPrice}</div>
      <span class="badge ${bg.status==='accepted'?'badge-green':bg.status==='rejected'?'badge-red':'badge-yellow'}">
        ${bg.status==='accepted'?'সম্মত':bg.status==='rejected'?'না':'চলছে'}</span>
    </div>
    <div style="margin-bottom:12px;">${roundsHTML}</div>
    ${actionHTML}
    ${bg.status==='accepted'?`<div style="background:#d4edda;border-radius:8px;padding:10px;text-align:center;font-weight:600;color:#155724;">✅ ৳${bg.currentPrice} মূল্যে সম্মত হয়েছেন!</div>`:''}
  `);
}

async function acceptBargainOffer(bargainId){
  const doc=await db.collection(BARGAINS_COL).doc(bargainId).get();
  const bg=doc.data();
  try{
    await db.collection(BARGAINS_COL).doc(bargainId).update({status:'accepted'});
    // Create confirmed order
    const orderId='ORD-'+Date.now();
    const orderData={
      orderId,bookId:bg.bookId,bookTitle:bg.bookTitle,
      libraryName:bg.libraryName,libraryId:'',
      sellerPhone:bg.sellerPhone,sellerName:'',
      buyerPhone:bg.buyerPhone,buyerName:bg.buyerName,
      qty:1,unitPrice:bg.currentPrice,total:bg.currentPrice,
      address:'বারগেইন অর্ডার — সরাসরি যোগাযোগ করুন',note:'',
      status:'confirmed',createdAt:new Date().toISOString()
    };
    await db.collection(SHOP_ORDERS_COL).add(orderData);
    const otherPhone=bg.buyerPhone===currentUser.phone?bg.sellerPhone:bg.buyerPhone;
    const otherName=bg.buyerPhone===currentUser.phone?'বিক্রেতা':'ক্রেতা';
    await sendNotif(otherPhone,'bargain_accepted',{
      title:'✅ বারগেইনে সম্মত!',
      body:`"${bg.bookTitle}" — ৳${bg.currentPrice} মূল্যে চুক্তি হয়েছে`,
      relatedId:bargainId,bookTitle:bg.bookTitle
    });
    closeModal();showToast('✅ বারগেইনে সম্মত!');
    setTimeout(()=>showPurchaseReceipt(orderData),300);
  }catch(e){showToast('সমস্যা হয়েছে');}
}

async function rejectBargainOffer(bargainId){
  const doc=await db.collection(BARGAINS_COL).doc(bargainId).get();
  const bg=doc.data();
  try{
    await db.collection(BARGAINS_COL).doc(bargainId).update({status:'rejected'});
    const otherPhone=bg.buyerPhone===currentUser.phone?bg.sellerPhone:bg.buyerPhone;
    await sendNotif(otherPhone,'bargain_rejected',{
      title:'❌ বারগেইন প্রত্যাখ্যাত',
      body:`"${bg.bookTitle}" বইয়ের বারগেইন সম্ভব হয়নি`,
      relatedId:bargainId,bookTitle:bg.bookTitle
    });
    closeModal();showToast('প্রত্যাখ্যান করা হয়েছে');
  }catch(e){showToast('সমস্যা হয়েছে');}
}

async function submitCounterOffer(bargainId){
  const price=Number(document.getElementById('counterPrice').value);
  const msg=document.getElementById('counterMsg').value;
  if(!price)return showToast('মূল্য লিখুন');
  const doc=await db.collection(BARGAINS_COL).doc(bargainId).get();
  const bg=doc.data();
  const isBuyer=bg.buyerPhone===currentUser.phone;
  if(isBuyer&&price>=bg.currentPrice)return showToast('কমের প্রস্তাব দিন');
  if(!isBuyer&&price<=bg.currentPrice)return showToast('বেশির প্রস্তাব দিন');
  try{
    const newRounds=[...bg.rounds,{by:isBuyer?'buyer':'seller',byName:currentUser.name,price,message:msg,createdAt:new Date().toISOString()}];
    await db.collection(BARGAINS_COL).doc(bargainId).update({
      currentPrice:price,
      currentTurn:isBuyer?'seller':'buyer',
      buyerRounds:isBuyer?bg.buyerRounds+1:bg.buyerRounds,
      sellerRounds:!isBuyer?bg.sellerRounds+1:bg.sellerRounds,
      rounds:newRounds
    });
    const otherPhone=isBuyer?bg.sellerPhone:bg.buyerPhone;
    await sendNotif(otherPhone,'bargain_counter',{
      title:`💬 পাল্টা বারগেইন প্রস্তাব`,
      body:`"${bg.bookTitle}" — ${currentUser.name} ৳${price} প্রস্তাব করেছেন`,
      relatedId:bargainId,bookTitle:bg.bookTitle
    });
    closeModal();showToast('✅ পাল্টা প্রস্তাব পাঠানো হয়েছে!');
  }catch(e){showToast('সমস্যা: '+e.message);}
}

// ---- CART ----
function addToCart(bookId,bookTitle,price,libId,libName,sellerPhone){
  if(!shopCart[libId])shopCart[libId]={libraryName:libName,sellerPhone,items:[]};
  const ex=shopCart[libId].items.find(i=>i.bookId===bookId);
  if(ex){ex.qty++;}else{shopCart[libId].items.push({bookId,bookTitle,price,qty:1});}
  updateCartBar();showToast('✅ কার্টে যোগ হয়েছে');
}
function updateCartBar(){
  const el=document.getElementById('cartBar');if(!el)return;
  const count=Object.values(shopCart).reduce((s,l)=>s+l.items.reduce((a,i)=>a+i.qty,0),0);
  const total=Object.values(shopCart).reduce((s,l)=>s+l.items.reduce((a,i)=>a+(i.price*i.qty),0),0);
  if(!count){el.innerHTML='';return;}
  el.innerHTML=`<div style="background:var(--accent);border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <span style="color:#fff;font-weight:600;">🧺 ${count}টি বই · ৳${total}</span>
    <button style="background:#fff;color:var(--primary);border:none;border-radius:6px;padding:5px 10px;font-weight:600;cursor:pointer;" onclick="showCart()">কার্ট →</button>
  </div>`;
}
function showCart(){
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
function changeCartQty(libId,bookId,delta){
  const item=shopCart[libId]?.items.find(i=>i.bookId===bookId);if(!item)return;
  item.qty+=delta;
  if(item.qty<=0)shopCart[libId].items=shopCart[libId].items.filter(i=>i.bookId!==bookId);
  if(!shopCart[libId]?.items.length)delete shopCart[libId];
  updateCartBar();showCart();
}
async function checkoutLibrary(libId){
  const lib=shopCart[libId];if(!lib)return;
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">✅ অর্ডার কনফার্ম</div>
    <div style="font-weight:700;margin-bottom:10px;">🏪 ${lib.libraryName}</div>
    ${lib.items.map(i=>`<div class="list-item"><span>📗 ${i.bookTitle} ×${i.qty}</span><span style="font-weight:600;">৳${i.price*i.qty}</span></div>`).join('')}
    <div class="card" style="margin:10px 0;"><div class="flex-between"><span>মোট:</span>
      <span style="font-weight:700;color:var(--primary);font-size:18px;">৳${lib.items.reduce((s,i)=>s+(i.price*i.qty),0)}</span></div></div>
    <div class="input-group"><label>ডেলিভারি ঠিকানা *</label>
      <textarea id="cartAddress">${currentUser.village||''}, ${currentUser.upazila||''}, ${currentUser.district||''}</textarea></div>
    <div class="input-group"><label>বিশেষ নির্দেশনা</label><input type="text" id="cartNote"></div>
    <button class="btn-primary btn-full" onclick="submitCartOrder('${libId}')">🛒 অর্ডার দিন</button>
  `);
}
async function submitCartOrder(libId){
  const lib=shopCart[libId];
  const address=document.getElementById('cartAddress').value.trim();
  if(!address)return showToast('ঠিকানা দিন');
  const total=lib.items.reduce((s,i)=>s+(i.price*i.qty),0);
  const orderId='ORD-'+Date.now();
  try{
    await db.collection(SHOP_ORDERS_COL).add({
      orderId,libraryId:libId,libraryName:lib.libraryName,sellerPhone:lib.sellerPhone,
      buyerPhone:currentUser.phone,buyerName:currentUser.name,
      bookTitle:lib.items.map(i=>i.bookTitle).join(', '),
      items:lib.items,total,address,note:document.getElementById('cartNote').value,
      status:'pending',createdAt:new Date().toISOString()
    });
    await sendNotif(lib.sellerPhone,'purchase_order',{
      title:'🛒 নতুন ক্রয় অর্ডার!',
      body:`${currentUser.name} ${lib.items.length}টি বই কিনতে চাইছেন। ৳${total}`,
      bookTitle:lib.items.map(i=>i.bookTitle).join(', ')
    });
    delete shopCart[libId];updateCartBar();
    closeModal();showToast('✅ অর্ডার পাঠানো হয়েছে!');navigate('bookshop');
  }catch(e){showToast('সমস্যা: '+e.message);}
}

// ---- ORDERS ----
async function showMyShopOrders(){
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">📦 আমার অর্ডার</div>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <button class="btn-primary btn-sm" id="ord-buy" onclick="loadMyBuyOrders()">🛒 কিনেছি</button>
      <button class="btn-secondary btn-sm" id="ord-sell" onclick="loadMySellOrders()">🏪 বিক্রি</button>
      <button class="btn-secondary btn-sm" id="ord-barg" onclick="loadMyBargainsList()">💬 বারগেইন</button>
    </div>
    <div id="myOrdersList"><div class="text-muted text-sm">লোড হচ্ছে...</div></div>
  `);
  loadMyBuyOrders();
}
function setOrdTab(t){['buy','sell','barg'].forEach(x=>{const b=document.getElementById('ord-'+x);if(b)b.className=x===t?'btn-primary btn-sm':'btn-secondary btn-sm';});}

async function loadMyBuyOrders(){
  setOrdTab('buy');const el=document.getElementById('myOrdersList');if(!el)return;
  try{
    const snap=await db.collection(SHOP_ORDERS_COL).where('buyerPhone','==',currentUser.phone).get();
    const orders=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!orders.length){el.innerHTML=`<div class="empty-state"><p>কোনো ক্রয় নেই</p></div>`;return;}
    el.innerHTML=orders.map(o=>`<div class="history-item type-order">
      <div class="flex-between"><div class="history-title">📗 ${o.bookTitle}</div>
        <span class="badge ${o.status==='confirmed'?'badge-green':o.status==='cancelled'?'badge-red':'badge-yellow'}">${o.status==='confirmed'?'নিশ্চিত':o.status==='cancelled'?'বাতিল':'অপেক্ষামান'}</span></div>
      <div class="history-date">🏪 ${o.libraryName} · ৳${o.total}</div>
      <div class="history-date">📅 ${formatDate(o.createdAt)}</div>
      ${o.status==='confirmed'?`<button class="btn-secondary btn-sm" style="margin-top:6px;" onclick='showPurchaseReceipt(${JSON.stringify(o).replace(/'/g,"&#39;")})'>🧾 রশিদ দেখুন</button>`
      :'<div class="text-sm text-muted" style="margin-top:4px;">⏳ বিক্রেতার অনুমোদনের অপেক্ষায়</div>'}
    </div>`).join('');
  }catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}
async function loadMySellOrders(){
  setOrdTab('sell');const el=document.getElementById('myOrdersList');if(!el)return;
  try{
    const snap=await db.collection(SHOP_ORDERS_COL).where('sellerPhone','==',currentUser.phone).get();
    const orders=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!orders.length){el.innerHTML=`<div class="empty-state"><p>কোনো বিক্রয় নেই</p></div>`;return;}
    el.innerHTML=orders.map(o=>`<div class="history-item type-order">
      <div class="flex-between"><div class="history-title">📗 ${o.bookTitle}</div>
        <span class="badge ${o.status==='confirmed'?'badge-green':o.status==='cancelled'?'badge-red':'badge-yellow'}">${o.status==='confirmed'?'নিশ্চিত':o.status==='cancelled'?'বাতিল':'অপেক্ষামান'}</span></div>
      <div class="history-date">👤 ${o.buyerName} · ৳${o.total}</div>
      <div class="history-date">📍 ${o.address}</div>
      <div class="history-date">📅 ${formatDate(o.createdAt)}</div>
      ${o.status==='pending'?`<div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn-primary btn-sm" onclick='confirmSaleOrder("${o.id}",${JSON.stringify(o).replace(/'/g,"&#39;")})'>✅ অনুমোদন</button>
        <button class="btn-danger btn-sm" onclick="cancelSaleOrder('${o.id}')">❌ বাতিল</button>
      </div>`:`<button class="btn-secondary btn-sm" style="margin-top:6px;" onclick='showPurchaseReceipt(${JSON.stringify(o).replace(/'/g,"&#39;")})'>🧾 রশিদ দেখুন</button>`}
    </div>`).join('');
  }catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}
async function loadMyBargainsList(){
  setOrdTab('barg');const el=document.getElementById('myOrdersList');if(!el)return;
  try{
    const[bs,ss]=await Promise.all([
      db.collection(BARGAINS_COL).where('buyerPhone','==',currentUser.phone).get(),
      db.collection(BARGAINS_COL).where('sellerPhone','==',currentUser.phone).get()
    ]);
    const all=[...bs.docs,...ss.docs].map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!all.length){el.innerHTML=`<div class="empty-state"><p>কোনো বারগেইন নেই</p></div>`;return;}
    el.innerHTML=all.map(b=>{
      const isBuyer=b.buyerPhone===currentUser.phone;
      const myTurn=(isBuyer&&b.currentTurn==='buyer')||(!isBuyer&&b.currentTurn==='seller');
      return `<div class="history-item" style="${myTurn&&b.status==='pending'?'border-left:3px solid var(--accent);':''}">
        <div class="flex-between"><div class="history-title">💬 ${b.bookTitle}</div>
          <span class="badge ${b.status==='accepted'?'badge-green':b.status==='rejected'?'badge-red':'badge-yellow'}">${b.status==='accepted'?'সম্মত':b.status==='rejected'?'না':'চলছে'}</span></div>
        <div class="history-date">মূল: ৳${b.originalPrice} → বর্তমান: ৳${b.currentPrice}</div>
        <div class="history-date">${isBuyer?`বিক্রেতা: ${b.libraryName}`:`ক্রেতা: ${b.buyerName}`}</div>
        ${myTurn&&b.status==='pending'?`<div style="color:var(--accent);font-size:12px;font-weight:600;">⚡ আপনার পালা!</div>`:''}
        <button class="btn-secondary btn-sm" style="margin-top:6px;" onclick="showBargainDetail('${b.id}')">💬 বিস্তারিত দেখুন</button>
      </div>`;
    }).join('');
  }catch(e){el.innerHTML=`<div class="empty-state"><p>লোড সমস্যা</p></div>`;}
}

async function confirmSaleOrder(orderId,orderData){
  try{
    await db.collection(SHOP_ORDERS_COL).doc(orderId).update({status:'confirmed'});
    orderData.status='confirmed';
    await sendNotif(orderData.buyerPhone,'purchase_confirmed',{
      title:'✅ আপনার অর্ডার নিশ্চিত!',
      body:`"${orderData.bookTitle}" — ৳${orderData.total}`,
      bookTitle:orderData.bookTitle
    });
    showToast('✅ অর্ডার নিশ্চিত!');showPurchaseReceipt(orderData);
  }catch(e){showToast('সমস্যা হয়েছে');}
}
async function cancelSaleOrder(orderId){
  if(!confirm('বাতিল করবেন?'))return;
  try{await db.collection(SHOP_ORDERS_COL).doc(orderId).update({status:'cancelled'});showToast('বাতিল হয়েছে');loadMySellOrders();}
  catch(e){showToast('সমস্যা হয়েছে');}
}

// ---- RECEIPT (with copy buttons) ----
function showPurchaseReceipt(order){
  const date=new Date().toLocaleDateString('bn-BD');
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🧾 ক্রয় রশিদ</div>
    <div id="shopReceiptContent" style="border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:14px;">
      <div style="text-align:center;border-bottom:2px solid var(--primary);padding-bottom:10px;margin-bottom:12px;">
        <div style="font-size:20px;">📚</div>
        <div style="font-family:var(--font-serif);font-size:16px;font-weight:700;color:var(--primary);">ওয়ান টু ওয়ান লাইব্রেরি</div>
        <div style="font-size:12px;color:var(--text-muted);">ক্রয় রশিদ</div>
      </div>
      <div style="font-size:13px;line-height:2.2;">
        <div><b>অর্ডার নং:</b> ${order.orderId}</div>
        <div><b>তারিখ:</b> ${date}</div>
        <div><b>বই:</b> ${order.bookTitle}</div>
        <div><b>লাইব্রেরি:</b> ${order.libraryName}</div>
        <div><b>বিক্রেতা:</b> ${order.sellerName||''}
          ${order.sellerPhone?`<button onclick="copyToClipboard('${order.sellerPhone}')" style="margin-left:6px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:#fff;font-size:11px;cursor:pointer;">📞 ${order.sellerPhone} কপি</button>`:''}
        </div>
        <div><b>ক্রেতা:</b> ${order.buyerName||''}
          ${order.buyerPhone?`<button onclick="copyToClipboard('${order.buyerPhone}')" style="margin-left:6px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:#fff;font-size:11px;cursor:pointer;">📞 ${order.buyerPhone} কপি</button>`:''}
        </div>
        <div><b>ঠিকানা:</b> ${order.address||''}</div>
        <div><b>পরিমাণ:</b> ${order.qty||1} কপি</div>
      </div>
      <div style="border-top:1px dashed var(--border);margin-top:10px;padding-top:10px;text-align:right;">
        <div style="font-size:18px;font-weight:700;color:var(--primary);">মোট: ৳${order.total}</div>
      </div>
      <div style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:8px;">ধন্যবাদ! 📚</div>
    </div>
    <button class="btn-primary btn-full" onclick="printShopReceipt()">🖨️ রশিদ প্রিন্ট / ডাউনলোড</button>
  `);
}
function printShopReceipt(){
  const c=document.getElementById('shopReceiptContent');if(!c)return;
  const w=window.open('','_blank');
  w.document.write(`<html><head><title>রশিদ</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto;font-size:14px;line-height:1.8;}button{display:none;}</style>
    </head><body>${c.innerHTML}<script>window.print();window.onafterprint=()=>window.close();<\/script></body></html>`);
  w.document.close();
}
