// ============================================
// AUTH - ফোন-প্রথম লগইন সিস্টেম
// প্রথমে শুধু ফোন নম্বর দেখাবে; রেজিস্টার্ড হলে সরাসরি ঢুকে যাবে,
// নতুন হলে বাকি ফিল্ড (নাম, ঠিকানা) দেখাবে
// ============================================

let currentUser = null;
let phoneCheckDone = false;
let isExistingUser = false;

async function initAuth() {
  const savedPhone = localStorage.getItem('lib_phone');
  if (savedPhone) {
    const user = await getUserByPhone(savedPhone);
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
  document.getElementById('authSubText').textContent = 'স্বাগতম! প্রবেশ করতে নম্বর দিন';
  document.getElementById('authBtn').textContent = 'পরবর্তী';
  document.getElementById('authPhone').value = '';
  phoneCheckDone = false;
  isExistingUser = false;
}

function showRegisterFields(show) {
  document.getElementById('registerFields').style.display = show ? 'block' : 'none';
}

let phoneTimer = null;
function onPhoneInput(val) {
  // ইউজার আবার টাইপ করলে আগের চেক রিসেট
  if (phoneCheckDone) {
    phoneCheckDone = false;
    isExistingUser = false;
    document.getElementById('registerFields').style.display = 'none';
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
      document.getElementById('authSubText').textContent = `স্বাগত ফিরে, ${user.name}! ✅`;
      btn.textContent = 'প্রবেশ করুন';
    } else {
      isExistingUser = false;
      document.getElementById('registerFields').style.display = 'block';
      document.getElementById('authSubText').textContent = 'নতুন অ্যাকাউন্ট — তথ্য পূরণ করুন';
      btn.textContent = 'নিবন্ধন করুন';
      // বিভাগ/জেলা/উপজেলা ড্রপডাউন একবারই তৈরি করা হবে
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

  // নম্বর এখনো চেক না হলে প্রথমে চেক করা হবে
  if (!phoneCheckDone) {
    await checkPhone(phone);
    return;
  }

  const btn = document.getElementById('authBtn');
  btn.disabled = true; btn.textContent = '...অপেক্ষা করুন';

  try {
    if (isExistingUser) {
      const user = await getUserByPhone(phone);
      if (user) {
        currentUser = user;
        localStorage.setItem('lib_phone', phone);
        showApp();
      } else {
        showToast('ইউজার পাওয়া যায়নি');
        btn.disabled = false; btn.textContent = 'প্রবেশ করুন';
      }
    } else {
      const name = document.getElementById('regName').value.trim();
      const gender = document.getElementById('regGender').value;
      const village = document.getElementById('regVillage').value.trim();
      const division = document.getElementById('regDivision')?.value || '';
      const { district, upazila } = getLocationValues('reg');

      if (!name) { showToast('নাম দিন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }
      if (!gender) { showToast('আপনি কি সিলেক্ট করুন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }
      if (!division) { showToast('বিভাগ সিলেক্ট করুন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }
      if (!village||!upazila||!district) { showToast('ঠিকানা সম্পূর্ণ করুন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }

      // একই নম্বরে দুটো অ্যাকাউন্ট যেন না হয় — শেষবার আবার চেক
      const existing = await getUserByPhone(phone);
      if (existing) {
        showToast('এই নম্বরে আগেই অ্যাকাউন্ট আছে!');
        isExistingUser = true;
        document.getElementById('registerFields').style.display = 'none';
        document.getElementById('authSubText').textContent = `স্বাগত ফিরে, ${existing.name}! ✅`;
        btn.disabled=false; btn.textContent='প্রবেশ করুন';
        return;
      }

      const newUser = { name, gender, division, village, upazila, district, phone, createdAt: new Date().toISOString(), role: 'user' };
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
    <div class="card" style="margin-bottom:16px;">
      <div class="text-sm text-muted">ঠিকানা</div>
      <div style="font-weight:600;">${currentUser.village||''}, ${currentUser.upazila||''}, ${currentUser.district||''}</div>
    </div>
    <button class="btn-secondary btn-full" style="margin-bottom:8px;" onclick="showEditProfile()">✏️ প্রোফাইল এডিট করুন</button>
    ${currentUser.role==='admin'?`<button class="btn-accent btn-full" style="margin-bottom:8px;" onclick="closeModal();navigate('admin')">⚙️ অ্যাডমিন প্যানেল</button>`:''}
    <button class="btn-danger btn-full" onclick="logout()">লগ আউট</button>
  `;
  showModal(html);
}

function showEditProfile() {
  const html = `
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">✏️ প্রোফাইল এডিট</div>
    <div class="input-group"><label>নাম</label><input type="text" id="editName" value="${currentUser.name||''}"></div>
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
  // ড্রপডাউন বসানো ও আগের বিভাগ/জেলা/উপজেলা প্রি-সিলেক্ট করা
  const locArea = document.getElementById('editLocationArea');
  if (locArea) {
    locArea.innerHTML = locationDropdownsHTML('edit', { upazila: currentUser.upazila });
    const division = currentUser.division || findDivisionForDistrict(currentUser.district) || '';
    if (division) preselectLocation('edit', division, currentUser.district);
  }
}

async function saveProfile() {
  const name = document.getElementById('editName').value.trim();
  const gender = document.getElementById('editGender').value;
  const village = document.getElementById('editVillage').value.trim();
  const division = document.getElementById('editDivision')?.value || currentUser.division || '';
  const { district, upazila } = getLocationValues('edit');
  if (!name) { showToast('নাম দিন'); return; }
  try {
    const update = { name, village, division, upazila, district };
    if (gender) update.gender = gender;
    await db.collection(USERS_COL).doc(currentUser.phone).update(update);
    currentUser = { ...currentUser, ...update };
    document.getElementById('userGreeting').textContent = currentUser.name.split(' ')[0];
    closeModal();
    showToast('✅ প্রোফাইল আপডেট হয়েছে!');
  } catch(e) { showToast('সমস্যা হয়েছে'); }
}
