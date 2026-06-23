// ============================================
// AUTH - Login & Register
// ============================================

let currentUser = null;

async function initAuth() {
  const savedPhone = localStorage.getItem('lib_phone');
  if (savedPhone) {
    const user = await getUserByPhone(savedPhone);
    if (user) {
      currentUser = user;
      showApp();
      return;
    }
  }
  showAuthScreen();
}

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  showRegisterFields(true);
  document.getElementById('authSubText').textContent = 'স্বাগতম! প্রবেশ করতে তথ্য দিন';
  document.getElementById('authBtn').textContent = 'প্রবেশ করুন';
}

function showRegisterFields(show) {
  document.getElementById('registerFields').style.display = show ? 'block' : 'none';
}

// Phone input: check if user exists on blur
document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('authPhone');
  if (phoneInput) {
    phoneInput.addEventListener('blur', checkIfReturning);
  }
});

async function checkIfReturning() {
  const phone = document.getElementById('authPhone').value.trim();
  if (phone.length < 10) return;
  const user = await getUserByPhone(phone);
  if (user) {
    showRegisterFields(false);
    document.getElementById('authSubText').textContent = `স্বাগত ফিরে, ${user.name}! শুধু নম্বর দিয়ে ঢুকুন`;
    document.getElementById('authBtn').textContent = 'প্রবেশ করুন';
  } else {
    showRegisterFields(true);
    document.getElementById('authSubText').textContent = 'নতুন অ্যাকাউন্ট তৈরি করুন';
    document.getElementById('authBtn').textContent = 'নিবন্ধন করুন';
  }
}

async function handleAuth() {
  const phone = document.getElementById('authPhone').value.trim();
  if (!phone || phone.length < 10) { showToast('সঠিক মোবাইল নম্বর দিন'); return; }

  const btn = document.getElementById('authBtn');
  btn.disabled = true; btn.textContent = '...অপেক্ষা করুন';

  try {
    const existing = await getUserByPhone(phone);
    if (existing) {
      currentUser = existing;
      localStorage.setItem('lib_phone', phone);
      showApp();
    } else {
      const name = document.getElementById('regName').value.trim();
      const village = document.getElementById('regVillage').value.trim();
      const upazila = document.getElementById('regUpazila').value.trim();
      const district = document.getElementById('regDistrict').value.trim();
      if (!name) { showToast('নাম দিন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }
      if (!village||!upazila||!district) { showToast('এলাকার তথ্য দিন'); btn.disabled=false; btn.textContent='নিবন্ধন করুন'; return; }

      const newUser = { name, phone, village, upazila, district, createdAt: new Date().toISOString(), role: 'user' };
      await db.collection(USERS_COL).doc(phone).set(newUser);
      currentUser = newUser;
      localStorage.setItem('lib_phone', phone);
      showApp();
    }
  } catch(e) {
    showToast('সমস্যা হয়েছে: ' + e.message);
    btn.disabled=false; btn.textContent='প্রবেশ করুন';
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

// ---- PROFILE ----
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
    <button class="btn-primary btn-full" onclick="saveProfile()">সেভ করুন</button>
  `;
  showModal(html);
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
