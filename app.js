// ==========================================
// 1. КОНФИГУРАЦИЯ FIREBASE
// ==========================================
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
let currentChatId = null;
let currentChatUserName = "Пользователь";
let qrScanner = null;
let chatUnsubscribe = null;
let userMsgUnsubscribe = null;

// ==========================================
// 2. НАВИГАЦИЯ И UI
// ==========================================
window.showSection = function(id) {
  document.querySelectorAll('main > section').forEach(s => { s.classList.add('hidden'); s.classList.remove('active'); });
  const t = document.getElementById(id);
  if (t) { t.classList.remove('hidden'); t.classList.add('active'); window.scrollTo(0, 0); }
  if (id === 'home') loadHomeExamples();
};

function updateUI() {
  if (!currentUser) {
    document.getElementById('btn-login').classList.remove('hidden');
    document.getElementById('btn-register').classList.remove('hidden');
    document.getElementById('btn-home').classList.add('hidden');
    document.getElementById('btn-profile').classList.add('hidden');
    document.getElementById('btn-user-msgs').classList.add('hidden');
    document.getElementById('btn-admin').classList.add('hidden');
    document.getElementById('btn-admin-chats').classList.add('hidden');
    document.getElementById('btn-logout').classList.add('hidden');
    return;
  }
  document.getElementById('btn-login').classList.add('hidden');
  document.getElementById('btn-register').classList.add('hidden');
  document.getElementById('btn-home').classList.remove('hidden');
  document.getElementById('btn-profile').classList.remove('hidden');
  document.getElementById('btn-logout').classList.remove('hidden');
  
  if (userRole === 'admin') {
    document.getElementById('btn-admin').classList.remove('hidden');
    document.getElementById('btn-admin-chats').classList.remove('hidden');
    document.getElementById('btn-user-msgs').classList.add('hidden');
  } else {
    document.getElementById('btn-admin').classList.add('hidden');
    document.getElementById('btn-admin-chats').classList.add('hidden');
    document.getElementById('btn-user-msgs').classList.remove('hidden');
  }
}

// ==========================================
// 3. АВТОРИЗАЦИЯ
// ==========================================
window.showAuth = function(mode) {
  const isReg = mode === 'register';
  document.getElementById('auth-title').textContent = isReg ? 'Регистрация' : 'Вход';
  document.getElementById('auth-submit').textContent = isReg ? 'Создать аккаунт' : 'Войти';
  document.getElementById('switch-auth').textContent = isReg ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
  const nameField = document.getElementById('reg-name');
  nameField.style.display = isReg ? 'block' : 'none';
  nameField.value = ''; 
  window.showSection('auth');
};

window.toggleAuthMode = function() {
  const isReg = document.getElementById('auth-submit').textContent === 'Создать аккаунт';
  window.showAuth(isReg ? 'login' : 'register');
};

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  const name = document.getElementById('reg-name').value.trim();
  const isReg = document.getElementById('auth-submit').textContent === 'Создать аккаунт';

  if (isReg && !name) return alert('Введите ваше имя!');

  try {
    let cred;
    if (isReg) {
      cred = await auth.createUserWithEmailAndPassword(email, pass);
      await db.collection('users').doc(cred.user.uid).set({ email, name, role: 'user', created: firebase.firestore.FieldValue.serverTimestamp() });
    } else {
      cred = await auth.signInWithEmailAndPassword(email, pass);
    }
    window.showSection('home');
  } catch (error) { alert('Ошибка: ' + error.message); }
});

window.logout = function() { auth.signOut(); window.showSection('home'); };

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    try { const doc = await db.collection('users').doc(user.uid).get(); userRole = doc.exists ? doc.data().role : 'user'; } 
    catch (e) { userRole = 'user'; }
  } else { userRole = 'guest'; }
  updateUI();
  loadHomeExamples();
});

// ==========================================
// 4. ГЛАВНАЯ СТРАНИЦА С ПРИМЕРАМИ
// ==========================================
function loadHomeExamples() {
  const examples = [
    { id: 'ivanov', name: 'Иванов Иван Иванович', years: '1940 — 2015', desc: 'Ветеран труда, любящий отец' },
    { id: 'petrova', name: 'Петрова Мария Сергеевна', years: '1952 — 2020', desc: 'Учительница, бабушка троих внуков' },
    { id: 'sidorov', name: 'Сидоров Пётр Николаевич', years: '1935 — 2018', desc: 'Фронтовик, глава семьи' }
  ];
  
  const grid = document.querySelector('.examples-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  examples.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'memorial-card';
    card.onclick = (e) => {
      if (!e.target.classList.contains('edit-example-btn') && !e.target.closest('.edit-example-btn')) {
        window.loadMemorial(ex.id);
      }
    };
    
    let editBtnHtml = '';
    if (userRole === 'admin') {
      editBtnHtml = `
        <button class="edit-example-btn secondary-btn" style="margin-top:10px; font-size:0.85rem; padding:0.5rem 1rem;" 
                onclick="window.loadMemorial('${ex.id}'); return false;">
          ✏️ Редактировать
        </button>
      `;
    }
    
    card.innerHTML = `
      <h3>${ex.name}</h3>
      <p style="font-size:1.1rem; font-weight:bold; color:var(--accent);">${ex.years}</p>
      <p style="font-size:0.9rem;">${ex.desc}</p>
      ${editBtnHtml}
    `;
    grid.appendChild(card);
  });

  if (userRole === 'admin') {
    const btnContainer = document.getElementById('create-examples-btn');
    if (btnContainer) btnContainer.style.display = 'block';
  }
}

window.createExampleMemorials = async function() {
  const examples = [
    { id: 'ivanov', name: 'Иванов Иван Иванович', years: '1940 — 2015', details: 'Ветеран труда, проработал 40 лет на заводе. Любящий отец двоих детей и дедушка троих внуков.', lat: '55.7558', lng: '37.6173', family: [{ relation: 'spouse', name: 'Иванова Анна Петровна', years: '1945 — 2018' }, { relation: 'son', name: 'Иванов Сергей Иванович', years: '1970' }, { relation: 'daughter', name: 'Иванова Елена Ивановна', years: '1975' }] },
    { id: 'petrova', name: 'Петрова Мария Сергеевна', years: '1952 — 2020', details: 'Учительница начальных классов с 30-летним стажем. Вырастила двоих детей.', lat: '59.9343', lng: '30.3351', family: [{ relation: 'spouse', name: 'Петров Николай Иванович', years: '1950 — 2019' }, { relation: 'son', name: 'Петров Андрей Николаевич', years: '1975' }, { relation: 'daughter', name: 'Петрова Ольга Николаевна', years: '1980' }] },
    { id: 'sidorov', name: 'Сидоров Пётр Николаевич', years: '1935 — 2018', details: 'Фронтовик, участник Великой Отечественной войны. Награждён орденами и медалями.', lat: '55.0084', lng: '82.9357', family: [{ relation: 'spouse', name: 'Сидорова Валентина Ивановна', years: '1938' }, { relation: 'son', name: 'Сидоров Михаил Петрович', years: '1960' }, { relation: 'grandson', name: 'Сидоров Артём Михайлович', years: '1985' }] }
  ];

  let created = 0;
  for (const ex of examples) {
    const doc = await db.collection('memorials').doc(ex.id).get();
    if (!doc.exists) {
      await db.collection('memorials').doc(ex.id).set({ ...ex, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      created++;
    }
  }
  alert(`✅ Создано ${created} примеров!\nТеперь кнопки "Редактировать" работают.`);
  loadHomeExamples();
};

// ==========================================
// 5. ПРОФИЛЬ
// ==========================================
window.showProfile = async function() {
  if (!currentUser) return;
  window.showSection('profile');
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-role').textContent = userRole === 'admin' ? '👑 Администратор' : '👤 Пользователь';
  
  try {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (doc.exists) {
      const data = doc.data();
      document.getElementById('profile-name-input').value = data.name || '';
      if (data.created && data.created.toDate) {
        const date = data.created.toDate();
        document.getElementById('profile-date').textContent = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } else {
        document.getElementById('profile-date').textContent = 'Неизвестно';
      }
    } else {
      document.getElementById('profile-name-input').value = '';
      document.getElementById('profile-date').textContent = 'Неизвестно';
    }
  } catch (e) { console.error(e); document.getElementById('profile-date').textContent = 'Ошибка'; }
};

window.saveProfileName = async function() {
  if (!currentUser) return;
  const newName = document.getElementById('profile-name-input').value.trim();
  if (!newName) return alert('Введите имя');
  try { await db.collection('users').doc(currentUser.uid).update({ name: newName }); alert('✅ Имя сохранено!'); } 
  catch (e) { alert('Ошибка: ' + e.message); }
};

// ==========================================
// 6. ПАМЯТНИКИ
// ==========================================
window.loadMemorial = async function(id) {
  currentMemorialId = id;
  window.showSection('memorial');
  
  document.getElementById('m-name').textContent = '⏳ Загрузка...';
  document.getElementById('m-years').textContent = '';
  document.getElementById('m-bio').textContent = '';
  document.getElementById('family-tree-display').innerHTML = '';
  document.getElementById('memorial-qr').innerHTML = '';
  document.getElementById('edit-family-list').innerHTML = '';
  document.getElementById('btn-geo').classList.add('hidden');
  if(document.getElementById('auth-extra')) document.getElementById('auth-extra').classList.add('hidden');

  // Удаляем старую кнопку редактирования если есть
  const oldBtn = document.querySelector('.edit-memorial-btn');
  if (oldBtn) oldBtn.remove();

  try {
    const doc = await db.collection('memorials').doc(id).get();
    if (!doc.exists) { document.getElementById('m-name').textContent = '❌ Не найдено'; return; }
    const d = doc.data();
    document.getElementById('m-name').textContent = d.name || '';
    document.getElementById('m-years').textContent = d.years || '';
    document.getElementById('m-bio').textContent = d.details || 'Нет биографии';
    
    if (d.lat && d.lng) {
      const geoBtn = document.getElementById('btn-geo');
      geoBtn.classList.remove('hidden');
      geoBtn.onclick = () => window.open(`https://maps.google.com/?q=${d.lat},${d.lng}`, '_blank');
    }
    
    renderFamilyTree(d.family || []);
    const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
    if (typeof QRCode !== 'undefined') new QRCode(document.getElementById('memorial-qr'), { text: url, width: 150, height: 150 });
    
    if (currentUser) {
      document.getElementById('auth-extra').classList.remove('hidden');
      
      if (userRole === 'admin') {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-memorial-btn';
        editBtn.innerHTML = '✏️ Редактировать памятник';
        editBtn.onclick = function() {
          document.getElementById('edit-name').value = d.name || '';
          document.getElementById('edit-years').value = d.years || '';
          document.getElementById('edit-details').value = d.details || '';
          document.getElementById('edit-lat').value = d.lat || '';
          document.getElementById('edit-lng').value = d.lng || '';
          document.getElementById('edit-family-list').innerHTML = '';
          (d.family || []).forEach(f => window.addFamilyMember('edit', f.relation, f.name, f.years));
          document.getElementById('admin-extra').classList.remove('hidden');
          document.getElementById('admin-extra').scrollIntoView({ behavior: 'smooth' });
        };
        
        const feedbackSection = document.querySelector('#memorial > div:nth-child(4)');
        if (feedbackSection) feedbackSection.after(editBtn);
      }
    }

    if (userRole === 'admin') {
      document.getElementById('edit-name').value = d.name || '';
      document.getElementById('edit-years').value = d.years || '';
      document.getElementById('edit-details').value = d.details || '';
      document.getElementById('edit-lat').value = d.lat || '';
      document.getElementById('edit-lng').value = d.lng || '';
      (d.family || []).forEach(f => window.addFamilyMember('edit', f.relation, f.name, f.years));
    }
  } catch (e) { alert('Ошибка: ' + e.message); }
};

window.saveMemorial = async function() {
  if (userRole !== 'admin') return alert('Нет прав');
  const family = [];
  document.querySelectorAll('#edit-family-list > div').forEach(div => {
    family.push({ relation: div.querySelector('.f-rel').value, name: div.querySelector('.f-name').value.trim(), years: div.querySelector('.f-years').value.trim() });
  });
  try {
    await db.collection('memorials').doc(currentMemorialId).set({
      name: document.getElementById('edit-name').value, years: document.getElementById('edit-years').value, 
      details: document.getElementById('edit-details').value, lat: document.getElementById('edit-lat').value, 
      lng: document.getElementById('edit-lng').value, family: family
    }, { merge: true });
    alert('✅ Сохранено!'); window.loadMemorial(currentMemorialId);
  } catch (e) { alert('Ошибка: ' + e.message); }
};

window.deleteMemorial = async function() {
  if (userRole !== 'admin') return;
  if (!confirm('⚠️ Удалить этот памятник навсегда?')) return;
  try { await db.collection('memorials').doc(currentMemorialId).delete(); alert('🗑️ Удалено'); window.showAdminPanel(); } 
  catch (e) { alert('Ошибка: ' + e.message); }
};

window.showAdminPanel = function() {
  if (userRole !== 'admin') return alert('Доступ запрещён');
  window.showSection('admin');
  loadAdminList();
};

function loadAdminList() {
  const div = document.getElementById('admin-list');
  div.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">⏳ Загрузка...</p>';
  db.collection('memorials').get().then(snap => {
    div.innerHTML = '';
    if (snap.empty) { div.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">📭 Памятников пока нет</p>'; return; }
    snap.forEach(doc => {
      const d = doc.data();
      const card = document.createElement('div');
      card.className = 'admin-card';
      card.innerHTML = `
        <h4>${d.name || 'Без имени'}</h4>
        <p>${d.years || ''}</p>
        <div id="qr-${doc.id}" style="margin:10px auto;"></div>
        <div style="display:flex; gap:0.5rem; justify-content:center; margin-top:10px;">
          <button class="secondary-btn" onclick="window.loadMemorial('${doc.id}')">✏️ Изменить</button>
          <button class="secondary-btn" style="color:#ef4444; border-color:#ef4444;" onclick="window.deleteMemorialById('${doc.id}')">🗑️ Удалить</button>
        </div>
      `;
      div.appendChild(card);
      setTimeout(() => {
        const url = `${window.location.origin}${window.location.pathname}?id=${doc.id}`;
        if (typeof QRCode !== 'undefined') new QRCode(document.getElementById(`qr-${doc.id}`), { text: url, width: 80, height: 80 });
      }, 50);
    });
  });
}

window.deleteMemorialById = async function(id) {
  if (!confirm('Удалить навсегда?')) return;
  try { await db.collection('memorials').doc(id).delete(); loadAdminList(); } 
  catch (e) { alert('Ошибка: ' + e.message); }
};

document.getElementById('add-memorial').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (userRole !== 'admin') return;
  const id = document.getElementById('new-id').value.trim();
  if (!id) return alert('Введите ID');
  const family = [];
  document.querySelectorAll('#add-family-list > div').forEach(div => {
    family.push({ relation: div.querySelector('.f-rel').value, name: div.querySelector('.f-name').value.trim(), years: div.querySelector('.f-years').value.trim() });
  });
  try {
    await db.collection('memorials').doc(id).set({
      name: document.getElementById('new-name').value, years: document.getElementById('new-years').value, 
      details: document.getElementById('new-details').value, lat: document.getElementById('new-lat').value, 
      lng: document.getElementById('new-lng').value, family: family
    });
    alert('✅ Добавлено!'); e.target.reset(); document.getElementById('add-family-list').innerHTML = ''; window.showAdminPanel();
  } catch (err) { alert('Ошибка: ' + err.message); }
});

// ==========================================
// 7. СЕМЕЙНОЕ ДРЕВО
// ==========================================
function renderFamilyTree(fam) {
  const c = document.getElementById('family-tree-display');
  if (!fam.length) { c.innerHTML = '<p style="color:#888; font-style:italic;">Нет данных</p>'; return; }
  const map = {father:'Отец', mother:'Мать', spouse:'Супруг(а)', son:'Сын', daughter:'Дочь', brother:'Брат', sister:'Сестра'};
  c.innerHTML = fam.map(f => `
    <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px; border:1px solid #333; color:#fff;">
      <strong style="color:var(--accent); display:block; margin-bottom:0.25rem;">${map[f.relation] || f.relation}</strong>
      <span>${f.name}</span>
      ${f.years ? `<span style="display:block; font-size:0.85rem; color:#888;">(${f.years})</span>` : ''}
    </div>
  `).join('');
}

window.addFamilyMember = function(mode, rel='', name='', years='') {
  const listId = mode === 'edit' ? 'edit-family-list' : 'add-family-list';
  const div = document.createElement('div');
  div.style.cssText = "display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center;";
  div.innerHTML = `
    <select class="f-rel" style="flex:1;"><option value="father" ${rel=='father'?'selected':''}>Отец</option><option value="mother" ${rel=='mother'?'selected':''}>Мать</option><option value="spouse" ${rel=='spouse'?'selected':''}>Супруг(а)</option><option value="son" ${rel=='son'?'selected':''}>Сын</option><option value="daughter" ${rel=='daughter'?'selected':''}>Дочь</option></select>
    <input class="f-name" placeholder="ФИО" value="${name}" style="flex:2;">
    <input class="f-years" placeholder="Годы" value="${years}" style="flex:1;">
    <button type="button" class="secondary-btn" onclick="this.parentElement.remove()" style="padding:0.5rem;">✕</button>
  `;
  document.getElementById(listId).appendChild(div);
};

// ==========================================
// 8. QR СКАНЕР
// ==========================================
window.startScanner = function() {
  window.showSection('scanner');
  if (typeof Html5Qrcode !== 'undefined') {
    if (qrScanner) qrScanner.stop().catch(()=>{});
    qrScanner = new Html5Qrcode("qr-reader");
    qrScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, code => {
      qrScanner.stop();
      let id = code.includes('id=') ? code.split('id=')[1].split('&')[0] : code;
      window.loadMemorial(id.trim());
    }, ()=>{});
  }
};
window.stopScanner = function() { if (qrScanner) qrScanner.stop().catch(()=>{}); window.showSection('home'); };

// ==========================================
// 9. ЧАТЫ + 🗑️ УДАЛЕНИЕ СООБЩЕНИЙ
// ==========================================
document.getElementById('feedback-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) { alert('Войдите'); window.showSection('auth'); return; }
  try {
    await db.collection('messages').add({ chatId: currentUser.uid, sender: 'user', subject: document.getElementById('feedback-subject').value, text: document.getElementById('feedback-message').value, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    alert('✅ Отправлено!'); e.target.reset(); window.showSection('home');
  } catch (err) { alert('Ошибка: ' + err.message); }
});

window.loadUserMessages = function() {
  if (!currentUser) return alert('Войдите');
  window.showSection('user-messages');
  const list = document.getElementById('user-msg-list');
  list.innerHTML = '<p>⏳ Загрузка...</p>';
  if (userMsgUnsubscribe) userMsgUnsubscribe();

  userMsgUnsubscribe = db.collection('messages').where('chatId', '==', currentUser.uid).orderBy('createdAt', 'desc').onSnapshot(snap => {
    list.innerHTML = '';
    const msgs = []; snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
    msgs.sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
    if (!msgs.length) { list.innerHTML = '<p>📭 Нет сообщений</p>'; return; }
    msgs.forEach(m => {
      const d = m.createdAt ? m.createdAt.toDate().toLocaleString('ru-RU') : '';
      const c = m.sender === 'admin' ? '#c0392b' : '#3498db';
      list.innerHTML += `<div class="message-card" style="border-left-color: ${c}"><h4>${m.subject || 'Сообщение'}</h4><div class="meta">${m.sender==='admin'?'👑 Админ':'👤 Вы'} | ${d}</div><div class="text">${m.text}</div></div>`;
    });
  }, err => { list.innerHTML = `<p style="color:red">❌ Ошибка</p>`; });
};

window.showAdminChats = async function() {
  if (userRole !== 'admin') return alert('Доступ запрещён');
  window.showSection('admin-chats');
  const list = document.getElementById('chats-list');
  list.innerHTML = '<p>⏳ Загрузка...</p>';
  try {
    const snap = await db.collection('messages').get();
    const chats = {};
    snap.forEach(doc => {
      const m = doc.data();
      if (!chats[m.chatId]) chats[m.chatId] = { lastMsg: m, count: 0 };
      chats[m.chatId].count++;
      if (m.createdAt && chats[m.chatId].lastMsg.createdAt && m.createdAt.toMillis() > chats[m.chatId].lastMsg.createdAt.toMillis()) chats[m.chatId].lastMsg = m;
    });
    const namesMap = {};
    await Promise.all(Object.keys(chats).map(uid => db.collection('users').doc(uid).get().then(d => namesMap[uid] = d.exists ? (d.data().name || 'Пользователь') : uid)));
    
    list.innerHTML = '';
    if (!Object.keys(chats).length) { list.innerHTML = '<p>📭 Нет обращений</p>'; return; }
    Object.values(chats).forEach(chat => {
      const m = chat.lastMsg;
      const div = document.createElement('div'); div.className = 'message-card';
      div.innerHTML = `<h4>💬 ${namesMap[m.chatId] || m.chatId.substring(0,8)}</h4><div class="text">${m.subject ? '📌 '+m.subject : ''} ${m.text.substring(0, 50)}...</div><button class="secondary-btn" onclick="window.openChat('${m.chatId}')" style="margin-top:10px">Ответить</button>`;
      list.appendChild(div);
    });
  } catch(e) { alert('Ошибка: ' + e.message); }
};

window.openChat = async function(chatId) {
  currentChatId = chatId;
  window.showSection('chat-view');
  document.getElementById('chat-input').value = '';
  document.getElementById('chat-title').textContent = '💬 Загрузка...';
  try {
    const doc = await db.collection('users').doc(chatId).get();
    currentChatUserName = doc.exists ? (doc.data().name || 'Пользователь') : chatId;
    document.getElementById('chat-title').textContent = `💬 Чат с ${currentChatUserName}`;
  } catch(e) { currentChatUserName = chatId; document.getElementById('chat-title').textContent = `💬 Чат с ${chatId.substring(0,8)}`; }
  renderChat(chatId);
};

// ✅ ОТРИСОВКА ЧАТА С КНОПКОЙ УДАЛЕНИЯ
function renderChat(chatId) {
  const box = document.getElementById('chat-messages');
  box.innerHTML = '<p>⏳ Загрузка...</p>';
  if (chatUnsubscribe) chatUnsubscribe();
  
  chatUnsubscribe = db.collection('messages').where('chatId', '==', chatId).onSnapshot(snap => {
    box.innerHTML = '';
    const msgs = []; snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
    msgs.sort((a, b) => (a.createdAt ? a.createdAt.toMillis() : 0) - (b.createdAt ? b.createdAt.toMillis() : 0));
    
    if (!msgs.length) { box.innerHTML = '<p style="text-align:center;color:#888;margin-top:50px">💬 Начало переписки</p>'; return; }
    
    msgs.forEach(m => {
      const isMe = (userRole === 'admin' && m.sender === 'admin') || (userRole !== 'admin' && m.sender === 'user');
      const align = isMe ? 'flex-end' : 'flex-start';
      const bg = isMe ? '#c0392b' : '#2a2a2a'; 
      const textColor = '#ffffff'; 
      const border = isMe ? 'none' : '1px solid #444';
      const timeColor = isMe ? 'rgba(255,255,255,0.7)' : '#888';
      const t = m.createdAt ? m.createdAt.toDate().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}) : '';
      const senderName = m.sender === 'admin' ? '👑 Админ' : currentChatUserName;

      // 🗑️ Кнопка удаления (только для админа)
      let deleteBtn = '';
      if (userRole === 'admin') {
        deleteBtn = `<button onclick="window.deleteMessage('${m.id}')" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:1.1em; margin-left:6px; opacity:0.5; transition:0.2s; padding:0;" title="Удалить сообщение">🗑️</button>`;
      }

      box.innerHTML += `<div style="display:flex; justify-content:${align}; margin:8px 0; align-items:flex-end;">
        <div style="max-width:75%; padding:12px 16px; border-radius:18px; background:${bg}; color:${textColor}; ${border}; box-shadow:0 4px 12px rgba(0,0,0,0.3); display:flex; align-items:flex-end; gap:6px;">
          <div style="flex:1; min-width:0;">
            <div style="font-size:0.8em; opacity:0.8; margin-bottom:4px; font-weight:bold;">${senderName}</div>
            <div style="white-space:pre-wrap; line-height:1.5; word-break:break-word;">${m.text}</div>
            <div style="font-size:0.7em; color:${timeColor}; text-align:right; margin-top:6px;">${t}</div>
          </div>
          ${deleteBtn}
        </div>
      </div>`;
    });
    box.scrollTop = box.scrollHeight;
  }, err => { box.innerHTML = `<p style="color:#ef4444">❌ Ошибка чата</p>`; });
}

// ✅ ФУНКЦИЯ УДАЛЕНИЯ СООБЩЕНИЯ
window.deleteMessage = async function(msgId) {
  if (userRole !== 'admin') return;
  if (!confirm('🗑️ Удалить это сообщение навсегда?')) return;
  try {
    await db.collection('messages').doc(msgId).delete();
    // onSnapshot автоматически уберёт сообщение из чата у всех
  } catch (e) {
    alert('Ошибка удаления: ' + e.message);
  }
};

window.sendChatMessage = function() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !currentChatId) {
    if(!currentChatId) alert("Ошибка: Не выбран чат");
    return;
  }
  db.collection('messages').add({ chatId: currentChatId, sender: userRole, text: text, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(() => { input.value = ''; });
};

document.getElementById('chat-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') window.sendChatMessage(); });

window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('id')) setTimeout(() => window.loadMemorial(urlParams.get('id')), 500);
});
