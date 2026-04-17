const firebaseConfig = {
  apiKey: "AIzaSyAgJkDzwzxrjwtBpKqSnoWD_jpfd92w0JE",
  authDomain: "eternal-memory-88f34.firebaseapp.com",
  projectId: "eternal-memory-88f34",
  storageBucket: "eternal-memory-88f34.firebasestorage.app",
  messagingSenderId: "954861065351",
  appId: "1:954861065351:web:7447617950e5714d381422"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userRole = 'guest';
let currentMemorialId = null;
let qrScanner = null;

// === НАВИГАЦИЯ ===
window.showSection = function(id) {
  document.querySelectorAll('main > section').forEach(s => {
    s.classList.add('hidden');
    s.classList.remove('active');
  });
  const target = document.getElementById(id);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
};

window.showProfile = function() {
  if (!currentUser) return;
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-role').textContent = userRole === 'admin' ? '👑 Администратор' : '👤 Пользователь';
  
  // Получаем дату регистрации
  db.collection('users').doc(currentUser.uid).get().then(doc => {
    if (doc.exists && doc.data().created) {
      const date = doc.data().created.toDate();
      document.getElementById('profile-date').textContent = date.toLocaleDateString('ru-RU');
    } else {
      document.getElementById('profile-date').textContent = 'Неизвестно';
    }
  });
  
  showSection('profile');
};

window.showAdminPanel = function() {
  if (userRole !== 'admin') return alert('Доступ запрещён');
  showSection('admin');
  loadAdminList();
};

window.showMessages = function() {
  if (userRole !== 'admin') return alert('Только для админа');
  showSection('messages');
  loadMessages();
};

// === СООБЩЕНИЯ ===
document.addEventListener('DOMContentLoaded', () => {
  const feedbackForm = document.getElementById('feedback-form');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!currentUser) {
        alert('Сначала войдите в аккаунт');
        showSection('auth');
        return;
      }
      
      const subject = document.getElementById('feedback-subject').value;
      const message = document.getElementById('feedback-message').value;
      
      db.collection('messages').add({
        userId: currentUser.uid,
        userEmail: currentUser.email,
        subject: subject,
        message: message,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      }).then(() => {
        alert('✅ Сообщение отправлено администратору!');
        document.getElementById('feedback-subject').value = '';
        document.getElementById('feedback-message').value = '';
        showSection('home');
      }).catch(err => alert('Ошибка: ' + err.message));
    });
  }
});

function loadMessages() {
  const list = document.getElementById('messages-list');
  list.innerHTML = '<p>Загрузка...</p>';
  
  db.collection('messages').orderBy('createdAt', 'desc').get().then(snap => {
    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = '<p>📭 Нет новых сообщений</p>';
      return;
    }
    
    snap.forEach(doc => {
      const m = doc.data();
      const date = m.createdAt ? m.createdAt.toDate().toLocaleString('ru-RU') : '...';
      
      const div = document.createElement('div');
      div.className = 'message-card';
      div.innerHTML = `
        <h4>${m.subject}</h4>
        <div class="meta">👤 ${m.userEmail} | 📅 ${date}</div>
        <div class="text">${m.message}</div>
        <button class="secondary-btn" style="margin-top:10px; font-size:0.9em;" 
                onclick="this.parentElement.remove(); db.collection('messages').doc('${doc.id}').delete()">
          ✓ Отмечено как прочитанное
        </button>
      `;
      list.appendChild(div);
    });
  });
}

// === QR СКАНЕР ===
window.startScanner = function() {
  showSection('scanner');
  if (window.Html5Qrcode) {
    if (qrScanner) qrScanner.stop().catch(()=>{});
    qrScanner = new Html5Qrcode("qr-reader");
    qrScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, function(code) {
      qrScanner.stop();
      let id = code.includes('id=') ? code.split('id=')[1].split('&')[0] : code;
      loadMemorial(id.trim());
    }, ()=>{});
  }
};

window.stopScanner = function() {
  if (qrScanner) qrScanner.stop().catch(()=>{});
  showSection('home');
};

// === СПИСОК АДМИНА ===
function loadAdminList() {
  const listDiv = document.getElementById('admin-list');
  listDiv.innerHTML = '<p>⏳ Загрузка...</p>';
  
  db.collection('memorials').get().then(snap => {
    listDiv.innerHTML = '';
    if (snap.empty) {
      listDiv.innerHTML = '<p>📭 Памятников нет</p>';
      return;
    }
    snap.forEach(doc => {
      const d = doc.data();
      const card = document.createElement('div');
      card.className = 'admin-card';
      card.innerHTML = `
        <h4>${d.name || 'Без имени'}</h4>
        <p>${d.years || ''}</p>
        <div id="qr-${doc.id}" style="margin:10px auto;"></div>
        <button class="secondary-btn" onclick="window.loadMemorial('${doc.id}')">✏️ Изменить</button>
      `;
      listDiv.appendChild(card);
      
      setTimeout(() => {
        const url = `${window.location.origin}${window.location.pathname}?id=${doc.id}`;
        if (typeof QRCode !== 'undefined') {
          new QRCode(document.getElementById(`qr-${doc.id}`), { text: url, width: 90, height: 90 });
        }
      }, 50);
    });
  });
}

// === ПАМЯТНИК ===
window.loadMemorial = function(id) {
  currentMemorialId = id;
  showSection('memorial');
  
  document.getElementById('m-name').textContent = '⏳ Загрузка...';
  document.getElementById('m-years').textContent = '';
  document.getElementById('m-bio').textContent = '';
  document.getElementById('family-tree-display').innerHTML = '';
  document.getElementById('memorial-qr').innerHTML = '';
  document.getElementById('edit-family-list').innerHTML = '';

  db.collection('memorials').doc(id).get().then(doc => {
    if (!doc.exists) {
      document.getElementById('m-name').textContent = '❌ Не найдено';
      return;
    }
    const d = doc.data();
    
    document.getElementById('m-name').textContent = d.name || '';
    document.getElementById('m-years').textContent = d.years || '';
    document.getElementById('m-bio').textContent = d.details || '';
    
    const geoBtn = document.getElementById('btn-geo');
    if (d.lat && d.lng) {
      geoBtn.classList.remove('hidden');
      geoBtn.onclick = () => window.open(`https://maps.google.com/?q=${d.lat},${d.lng}`, '_blank');
    } else {
      geoBtn.classList.add('hidden');
    }

    renderFamilyTree(d.family || []);
    
    const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
    if (typeof QRCode !== 'undefined') {
      new QRCode(document.getElementById('memorial-qr'), { text: url, width: 150, height: 150 });
    }

    if (userRole === 'admin') {
      document.getElementById('edit-name').value = d.name || '';
      document.getElementById('edit-years').value = d.years || '';
      document.getElementById('edit-details').value = d.details || '';
      document.getElementById('edit-lat').value = d.lat || '';
      document.getElementById('edit-lng').value = d.lng || '';
      document.getElementById('edit-family-list').innerHTML = '';
      (d.family || []).forEach(f => window.addFamilyMember('edit', f.relation, f.name, f.years));
    }
  });
};

// === СЕМЕЙНОЕ ДРЕВО ===
function renderFamilyTree(family) {
  const container = document.getElementById('family-tree-display');
  if (!family.length) { container.innerHTML = '<p style="color:#888; font-style:italic;">Нет данных</p>'; return; }
  const map = { father:'Отец', mother:'Мать', spouse:'Супруг(а)', son:'Сын', daughter:'Дочь', brother:'Брат', sister:'Сестра' };
  let html = '<ul style="list-style:none; padding-left:0;">';
  family.forEach(f => {
    html += `<li style="margin:8px 0; padding:8px; background:#f9f9f9; border-radius:5px;">
      <b>${map[f.relation]||f.relation}:</b> ${f.name} ${f.years?`<span style="color:#666">(${f.years})</span>`:''}
    </li>`;
  });
  container.innerHTML = html + '</ul>';
}

window.addFamilyMember = function(mode, rel='', name='', years='') {
  const listId = mode === 'edit' ? 'edit-family-list' : 'add-family-list';
  const div = document.createElement('div');
  div.style.cssText = "display:flex; gap:8px; margin:8px 0; align-items:center; flex-wrap:wrap;";
  div.innerHTML = `
    <select class="f-rel" style="flex:1; min-width:100px;">
      <option value="father" ${rel=='father'?'selected':''}>Отец</option>
      <option value="mother" ${rel=='mother'?'selected':''}>Мать</option>
      <option value="spouse" ${rel=='spouse'?'selected':''}>Супруг(а)</option>
      <option value="son" ${rel=='son'?'selected':''}>Сын</option>
      <option value="daughter" ${rel=='daughter'?'selected':''}>Дочь</option>
    </select>
    <input class="f-name" placeholder="ФИО" value="${name}" style="flex:2;">
    <input class="f-years" placeholder="Годы" value="${years}" style="flex:1;">
    <button type="button" class="secondary-btn" onclick="this.parentElement.remove()" style="padding:5px 10px;">✕</button>
  `;
  document.getElementById(listId).appendChild(div);
};

// === СОХРАНЕНИЕ ===
window.saveMemorial = function() {
  if (userRole !== 'admin') return alert('Нет прав');
  
  const family = [];
  document.querySelectorAll('#edit-family-list > div').forEach(div => {
    family.push({
      relation: div.querySelector('.f-rel').value,
      name: div.querySelector('.f-name').value,
      years: div.querySelector('.f-years').value
    });
  });

  db.collection('memorials').doc(currentMemorialId).set({
    name: document.getElementById('edit-name').value,
    years: document.getElementById('edit-years').value,
    details: document.getElementById('edit-details').value,
    lat: document.getElementById('edit-lat').value,
    lng: document.getElementById('edit-lng').value,
    family: family
  }, {merge: true}).then(() => {
    alert('✅ Сохранено!');
    window.loadMemorial(currentMemorialId);
  }).catch(err => alert('Ошибка: ' + err.message));
};

// === ДОБАВЛЕНИЕ ===
document.addEventListener('DOMContentLoaded', () => {
  const addForm = document.getElementById('add-memorial');
  if (addForm) {
    addForm.addEventListener('submit', e => {
      e.preventDefault();
      if (userRole !== 'admin') return;
      const id = document.getElementById('new-id').value.trim();
      if (!id) return alert('Введите ID');
      
      const family = [];
      document.querySelectorAll('#add-family-list > div').forEach(div => {
        family.push({
          relation: div.querySelector('.f-rel').value,
          name: div.querySelector('.f-name').value,
          years: div.querySelector('.f-years').value
        });
      });

      db.collection('memorials').doc(id).set({
        name: document.getElementById('new-name').value,
        years: document.getElementById('new-years').value,
        details: document.getElementById('new-details').value,
        lat: document.getElementById('new-lat').value,
        lng: document.getElementById('new-lng').value,
        family: family
      }).then(() => {
        alert('✅ Добавлено!');
        e.target.reset();
        document.getElementById('add-family-list').innerHTML = '';
        showAdminPanel();
      }).catch(err => alert('Ошибка: ' + err.message));
    });
  }
});

// === АВТОРИЗАЦИЯ ===
window.showAuth = function(mode) {
  const isReg = mode === 'register';
  document.getElementById('auth-title').textContent = isReg ? 'Регистрация' : 'Вход';
  document.getElementById('auth-submit').textContent = isReg ? 'Создать' : 'Войти';
  document.getElementById('switch-auth').textContent = isReg ? 'Есть аккаунт? Войти' : 'Нет аккаунта? Регистрация';
  showSection('auth');
};
window.toggleAuthMode = function() {
  const isReg = document.getElementById('auth-submit').textContent === 'Создать';
  showAuth(isReg ? 'login' : 'register');
};

document.getElementById('auth-form').addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  const isReg = document.getElementById('auth-submit').textContent === 'Создать';
  
  const promise = isReg 
    ? auth.createUserWithEmailAndPassword(email, pass) 
    : auth.signInWithEmailAndPassword(email, pass);
    
  promise.then(cred => {
    if (isReg) {
      db.collection('users').doc(cred.user.uid).set({ 
        email, 
        role: 'user',
        created: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    showSection('home');
  }).catch(err => alert('Ошибка: ' + err.message));
});

window.logout = function() {
  auth.signOut();
  showSection('home');
};

auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    db.collection('users').doc(user.uid).get().then(doc => {
      userRole = doc.exists ? doc.data().role : 'user';
      updateUI();
    });
  } else {
    userRole = 'guest';
    updateUI();
  }
});

function updateUI() {
  document.getElementById('btn-login').classList.toggle('hidden', !!currentUser);
  document.getElementById('btn-register').classList.toggle('hidden', !!currentUser);
  document.getElementById('btn-logout').classList.toggle('hidden', !currentUser);
  document.getElementById('btn-home').classList.toggle('hidden', !currentUser);
  document.getElementById('btn-profile').classList.toggle('hidden', !currentUser);
  document.getElementById('btn-admin').classList.toggle('hidden', userRole !== 'admin');
  document.getElementById('btn-messages').classList.toggle('hidden', userRole !== 'admin');
  
  const authExtra = document.getElementById('auth-extra');
  if (authExtra) authExtra.classList.toggle('hidden', !currentUser);
  
  const adminExtra = document.getElementById('admin-extra');
  if (adminExtra) adminExtra.classList.toggle('hidden', userRole !== 'admin');
}
