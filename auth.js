// ============================================
// AUTH — Phone-first, one account per number
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
  phoneCheckDone = false;
}

let phoneTimer = null;
function onPhoneInput(val) {
  // Reset when user types
  if (phoneCheckDone) {
    phoneCheckDone = false;
    isExistingUser = false;
    document.getElementById('registerFields').style.display = 'none';
    document.getElementById('authBtn').textContent = 'পরবর্তী';
    document.getElementById('authSubText').textContent = 'স্বাগতম! প্রবেশ করতে নম্বর দিন';
  }
  clearTimeout(phoneTimer);
  if (val.length >= 11) {
    phoneTimer = setTimeout(() => checkPhone(val), 600);
  }
}

async function checkPhone(phone) {
  const btn = document.getElementById('authBtn');
  btn.textContent = '...যাচাই হচ্ছে';
  btn.disabled = true;
  try {
    const user = await getUserByPhone(phone);
    phoneCheckDone = true;
    if (user) {
      // Returning user — just enter
      isExistingUser = true;
      document.getElementById('registerFields').style.display = 'none';
      document.getElementById('authSubText').textContent = `স্বাগত ফিরে, ${user.name}! ✅`;
      btn.textContent = 'প্রবেশ করুন';
    } else {
      // New user — show registration fields
      isExistingUser = false;
      document.getElementById('registerFields').style.display = 'block';
      document.getElementById('authSubText').textContent = 'নতুন অ্যাকাউন্ট — তথ্য পূরণ করুন';
      btn.textContent = 'নিবন্ধন করুন';
    }
  } catch(e) {
    document.getElementById('authSubText').textContent = 'সংযোগ সমস্যা, আবার চেষ্টা করুন';
    btn.textContent = 'পরবর্তী';
  }
  btn.disabled = false;
}

async function handleAuth() {
  const phone = document.getElementById('authPhone').value.trim();
  if (!phone || phone.length < 10) { showToast('সঠিক মোবাইল নম্বর দিন'); return; }

  // If phone not checked yet, check first
  if (!phoneCheckDone) {
    await checkPhone(phone);
    return;
  }

  const btn = document.getElementById('authBtn');
  btn.disabled = true; btn.textContent = '...অপেক্ষা করুন';

  try {
    if (isExistingUser) {
      // Login
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
      // Register
      const name = document.getElementById('regName').value.trim();
      const village = document.getElementById('regVillage').value.trim();
      const upazila = document.getElementById('regUpazila').value.trim();
      const district = document.getElementById('regDistrict').value.trim();

      if (!name) { showToast('নাম দিন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }
      if (!village||!upazila||!district) { showToast('ঠিকানা সম্পূর্ণ করুন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }

      // Double-check number not already taken
      const existing = await getUserByPhone(phone);
      if (existing) {
        showToast('এই নম্বরে আগেই অ্যাকাউন্ট আছে!');
        isExistingUser = true;
        document.getElementById('registerFields').style.display = 'none';
        document.getElementById('authSubText').textContent = `স্বাগত ফিরে, ${existing.name}! ✅`;
        btn.disabled=false; btn.textContent='প্রবেশ করুন';
        return;
      }

      const newUser = {
        name, phone, village, upazila, district,
        createdAt: new Date().toISOString(),
        role: 'user'
      };
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
  document.getElementById('authPhone').value = '';
}

function showProfile() {
  if (!currentUser) return;
  showModal(`
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
    <button class="btn-secondary btn-full" style="margin-bottom:8px;" onclick="showEditProfile()">✏️ প্রোফাইল এডিট</button>
    <button class="btn-danger btn-full" onclick="logout()">🚪 লগ আউট</button>
  `);
}

function showEditProfile() {
  showModal(`
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">✏️ প্রোফাইল এডিট</div>
    <div class="input-group">
      <label>নাম</label>
      <input type="text" id="editName" value="${currentUser.name||''}">
    </div>
    <div class="input-group">
      <label>গ্রাম / এলাকা</label>
      <input type="text" id="editVillage" value="${currentUser.village||''}">
    </div>
    <div class="input-group">
      <label>উপজেলা</label>
      <input type="text" id="editUpazila" value="${currentUser.upazila||''}">
    </div>
    <div class="input-group">
      <label>জেলা</label>
      <input type="text" id="editDistrict" value="${currentUser.district||''}">
    </div>
    <button class="btn-primary btn-full" onclick="saveProfile()">✅ সেভ করুন</button>
  `);
}

async function saveProfile() {
  const name = document.getElementById('editName').value.trim();
  const village = document.getElementById('editVillage').value.trim();
  const upazila = document.getElementById('editUpazila').value.trim();
  const district = document.getElementById('editDistrict').value.trim();
  if (!name) { showToast('নাম দিন'); return; }
  try {
    const update = { name, village, upazila, district };
    await db.collection(USERS_COL).doc(currentUser.phone).update(update);
    currentUser = { ...currentUser, ...update };
    document.getElementById('userGreeting').textContent = currentUser.name.split(' ')[0];
    closeModal();
    showToast('✅ প্রোফাইল আপডেট হয়েছে!');
  } catch(e) { showToast('সমস্যা হয়েছে'); }
}
