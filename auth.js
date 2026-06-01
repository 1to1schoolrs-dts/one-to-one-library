// ============================================
// AUTH - Login & Register
// ============================================

let currentUser = null;
let isNewUser = true;

async function initAuth() {
  // Check localStorage for saved phone
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
  checkIfNewUser();
}

async function checkIfNewUser() {
  const phone = document.getElementById('authPhone').value.trim();
  if (!phone || phone.length < 11) {
    showRegisterFields(true);
    return;
  }
  const user = await getUserByPhone(phone);
  if (user) {
    showRegisterFields(false);
    document.getElementById('authSubText').textContent = 'স্বাগত ফিরে! শুধু নম্বর দিয়ে প্রবেশ করুন';
    document.getElementById('authBtn').textContent = 'প্রবেশ করুন';
    isNewUser = false;
  } else {
    showRegisterFields(true);
    document.getElementById('authSubText').textContent = 'নতুন অ্যাকাউন্ট তৈরি করুন';
    document.getElementById('authBtn').textContent = 'নিবন্ধন করুন';
    isNewUser = true;
  }
}

function showRegisterFields(show) {
  document.getElementById('registerFields').style.display = show ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('authPhone');
  if (phoneInput) {
    phoneInput.addEventListener('blur', checkIfNewUser);
    phoneInput.addEventListener('input', () => {
      if (phoneInput.value.length === 11) checkIfNewUser();
    });
  }
});

async function handleAuth() {
  const phone = document.getElementById('authPhone').value.trim();
  if (!phone || phone.length < 10) {
    showToast('সঠিক মোবাইল নম্বর দিন');
    return;
  }

  const btn = document.getElementById('authBtn');
  btn.disabled = true;
  btn.textContent = '...অপেক্ষা করুন';

  try {
    const existing = await getUserByPhone(phone);

    if (existing) {
      // Login
      currentUser = existing;
      localStorage.setItem('lib_phone', phone);
      showApp();
    } else {
      // Register
      const name = document.getElementById('regName').value.trim();
      const village = document.getElementById('regVillage').value.trim();
      const upazila = document.getElementById('regUpazila').value.trim();
      const district = document.getElementById('regDistrict').value.trim();

      if (!name) { showToast('নাম দিন'); btn.disabled = false; btn.textContent = 'নিবন্ধন করুন'; return; }
      if (!village || !upazila || !district) { showToast('এলাকার তথ্য সম্পূর্ণ করুন'); btn.disabled = false; btn.textContent = 'নিবন্ধন করুন'; return; }

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
  } catch (e) {
    showToast('সমস্যা হয়েছে, আবার চেষ্টা করুন');
    console.error(e);
  }

  btn.disabled = false;
}

async function getUserByPhone(phone) {
  try {
    const doc = await db.collection(USERS_COL).doc(phone).get();
    return doc.exists ? doc.data() : null;
  } catch (e) {
    return null;
  }
}

function logout() {
  localStorage.removeItem('lib_phone');
  currentUser = null;
  closeModal();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('authPhone').value = '';
  showRegisterFields(true);
  document.getElementById('authSubText').textContent = 'স্বাগতম! প্রবেশ করতে তথ্য দিন';
  document.getElementById('authBtn').textContent = 'প্রবেশ করুন';
  isNewUser = true;
}

function showProfile() {
  if (!currentUser) return;
  const html = `
    <span class="modal-close" onclick="closeModal()">✕</span>
    <div class="modal-title">👤 আমার প্রোফাইল</div>
    <div class="card" style="margin-bottom:12px;">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">নাম</div>
      <div style="font-weight:600;">${currentUser.name}</div>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">মোবাইল</div>
      <div style="font-weight:600;">${currentUser.phone}</div>
    </div>
    <div class="card" style="margin-bottom:16px;">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">ঠিকানা</div>
      <div style="font-weight:600;">${currentUser.village || ''}, ${currentUser.upazila || ''}, ${currentUser.district || ''}</div>
    </div>
    ${currentUser.role === 'admin' ? `<button class="btn-accent btn-full" style="margin-bottom:8px;" onclick="closeModal();navigate('admin')">⚙️ অ্যাডমিন প্যানেল</button>` : ''}
    <button class="btn-danger btn-full" onclick="logout()">লগ আউট</button>
  `;
  showModal(html);
}
