// ============================================
// AUTH - ফোন + পিন সিস্টেম
// পুরনো ইউজার: ফোন নম্বর দিলে পিন চাইবে (কারো নাম্বার দিয়ে যেন কেউ ঢুকে যেতে না পারে)
// নতুন ইউজার: সব তথ্য + পিন সেট + ইমেইল (পিন রিকভারির জন্য)
// ============================================

let currentUser = null;
let phoneCheckDone = false;
let isExistingUser = false;

async function initAuth() {
  const savedPhone = localStorage.getItem('lib_phone');
  if (savedPhone) {
    const user = await getUserByPhone(savedPhone);
    // পিন থাকলে সেভড লগইন honor করা হবে না — নিরাপত্তার জন্য প্রতিবার পিন লাগবে
    // (localStorage-এ শুধু phone সেভ থাকে, pin না, তাই security ঠিক থাকে)
    if (user) {
      currentUser = user;
      showApp();
      return;
    } else {
      localStorage.removeItem('lib_phone');
    }
  }
  showAuthScreen();
}

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('registerFields').style.display = 'none';
  document.getElementById('loginPinArea').style.display = 'none';
  document.getElementById('authSubText').textContent = 'স্বাগতম! প্রবেশ করতে নম্বর দিন';
  document.getElementById('authBtn').textContent = 'পরবর্তী';
  document.getElementById('authPhone').value = '';
  document.getElementById('loginPin').value = '';
  phoneCheckDone = false;
  isExistingUser = false;
}

let phoneTimer = null;
function onPhoneInput(val) {
  if (phoneCheckDone) {
    phoneCheckDone = false;
    isExistingUser = false;
    document.getElementById('registerFields').style.display = 'none';
    document.getElementById('loginPinArea').style.display = 'none';
    document.getElementById('authBtn').textContent = 'পরবর্তী';
    document.getElementById('authSubText').textContent = 'স্বাগতম! প্রবেশ করতে নম্বর দিন';
  }
  clearTimeout(phoneTimer);
  if (val.trim().length >= 11) {
    phoneTimer = setTimeout(() => checkPhone(val.trim()), 500);
  }
}

async function checkPhone(phone) {
  const btn = document.getElementById('authBtn');
  const prevText = btn.textContent;
  btn.textContent = '...যাচাই হচ্ছে';
  btn.disabled = true;
  try {
    const user = await getUserByPhone(phone);
    phoneCheckDone = true;
    if (user) {
      isExistingUser = true;
      document.getElementById('registerFields').style.display = 'none';
      document.getElementById('loginPinArea').style.display = 'block';
      document.getElementById('authSubText').textContent = `স্বাগত ফিরে, ${user.name}! পিন দিন 🔒`;
      btn.textContent = 'প্রবেশ করুন';
      document.getElementById('loginPin').focus();
    } else {
      isExistingUser = false;
      document.getElementById('loginPinArea').style.display = 'none';
      document.getElementById('registerFields').style.display = 'block';
      document.getElementById('authSubText').textContent = 'নতুন অ্যাকাউন্ট — তথ্য পূরণ করুন';
      btn.textContent = 'নিবন্ধন করুন';
      const locArea = document.getElementById('regLocationArea');
      if (locArea && !locArea.dataset.loaded) {
        locArea.innerHTML = locationDropdownsHTML('reg');
        locArea.dataset.loaded = 'true';
      }
    }
  } catch (e) {
    document.getElementById('authSubText').textContent = 'সংযোগ সমস্যা, আবার চেষ্টা করুন';
    btn.textContent = prevText;
  }
  btn.disabled = false;
}

async function handleAuth() {
  const phone = document.getElementById('authPhone').value.trim();
  if (!phone || phone.length < 10) { showToast('সঠিক মোবাইল নম্বর দিন'); return; }

  if (!phoneCheckDone) {
    await checkPhone(phone);
    return;
  }

  const btn = document.getElementById('authBtn');
  btn.disabled = true; btn.textContent = '...অপেক্ষা করুন';

  try {
    if (isExistingUser) {
      const pin = document.getElementById('loginPin').value.trim();
      if (!pin || pin.length !== 4) {
        showToast('৪ সংখ্যার পিন দিন');
        btn.disabled = false; btn.textContent = 'প্রবেশ করুন';
        return;
      }
      const user = await getUserByPhone(phone);
      if (!user) {
        showToast('ইউজার পাওয়া যায়নি');
        btn.disabled = false; btn.textContent = 'প্রবেশ করুন';
        return;
      }
      // পুরনো ইউজার যাদের পিন এখনো সেট নেই (আপডেটের আগে রেজিস্টার করেছিলেন) —
      // তাদের প্রথমবার পিন সেট করতে হবে
      if (!user.pinHash) {
        currentUser = user;
        showFirstTimePinSetup();
        btn.disabled = false; btn.textContent = 'প্রবেশ করুন';
        return;
      }
      const pinHash = await hashPin(pin);
      if (pinHash !== user.pinHash) {
        showToast('❌ ভুল পিন');
        document.getElementById('loginPin').value = '';
        btn.disabled = false; btn.textContent = 'প্রবেশ করুন';
        return;
      }
      currentUser = user;
      localStorage.setItem('lib_phone', phone);
      showApp();
    } else {
      const name = document.getElementById('regName').value.trim();
      const gender = document.getElementById('regGender').value;
      const email = document.getElementById('regEmail').value.trim();
      const pin = document.getElementById('regPin').value.trim();
      const pinConfirm = document.getElementById('regPinConfirm').value.trim();
      const village = document.getElementById('regVillage').value.trim();
      const division = document.getElementById('regDivision')?.value || '';
      const { district, upazila } = getLocationValues('reg');

      if (!name) { showToast('নাম দিন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }
      if (!gender) { showToast('আপনি কি সিলেক্ট করুন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }
      if (!email || !email.includes('@')) { showToast('সঠিক ইমেইল দিন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) { showToast('৪ সংখ্যার পিন দিন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }
      if (pin !== pinConfirm) { showToast('পিন দুটো মিলছে না'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }
      if (!division) { showToast('বিভাগ সিলেক্ট করুন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }
      if (!village||!upazila||!district) { showToast('ঠিকানা সম্পূর্ণ করুন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }

      const existing = await getUserByPhone(phone);
      if (existing) {
        showToast('এই নম্বরে আগেই অ্যাকাউন্ট আছে!');
        isExistingUser = true;
        document.getElementById('registerFields').style.display = 'none';
        document.getElementById('loginPinArea').style.display = 'block';
        document.getElementById('authSubText').textContent = `স্বাগত ফিরে, ${existing.name}! পিন দিন 🔒`;
        btn.disabled=false; btn.textContent='প্রবেশ করুন';
        return;
      }

      const pinHash = await hashPin(pin);
      const newUser = { name, gender, email, pinHash, division, village, upazila, district, phone, createdAt: new Date().toISOString(), role: 'user' };
      await db.collection(USERS_COL).doc(phone).set(newUser);
      currentUser = newUser;
      localStorage.setItem('lib_phone', phone);
      showApp();
    }
  } catch(e) {
    showToast('সমস্যা হয়েছে: ' + e.message);
    btn.disabled=false;
    btn.textContent = isExistingUser ? 'প্রবেশ করুন' : 'নিবন্ধন করুন';
  }
}

// পুরনো ইউজার (পিন-চালু হওয়ার আগে রেজিস্টার করা) প্রথমবার পিন সেট করবেন
function showFirstTimePinSetup() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🔒 নিরাপত্তার জন্য পিন সেট করুন</div>
    <div style="background:#fff3cd;border-radius:8px;padding:10px;margin-bottom:14px;font-size:13px;color:#856404;">
      আপনার অ্যাকাউন্টে এখনো পিন সেট নেই। আজ থেকে লগইন করতে পিন লাগবে — এখনই সেট করুন।
    </div>
    <div class="input-group"><label>ইমেইল * (পিন রিকভারির জন্য)</label>
      <input type="email" id="firstPinEmail" placeholder="you@example.com" value="${currentUser.email||''}"></div>
    <div class="input-group"><label>৪ সংখ্যার পিন *</label>
      <input type="password" id="firstPin" maxlength="4" inputmode="numeric"></div>
    <div class="input-group"><label>পিন আবার লিখুন *</label>
      <input type="password" id="firstPinConfirm" maxlength="4" inputmode="numeric"></div>
    <button class="btn-primary btn-full" onclick="submitFirstTimePin()">✅ পিন সেট করুন ও প্রবেশ করুন</button>
  `);
}

async function submitFirstTimePin() {
  const email = document.getElementById('firstPinEmail').value.trim();
  const pin = document.getElementById('firstPin').value.trim();
  const pinConfirm = document.getElementById('firstPinConfirm').value.trim();
  if (!email || !email.includes('@')) return showToast('সঠিক ইমেইল দিন');
  if (!pin || pin.length!==4 || !/^\d{4}$/.test(pin)) return showToast('৪ সংখ্যার পিন দিন');
  if (pin !== pinConfirm) return showToast('পিন দুটো মিলছে না');
  try {
    const pinHash = await hashPin(pin);
    await db.collection(USERS_COL).doc(currentUser.phone).update({ email, pinHash });
    currentUser = { ...currentUser, email, pinHash };
    localStorage.setItem('lib_phone', currentUser.phone);
    closeModal();
    showApp();
    showToast('✅ পিন সেট হয়েছে!');
  } catch(e) { showToast('সমস্যা হয়েছে'); }
}

// ---- পিন ভুলে গেলে — অ্যাডমিনকে রিকভারি রিকোয়েস্ট পাঠানো ----
async function showForgotPin() {
  const phone = document.getElementById('authPhone').value.trim();
  if (!phone) { showToast('আগে ফোন নম্বর দিন'); return; }
  // আগে থেকেই অপেক্ষামান রিকোয়েস্ট থাকলে সরাসরি জানিয়ে দেওয়া হচ্ছে
  try {
    const existingSnap = await db.collection('pin_recovery_requests').where('phone','==',phone).get();
    if (!existingSnap.empty) {
      showModal(`
        <span class="modal-close" onclick="closeModal()">✕</span>
        <div class="modal-title">⏳ রিকোয়েস্ট বিদ্যমান</div>
        <div style="background:#fff3cd;border-radius:8px;padding:12px;font-size:14px;color:#856404;">
          আপনি ইতিমধ্যেই রিকুয়েস্ট করেছেন। অনুগ্রহপূর্বক অপেক্ষা করুন। অ্যাডমিন যাচাই করে পিন রিসেট করে দেবেন।
        </div>
      `);
      return;
    }
  } catch(e) {}
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🔑 পিন ভুলে গেছেন?</div>
    <div style="background:#e8f4fd;border-radius:8px;padding:10px;margin-bottom:14px;font-size:13px;color:#0c5460;">
      নিচে আপনার রেজিস্ট্রেশনের সময় দেওয়া ইমেইল দিন। অ্যাডমিন এটা মিলিয়ে যাচাই করে আপনার পিন রিসেট করে দেবেন।
    </div>
    <div class="input-group"><label>আপনার রেজিস্টার্ড ইমেইল *</label>
      <input type="email" id="forgotEmail" placeholder="you@example.com"></div>
    <button class="btn-primary btn-full" onclick="submitPinRecoveryRequest('${phone}')">📩 রিকভারি রিকোয়েস্ট পাঠান</button>
  `);
}

async function submitPinRecoveryRequest(phone) {
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email || !email.includes('@')) return showToast('সঠিক ইমেইল দিন');
  try {
    const user = await getUserByPhone(phone);
    if (!user) { showToast('এই নম্বরে কোনো অ্যাকাউন্ট নেই'); return; }
    if (!user.email || user.email.toLowerCase() !== email.toLowerCase()) {
      showToast('❌ ইমেইল মিলছে না — রেজিস্ট্রেশনের সময় যে ইমেইল দিয়েছিলেন সেটা দিন');
      return;
    }
    // একই নম্বরে আগে থেকে অপেক্ষামান রিকোয়েস্ট থাকলে দ্বিতীয়বার পাঠানো যাবে না
    const existingSnap = await db.collection('pin_recovery_requests').where('phone','==',phone).get();
    if (!existingSnap.empty) {
      showToast('⏳ আপনি ইতিমধ্যেই রিকুয়েস্ট করেছেন। অনুগ্রহপূর্বক অপেক্ষা করুন।');
      return;
    }
    const settings = await getSettings();
    // রিকভারি রিকোয়েস্ট নথিভুক্ত
    await db.collection('pin_recovery_requests').add({
      phone, name: user.name, email,
      status: 'pending', createdAt: new Date().toISOString()
    });
    if (settings.adminPhone) {
      await sendNotif(settings.adminPhone, 'pin_recovery', {
        title: '🔑 পিন রিকভারি রিকোয়েস্ট',
        body: `${user.name} (${phone}) পিন রিসেট চাইছেন`,
        relatedId: phone
      });
    }
    closeModal();
    showToast('✅ রিকোয়েস্ট পাঠানো হয়েছে। অ্যাডমিন যাচাই করে পিন রিসেট করবেন।');
  } catch(e) { showToast('সমস্যা হয়েছে'); }
}

async function getUserByPhone(phone) {
  try {
    const doc = await db.collection(USERS_COL).doc(phone).get();
    return doc.exists ? doc.data() : null;
  } catch(e) { return null; }
}

function logout() {
  localStorage.removeItem('lib_phone');
  currentUser = null;
  closeModal();
  document.getElementById('app').classList.add('hidden');
  showAuthScreen();
}

// ---- প্রোফাইল ----
function showProfile() {
  if (!currentUser) return;
  const html = `
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">👤 আমার প্রোফাইল</div>
    <div class="card" style="margin-bottom:10px;">
      <div class="text-sm text-muted">নাম</div>
      <div style="font-weight:600;font-size:16px;">${currentUser.name}</div>
    </div>
    <div class="card" style="margin-bottom:10px;">
      <div class="text-sm text-muted">মোবাইল</div>
      <div style="font-weight:600;">${currentUser.phone}</div>
    </div>
    <div class="card" style="margin-bottom:10px;">
      <div class="text-sm text-muted">ঠিকানা</div>
      <div style="font-weight:600;">${currentUser.village||''}, ${currentUser.upazila||''}, ${currentUser.district||''}</div>
    </div>
    <button class="btn-secondary btn-full" style="margin-bottom:8px;" onclick="showEditProfile()">✏️ প্রোফাইল এডিট করুন</button>
    <button class="btn-secondary btn-full" style="margin-bottom:8px;" onclick="showChangePin()">🔒 পিন পরিবর্তন করুন</button>
    ${currentUser.role==='admin'?`<button class="btn-accent btn-full" style="margin-bottom:8px;" onclick="closeModal();navigate('admin')">⚙️ অ্যাডমিন প্যানেল</button>`:''}
    <button class="btn-danger btn-full" onclick="logout()">লগ আউট</button>
  `;
  showModal(html);
}

function showChangePin() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">🔒 পিন পরিবর্তন করুন</div>
    <div class="input-group"><label>বর্তমান পিন *</label><input type="password" id="curPin" maxlength="4" inputmode="numeric"></div>
    <div class="input-group"><label>নতুন পিন *</label><input type="password" id="newPin" maxlength="4" inputmode="numeric"></div>
    <div class="input-group"><label>নতুন পিন আবার লিখুন *</label><input type="password" id="newPinConfirm" maxlength="4" inputmode="numeric"></div>
    <button class="btn-primary btn-full" onclick="submitChangePin()">✅ পরিবর্তন করুন</button>
  `);
}

async function submitChangePin() {
  const curPin = document.getElementById('curPin').value.trim();
  const newPin = document.getElementById('newPin').value.trim();
  const newPinConfirm = document.getElementById('newPinConfirm').value.trim();
  if (!curPin || !newPin || newPin.length!==4 || !/^\d{4}$/.test(newPin)) return showToast('সঠিক পিন দিন');
  if (newPin !== newPinConfirm) return showToast('নতুন পিন দুটো মিলছে না');
  try {
    const curHash = await hashPin(curPin);
    if (curHash !== currentUser.pinHash) return showToast('❌ বর্তমান পিন ভুল');
    const newHash = await hashPin(newPin);
    await db.collection(USERS_COL).doc(currentUser.phone).update({ pinHash: newHash });
    currentUser.pinHash = newHash;
    closeModal();
    showToast('✅ পিন পরিবর্তন হয়েছে!');
  } catch(e) { showToast('সমস্যা হয়েছে'); }
}

function showEditProfile() {
  const html = `
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">✏️ প্রোফাইল এডিট</div>
    <div class="input-group"><label>নাম</label><input type="text" id="editName" value="${currentUser.name||''}"></div>
    <div class="input-group"><label>ইমেইল ${!currentUser.email?'⚠️ (পিন রিকভারির জন্য দরকার)':''}</label>
      <input type="email" id="editEmail" value="${currentUser.email||''}"></div>
    <div class="input-group"><label>আপনি কি? ${!currentUser.gender?'⚠️ (বই ধারের জন্য দরকার)':''}</label>
      <select id="editGender">
        <option value="" ${!currentUser.gender?'selected':''}>সিলেক্ট করুন</option>
        <option value="male" ${currentUser.gender==='male'?'selected':''}>পুরুষ</option>
        <option value="female" ${currentUser.gender==='female'?'selected':''}>নারী</option>
        <option value="institution" ${currentUser.gender==='institution'?'selected':''}>প্রতিষ্ঠান</option>
      </select></div>
    <div class="input-group"><label>গ্রাম / এলাকা</label><input type="text" id="editVillage" value="${currentUser.village||''}"></div>
    <div id="editLocationArea"></div>
    <button class="btn-primary btn-full" onclick="saveProfile()">সেভ করুন</button>
  `;
  showModal(html);
  const locArea = document.getElementById('editLocationArea');
  if (locArea) {
    locArea.innerHTML = locationDropdownsHTML('edit', { upazila: currentUser.upazila });
    const division = currentUser.division || findDivisionForDistrict(currentUser.district) || '';
    if (division) preselectLocation('edit', division, currentUser.district);
  }
}

async function saveProfile() {
  const name = document.getElementById('editName').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const gender = document.getElementById('editGender').value;
  const village = document.getElementById('editVillage').value.trim();
  const division = document.getElementById('editDivision')?.value || currentUser.division || '';
  const { district, upazila } = getLocationValues('edit');
  if (!name) { showToast('নাম দিন'); return; }
  try {
    const update = { name, village, division, upazila, district };
    if (email) update.email = email;
    if (gender) update.gender = gender;
    await db.collection(USERS_COL).doc(currentUser.phone).update(update);
    currentUser = { ...currentUser, ...update };
    document.getElementById('userGreeting').textContent = currentUser.name.split(' ')[0];
    closeModal();
    showToast('✅ প্রোফাইল আপডেট হয়েছে!');
  } catch(e) { showToast('সমস্যা হয়েছে'); }
}
