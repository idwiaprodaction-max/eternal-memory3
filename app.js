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

// Инициализация
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ==========================================
let currentUser = null;
let userRole = 'guest';
let currentMemorialId = null;
let currentChatId = null;
let currentChatUserName = "Пользователь"; // Имя собеседника в чате
let qrScanner = null;
let chatUnsubscribe = null;

// ==========================================
// 3. НАВИГАЦИЯ И UI
// ==========================================

// Переключение страниц
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

// Обновление кнопок в меню
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
// 4. АВТОРИЗАЦИЯ
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

// Форма входа/регистрации
document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  const name = document.getElementById('reg-name').value.trim();
  const isReg = document.getElementById('auth-submit').textContent === 'Создать аккаунт';

  if (isReg && !name) return alert('Пожалуйста, введите ваше имя!');

  try {
    let cred;
    if (isReg) {
      cred = await auth.createUserWithEmailAndPassword(email, pass);
      // Сохраняем имя и роль в базе
      await db.collection('users').doc(cred.user.uid).set({
        email: email,
        name: name,
        role: 'user',
        created: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      cred = await auth.signInWithEmailAndPassword(email, pass);
    }
    window.showSection('home');
  } catch (error) {
    alert('Ошибка: ' + error.message);
  }
});

window.logout = function() {
  auth.signOut();
  window.showSection('home');
};

// Слушатель состояния авторизации
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    try {
      const doc = await db.collection('users').doc(user.uid).get();
      userRole = doc.exists ? doc.data().role : 'user';
    } catch (e) {
      userRole = 'user';
    }
  } else {
    userRole = 'guest';
  }
  updateUI();
});

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
      document.getElementById('profile-date').textContent = data.created 
        ? data.created.toDate().toLocaleDateString('ru-RU') 
        : 'Неизвестно';
    }
  } catch (e) {
    console.error(e);
  }
};

window.saveProfileName = async function() {
  if (!currentUser) return;
  const newName = document.getElementById('profile-name-input').value.trim();
  if (!newName) return alert('Введите имя');
  
  try {
    await db.collection('users').doc(currentUser.uid).update({ name: newName });
    alert('✅ Имя сохранено!');
  } catch (e) {
    alert('Ошибка: ' + e.message);
  }
};

// ==========================================
// 6. ПАМЯТНИКИ
// ==========================================

window.loadMemorial = async function(id) {
  currentMemorialId = id;
  window.showSection('memorial');
  
  // Сброс
  document.getElementById('m-name').textContent = '⏳ Загрузка...';
  document.getElementById('m-years').textContent = '';
  document.getElementById('m-bio').textContent = '';
  document.getElementById('family-tree-display').innerHTML = '';
  document.getElementById('memorial-qr').innerHTML = '';
  document.getElementById('edit-family-list').innerHTML = '';
  document.getElementById('btn-geo').classList.add('hidden');
  if(document.getElementById('auth-extra')) document.getElementById('auth-extra').classList.add('hidden');

  try {
    const doc = await db.collection('memorials').doc(id).get();
    if (!doc.exists) {
      document.getElementById('m-name').textContent = '❌ Не найдено';
      return;
    }
    
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
    if (typeof QRCode !== 'undefined') {
      new QRCode(document.getElementById('memorial-qr'), { text: url, width: 150, height: 150 });
    }
    
    if (currentUser) {
      document.getElementById('auth-extra').classList.remove('hidden');
    }

    if (userRole === 'admin') {
      document.getElementById('edit-name').value = d.name || '';
      document.getElementById('edit-years').value = d.years || '';
      document.getElementById('edit-details').value = d.details || '';
      document.getElementById('edit-lat').value = d.lat || '';
      document.getElementById('edit-lng').value = d.lng || '';
      (d.family || []).forEach(f => window.addFamilyMember('edit', f.relation, f.name, f.years));
    }
    
  } catch (e) {
    alert('Ошибка загрузки: ' + e.message);
  }
};

window.saveMemorial = async function() {
  if (userRole !== 'admin') return alert('Нет прав');
  
  const family = [];
  document.querySelectorAll('#edit-family-list > div').forEach(div => {
    family.push({
      relation: div.querySelector('.f-rel').value,
      name: div.querySelector('.f-name').value.trim(),
      years: div.querySelector('.f-years').value.trim()
    });
  });

  try {
    await db.collection('memorials').doc(currentMemorialId).set({
      name: document.getElementById('edit-name').value,
      years: document.getElementById('edit-years').value,
      details: document.getElementById('edit-details').value,
      lat: document.getElementById('edit-lat').value,
      lng: document.getElementById('edit-lng').value,
      family: family
    }, { merge: true });
    
    alert('✅ Сохранено!');
    window.loadMemorial(currentMemorialId);
  } catch (e) {
    alert('Ошибка: ' + e.message);
  }
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
    if (snap.empty) {
      div.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">📭 Памятников пока нет</p>';
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
        <button class="secondary-btn" onclick="window.loadMemorial('${doc.id}')">✏️ Редактировать</button>
      `;
      div.appendChild(card);
      
      setTimeout(() => {
        const url = `${window.location.origin}${window.location.pathname}?id=${doc.id}`;
        if (typeof QRCode !== 'undefined') {
          new QRCode(document.getElementById(`qr-${doc.id}`), { text: url, width: 80, height: 80 });
        }
      }, 50);
    });
  });
}

document.getElementById('add-memorial').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (userRole !== 'admin') return;
  
  const id = document.getElementById('new-id').value.trim();
  if (!id) return alert('Введите ID');

  const family = [];
  document.querySelectorAll('#add-family-list > div').forEach(div => {
    family.push({
      relation: div.querySelector('.f-rel').value,
      name: div.querySelector('.f-name').value.trim(),
      years: div.querySelector('.f-years').value.trim()
    });
  });

  try {
    await db.collection('memorials').doc(id).set({
      name: document.getElementById('new-name').value,
      years: document.getElementById('new-years').value,
      details: document.getElementById('new-details').value,
      lat: document.getElementById('new-lat').value,
      lng: document.getElementById('new-lng').value,
      family: family
    });
    alert('✅ Памятник добавлен!');
    e.target.reset();
    document.getElementById('add-family-list').innerHTML = '';
    window.showAdminPanel();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
});

// ==========================================
// 7. СЕМЕЙНОЕ ДРЕВО
// ==========================================

function renderFamilyTree(fam) {
  const container = document.getElementById('family-tree-display');
  if (!fam.length) {
    container.innerHTML = '<p style="color:#888; font-style:italic; grid-column: 1/-1;">Информация не добавлена</p>';
    return;
  }
  
  const map = {father:'Отец', mother:'Мать', spouse:'Супруг(а)', son:'Сын', daughter:'Дочь', brother:'Брат', sister:'Сестра'};
  
  container.innerHTML = fam.map(f => `
    <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px; border:1px solid #333;">
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
    <select class="f-rel" style="flex:1;">
      <option value="father" ${rel=='father'?'selected':''}>Отец</option>
      <option value="mother" ${rel=='mother'?'selected':''}>Мать</option>
      <option value="spouse" ${rel=='spouse'?'selected':''}>Супруг(а)</option>
      <option value="son" ${rel=='son'?'selected':''}>Сын</option>
      <option value="daughter" ${rel=='daughter'?'selected':''}>Дочь</option>
    </select>
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
    qrScanner.start(
      { facingMode: "environment" }, 
      { fps: 10, qrbox: 250 }, 
      code => {
        qrScanner.stop();
        let id = code.includes('id=') ? code.split('id=')[1].split('&')[0] : code;
        window.loadMemorial(id.trim());
      }, 
      ()=>{}
    );
  }
};
window.stopScanner = function() { 
  if (qrScanner) qrScanner.stop().catch(()=>{}); 
  window.showSection('home'); 
};

// ==========================================
// 9. ЧАТЫ (ОБНОВЛЕННЫЕ: ИМЕНА + ТЁМНАЯ ТЕМА)
// ==========================================

// Отправка сообщения (Форма)
document.getElementById('feedback-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) { alert('Войдите в аккаунт'); window.showSection('auth'); return; }
  
  const subj = document.getElementById('feedback-subject').value;
  const msg = document.getElementById('feedback-message').value;
  
  try {
    await db.collection('messages').add({
      chatId: currentUser.uid,
      sender: 'user',
      subject: subj,
      text: msg,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('✅ Отправлено!');
    e.target.reset();
    window.showSection('home');
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
});

// История сообщений (Пользователь)
window.loadUserMessages = async function() {
  if (!currentUser) return alert('Сначала войдите');
  window.showSection('user-messages');
  const list = document.getElementById('user-msg-list');
  list.innerHTML = '<p>⏳ Загрузка...</p>';
  
  try {
    const snap = await db.collection('messages').where('chatId', '==', currentUser.uid).get();
    list.innerHTML = '';
    const msgs = [];
    snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
    
    msgs.sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
    
    if (!msgs.length) { list.innerHTML = '<p>📭 Нет сообщений</p>'; return; }
    
    msgs.forEach(m => {
      const d = m.createdAt ? m.createdAt.toDate().toLocaleString('ru-RU') : '';
      const color = m.sender === 'admin' ? '#c0392b' : '#3498db'; // Красный для админа
      list.innerHTML += `
        <div class="message-card" style="border-left-color: ${color}">
          <h4>${m.subject || 'Сообщение'}</h4>
          <div class="meta">${m.sender==='admin'?'👑 Админ':'👤 Вы'} | ${d}</div>
          <div class="text">${m.text}</div>
        </div>`;
    });
  } catch(e) { alert('Ошибка: ' + e.message); }
};

// СПИСОК ЧАТОВ (АДМИН) — С ИМЕНАМИ!
window.showAdminChats = async function() {
  if (userRole !== 'admin') return alert('Доступ запрещён');
  window.showSection('admin-chats');
  const list = document.getElementById('chats-list');
  list.innerHTML = '<p>⏳ Загрузка чатов и имен...</p>';
  
  try {
    const snap = await db.collection('messages').get();
    const chats = {};
    
    snap.forEach(doc => {
      const m = doc.data();
      if (!chats[m.chatId]) chats[m.chatId] = { lastMsg: m, count: 0 };
      chats[m.chatId].count++;
      if (m.createdAt && chats[m.chatId].lastMsg.createdAt) {
         if (m.createdAt.toMillis() > chats[m.chatId].lastMsg.createdAt.toMillis()) {
            chats[m.chatId].lastMsg = m;
         }
      }
    });

    // Загружаем имена пользователей
    const userIds = Object.keys(chats);
    const namesMap = {};
    
    if (userIds.length > 0) {
      await Promise.all(userIds.map(uid => 
        db.collection('users').doc(uid).get().then(doc => {
          namesMap[uid] = doc.exists ? (doc.data().name || 'Пользователь') : uid;
        })
      ));
    }

    list.innerHTML = '';
    if (Object.keys(chats).length === 0) {
      list.innerHTML = '<p>📭 Нет обращений</p>';
      return;
    }

    Object.values(chats).forEach(chat => {
      const m = chat.lastMsg;
      const userName = namesMap[m.chatId] || m.chatId.substring(0, 8); 
      const d = m.createdAt ? m.createdAt.toDate().toLocaleString('ru-RU') : '';
      
      const div = document.createElement('div');
      div.className = 'message-card';
      div.innerHTML = `
        <h4>💬 ${userName}</h4>
        <div class="meta">📅 ${d} | Сообщений: ${chat.count}</div>
        <div class="text">${m.subject ? '📌 '+m.subject : ''} ${m.text.substring(0, 100)}...</div>
        <button class="secondary-btn" onclick="window.openChat('${m.chatId}')" style="margin-top:10px">Ответить</button>
      `;
      list.appendChild(div);
    });
  } catch(e) { alert('Ошибка: ' + e.message); }
};

// ОТКРЫТИЕ ЧАТА — ЗАГРУЖАЕТ ИМЯ
window.openChat = async function(chatId) {
  currentChatId = chatId;
  window.showSection('chat-view');
  document.getElementById('chat-input').value = '';
  document.getElementById('chat-title').textContent = '💬 Загрузка имени...';
  
  // Получаем имя пользователя
  try {
    const doc = await db.collection('users').doc(chatId).get();
    currentChatUserName = doc.exists ? (doc.data().name || 'Пользователь') : chatId;
    document.getElementById('chat-title').textContent = `💬 Чат с ${currentChatUserName}`;
  } catch(e) {
    currentChatUserName = chatId;
    document.getElementById('chat-title').textContent = `💬 Чат с ${chatId.substring(0,8)}`;
  }

  renderChat(chatId);
};

// ОТРИСОВКА СООБЩЕНИЙ (АДАПТИРОВАНА ПОД ТЁМНУЮ ТЕМУ)
function renderChat(chatId) {
  const box = document.getElementById('chat-messages');
  box.innerHTML = '<p>⏳ Загрузка...</p>';
  if (chatUnsubscribe) chatUnsubscribe();
  
  chatUnsubscribe = db.collection('messages').where('chatId', '==', chatId).onSnapshot(snap => {
    box.innerHTML = '';
    const msgs = [];
    snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
    msgs.sort((a, b) => (a.createdAt ? a.createdAt.toMillis() : 0) - (b.createdAt ? b.createdAt.toMillis() : 0));
    
    if (!msgs.length) { box.innerHTML = '<p style="text-align:center;color:#888;margin-top:50px">💬 Начало переписки</p>'; return; }
    
    msgs.forEach(m => {
      const isMe = (userRole === 'admin' && m.sender === 'admin') || (userRole !== 'admin' && m.sender === 'user');
      const align = isMe ? 'flex-end' : 'flex-start';
      
      // ЦВЕТА ДЛЯ ТЁМНОЙ ТЕМЫ
      const bg = isMe ? '#c0392b' : '#222222'; // Красный (Я) или Тёмно-серый (Собеседник)
      const textColor = isMe ? '#ffffff' : '#e0e0e0'; // Белый текст или Светлый
      const border = isMe ? 'none' : '1px solid #333';
      
      const t = m.createdAt ? m.createdAt.toDate().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}) : '';
      
      // ИСПОЛЬЗУЕМ ИМЯ
      const senderName = m.sender === 'admin' ? '👑 Админ' : currentChatUserName;

      box.innerHTML += `
        <div style="display:flex; justify-content:${align}; margin:8px 0;">
          <div style="max-width:70%; padding:10px 15px; border-radius:15px; background:${bg}; color:${textColor}; ${border}; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
            <div style="font-size:0.8em; opacity:0.7; margin-bottom:4px;">${senderName}</div>
            <div style="white-space:pre-wrap;">${m.text}</div>
            <div style="font-size:0.7em; opacity:0.5; text-align:right; margin-top:4px;">${t}</div>
          </div>
        </div>`;
    });
    box.scrollTop = box.scrollHeight;
  }, err => {
    box.innerHTML = `<p style="color:red">❌ Ошибка чата. Проверьте правила Firestore.</p>`;
  });
}

// ОТПРАВКА СООБЩЕНИЯ
window.sendChatMessage = function() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !currentChatId) return;
  
  db.collection('messages').add({
    chatId: currentChatId,
    sender: userRole,
    text: text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => { input.value = ''; });
};

document.getElementById('chat-input')?.addEventListener('keypress', e => { 
  if (e.key === 'Enter') window.sendChatMessage(); 
});

// ==========================================
// 10. ИНИЦИАЛИЗАЦИЯ
// ==========================================
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('id')) {
    setTimeout(() => window.loadMemorial(urlParams.get('id')), 500);
  }
});
