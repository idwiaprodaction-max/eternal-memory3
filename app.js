// === КОНФИГУРАЦИЯ FIREBASE ===
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

// Глобальные переменные
let currentUser = null;
let userRole = 'guest';
let currentMemorialId = null;
let currentChatId = null;
let currentChatUserName = "Пользователь"; // Имя собеседника
let qrScanner = null;
let chatUnsubscribe = null;

// === 🟢 НАВИГАЦИЯ И UI ===
window.showSection = function(id) {
  document.querySelectorAll('main > section').forEach(s => { s.classList.add('hidden'); s.classList.remove('active'); });
  const t = document.getElementById(id);
  if(t) { t.classList.remove('hidden'); t.classList.add('active'); window.scrollTo(0,0); }
};

function updateUI() {
  if(!currentUser) return;
  // Показываем кнопки авторизованным
  document.getElementById('btn-logout').classList.remove('hidden');
  document.getElementById('btn-home').classList.remove('hidden');
  document.getElementById('btn-profile').classList.remove('hidden');
  document.getElementById('btn-login').classList.add('hidden');
  document.getElementById('btn-register').classList.add('hidden');
  
  // Кнопки по ролям
  if (userRole === 'admin') {
    document.getElementById('btn-admin').classList.remove('hidden');
    document.getElementById('btn-admin-chats').classList.remove('hidden');
    document.getElementById('btn-user-msgs').classList.add('hidden');
  } else {
    document.getElementById('btn-admin').classList.add('hidden');
    document.getElementById('btn-admin-chats').classList.add('hidden');
    document.getElementById('btn-user-msgs').classList.remove('hidden');
  }
  
  // Поля админа на странице памятника
  const adminPanel = document.getElementById('admin-extra');
  if(adminPanel) adminPanel.classList.toggle('hidden', userRole !== 'admin');
  
  // Доп. инфо для авторизованных
  const authExtra = document.getElementById('auth-extra');
  if(authExtra) authExtra.classList.remove('hidden');
}

// === 🟢 ПРОФИЛЬ И ИМЯ ===
window.showProfile = async function() {
  if(!currentUser) return;
  showSection('profile');
  
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-role').textContent = userRole === 'admin' ? '👑 Администратор' : '👤 Пользователь';
  
  // Получаем имя из базы
  try {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if(doc.exists) {
      const d = doc.data();
      document.getElementById('profile-name-input').value = d.name || '';
      document.getElementById('profile-date').textContent = d.created ? d.created.toDate().toLocaleDateString('ru-RU') : '...';
    }
  } catch(e) { console.error(e); }
};

window.saveProfileName = async function() {
  if(!currentUser) return;
  const newName = document.getElementById('profile-name-input').value.trim();
  if(!newName) return alert('Введите имя');
  
  try {
    await db.collection('users').doc(currentUser.uid).update({ name: newName });
    alert('✅ Имя сохранено!');
  } catch(e) { alert('Ошибка сохранения: ' + e.message); }
};

// === 🟢 АВТОРИЗАЦИЯ (С ИМЕНЕМ) ===
window.showAuth = function(mode) {
  const isReg = mode === 'register';
  document.getElementById('auth-title').textContent = isReg ? 'Регистрация' : 'Вход';
  document.getElementById('auth-submit').textContent = isReg ? 'Создать аккаунт' : 'Войти';
  document.getElementById('switch-auth').textContent = isReg ? 'Уже есть? Войти' : 'Нет аккаунта? Регистрация';
  document.getElementById('reg-name').style.display = isReg ? 'block' : 'none';
  document.getElementById('reg-name').value = ''; 
  showSection('auth');
};

window.toggleAuthMode = function() {
  const isReg = document.getElementById('auth-submit').textContent === 'Создать аккаунт';
  window.showAuth(isReg ? 'login' : 'register');
};

document.getElementById('auth-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  const name = document.getElementById('reg-name').value.trim();
  const isReg = document.getElementById('auth-submit').textContent === 'Создать аккаунт';
  
  document.getElementById('reg-name').style.display = isReg ? 'block' : 'none';
  if(isReg && !name) return alert('Введите ваше имя!');

  try {
    const cred = isReg 
      ? await auth.createUserWithEmailAndPassword(email, pass)
      : await auth.signInWithEmailAndPassword(email, pass);
    
    if(isReg) {
      await db.collection('users').doc(cred.user.uid).set({ 
        email, name, role: 'user', created: firebase.firestore.FieldValue.serverTimestamp() 
      });
    }
    showSection('home');
  } catch(e) { alert('Ошибка: ' + e.message); }
});

window.logout = function() { auth.signOut(); window.showSection('home'); };

// === 🟢 СЛЕЖЕНИЕ ЗА АВТОРИЗАЦИЕЙ ===
auth.onAuthStateChanged(async u => {
  currentUser = u;
  if(u) {
    try {
      const d = await db.collection('users').doc(u.uid).get();
      userRole = d.exists ? d.data().role : 'user';
    } catch(e) { userRole = 'user'; }
  } else {
    userRole = 'guest';
  }
  updateUI();
});

// === 🟢 QR СКАНЕР ===
window.startScanner = function() {
  window.showSection('scanner');
  if(typeof Html5Qrcode !== 'undefined') {
    if(qrScanner) qrScanner.stop().catch(()=>{});
    qrScanner = new Html5Qrcode("qr-reader");
    qrScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, code => {
      qrScanner.stop();
      let id = code.includes('id=') ? code.split('id=')[1].split('&')[0] : code;
      window.loadMemorial(id.trim());
    }, ()=>{});
  }
};
window.stopScanner = function() { if(qrScanner) qrScanner.stop().catch(()=>{}); window.showSection('home'); };

// === 🟢 ПАМЯТНИКИ (CRUD) ===
window.loadMemorial = async function(id) {
  currentMemorialId = id;
  window.showSection('memorial');
  document.getElementById('m-name').textContent = '⏳ Загрузка...';
  
  try {
    const doc = await db.collection('memorials').doc(id).get();
    if(!doc.exists) { document.getElementById('m-name').textContent = '❌ Не найдено'; return; }
    
    const d = doc.data();
    document.getElementById('m-name').textContent = d.name||'';
    document.getElementById('m-years').textContent = d.years||'';
    document.getElementById('m-bio').textContent = d.details||'';
    
    // Гео
    const geo = document.getElementById('btn-geo');
    if(d.lat && d.lng) { geo.classList.remove('hidden'); geo.onclick = () => window.open(`https://maps.google.com/?q=${d.lat},${d.lng}`, '_blank'); }
    else geo.classList.add('hidden');

    // Дерево
    renderFamilyTree(d.family||[]);
    
    // QR
    const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
    document.getElementById('memorial-qr').innerHTML = '';
    if(typeof QRCode !== 'undefined') new QRCode(document.getElementById('memorial-qr'), { text: url, width: 150, height: 150 });

    // Заполнение полей админа
    if(userRole === 'admin') {
      document.getElementById('edit-name').value = d.name||'';
      document.getElementById('edit-years').value = d.years||'';
      document.getElementById('edit-details').value = d.details||'';
      document.getElementById('edit-lat').value = d.lat||'';
      document.getElementById('edit-lng').value = d.lng||'';
      document.getElementById('edit-family-list').innerHTML = '';
      (d.family||[]).forEach(f => window.addFamilyMember('edit', f.relation, f.name, f.years));
    }
  } catch(e) { alert('Ошибка: ' + e.message); }
};

function renderFamilyTree(fam) {
  const c = document.getElementById('family-tree-display');
  if(!fam.length) { c.innerHTML = '<p style="color:#888; font-style:italic;">Нет данных</p>'; return; }
  const map = {father:'Отец', mother:'Мать', spouse:'Супруг(а)', son:'Сын', daughter:'Дочь', brother:'Брат', sister:'Сестра'};
  c.innerHTML = '<ul style="list-style:none; padding:0;">' + fam.map(f => `<li style="margin:8px 0; padding:8px; background:#f9f9f9; border-radius:5px;"><b>${map[f.relation]||f.relation}:</b> ${f.name} ${f.years?`<span style="color:#666">(${f.years})</span>`:''}</li>`).join('') + '</ul>';
}

window.addFamilyMember = function(mode, rel='', name='', years='') {
  const id = mode==='edit' ? 'edit-family-list' : 'add-family-list';
  const div = document.createElement('div');
  div.style.cssText = "display:flex; gap:8px; margin:8px 0; align-items:center; flex-wrap:wrap;";
  div.innerHTML = `<select class="f-rel" style="flex:1; min-width:100px;"><option value="father" ${rel=='father'?'selected':''}>Отец</option><option value="mother" ${rel=='mother'?'selected':''}>Мать</option><option value="spouse" ${rel=='spouse'?'selected':''}>Супруг(а)</option><option value="son" ${rel=='son'?'selected':''}>Сын</option><option value="daughter" ${rel=='daughter'?'selected':''}>Дочь</option></select><input class="f-name" placeholder="ФИО" value="${name}" style="flex:2;"><input class="f-years" placeholder="Годы" value="${years}" style="flex:1;"><button type="button" class="secondary-btn" onclick="this.parentElement.remove()" style="padding:5px 10px;">✕</button>`;
  document.getElementById(id).appendChild(div);
};

window.saveMemorial = async function() {
  if(userRole !== 'admin') return alert('Нет прав');
  const fam = [];
  document.querySelectorAll('#edit-family-list > div').forEach(d => fam.push({relation: d.querySelector('.f-rel').value, name: d.querySelector('.f-name').value, years: d.querySelector('.f-years').value}));
  
  try {
    await db.collection('memorials').doc(currentMemorialId).set({
      name: document.getElementById('edit-name').value, 
      years: document.getElementById('edit-years').value, 
      details: document.getElementById('edit-details').value, 
      lat: document.getElementById('edit-lat').value, 
      lng: document.getElementById('edit-lng').value, 
      family: fam
    }, {merge:true});
    alert('✅ Сохранено!'); 
    window.loadMemorial(currentMemorialId);
  } catch(e) { alert('Ошибка: ' + e.message); }
};

window.showAdminPanel = function() {
  if(userRole !== 'admin') return alert('Доступ запрещён');
  window.showSection('admin');
  loadAdminList();
};

function loadAdminList() {
  const div = document.getElementById('admin-list');
  div.innerHTML = '<p>⏳ Загрузка...</p>';
  db.collection('memorials').get().then(snap => {
    div.innerHTML = '';
    if(snap.empty) { div.innerHTML = '<p>📭 Пусто</p>'; return; }
    snap.forEach(doc => {
      const d = doc.data();
      const card = document.createElement('div');
      card.className = 'admin-card';
      card.innerHTML = `<h4>${d.name||'Без имени'}</h4><p>${d.years||''}</p><div id="qr-${doc.id}" style="margin:10px auto;"></div><button class="secondary-btn" onclick="window.loadMemorial('${doc.id}')">✏️ Изменить</button>`;
      div.appendChild(card);
      setTimeout(() => {
        const url = `${window.location.origin}${window.location.pathname}?id=${doc.id}`;
        if(typeof QRCode !== 'undefined') new QRCode(document.getElementById(`qr-${doc.id}`), { text: url, width: 90, height: 90 });
      }, 50);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const af = document.getElementById('add-memorial');
  if(af) {
    af.addEventListener('submit', e => {
      e.preventDefault();
      if(userRole !== 'admin') return;
      const id = document.getElementById('new-id').value.trim();
      if(!id) return alert('Введите ID');
      const fam = [];
      document.querySelectorAll('#add-family-list > div').forEach(d => fam.push({relation: d.querySelector('.f-rel').value, name: d.querySelector('.f-name').value, years: d.querySelector('.f-years').value}));
      db.collection('memorials').doc(id).set({name: document.getElementById('new-name').value, years: document.getElementById('new-years').value, details: document.getElementById('new-details').value, lat: document.getElementById('new-lat').value, lng: document.getElementById('new-lng').value, family: fam}).then(() => { alert('✅ Добавлено!'); e.target.reset(); document.getElementById('add-family-list').innerHTML = ''; window.showAdminPanel(); }).catch(e => alert('Ошибка: '+e.message));
    });
  }
});

// === 🟢 ЧАТЫ (ИСПРАВЛЕННЫЕ) ===

// Отправка сообщения пользователем
document.addEventListener('DOMContentLoaded', () => {
  const fbForm = document.getElementById('feedback-form');
  if(fbForm) {
    fbForm.addEventListener('submit', e => {
      e.preventDefault();
      if(!currentUser) { alert('Войдите в аккаунт'); window.showSection('auth'); return; }
      const subj = document.getElementById('feedback-subject').value;
      const msg = document.getElementById('feedback-message').value;
      
      db.collection('messages').add({ chatId: currentUser.uid, sender: 'user', subject: subj, text: msg, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
      .then(() => { alert('✅ Отправлено!'); fbForm.reset(); window.showSection('home'); })
      .catch(err => alert('Ошибка: ' + err.message));
    });
  }
});

// История сообщений (Пользователь)
window.loadUserMessages = async function() {
  if(!currentUser) return alert('Сначала войдите');
  window.showSection('user-messages');
  const list = document.getElementById('user-msg-list');
  list.innerHTML = '<p>⏳ Загрузка...</p>';
  
  try {
    const snap = await db.collection('messages').where('chatId', '==', currentUser.uid).get();
    list.innerHTML = '';
    const msgs = [];
    snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
    msgs.sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
    if(!msgs.length) { list.innerHTML = '<p>📭 Нет обращений</p>'; return; }
    msgs.forEach(m => {
      const d = m.createdAt ? m.createdAt.toDate().toLocaleString('ru-RU') : '';
      const c = m.sender === 'admin' ? '#2ecc71' : '#3498db';
      list.innerHTML += `<div class="message-card" style="border-left-color: ${c}"><h4>${m.subject||'Сообщение'}</h4><div class="meta">${m.sender==='admin'?'👑 Админ':'👤 Вы'} | ${d}</div><div class="text">${m.text}</div></div>`;
    });
  } catch(e) { alert('Ошибка: ' + e.message); }
};

// Список чатов (Админ) - С ЗАГРУЗКОЙ ИМЕН
window.showAdminChats = async function() {
  if(userRole !== 'admin') return alert('Доступ запрещён');
  window.showSection('admin-chats');
  const list = document.getElementById('chats-list');
  list.innerHTML = '<p>⏳ Загрузка чатов и имен...</p>';
  
  try {
    const snap = await db.collection('messages').get();
    const chats = {};
    
    snap.forEach(doc => {
      const m = doc.data();
      if (!chats[m.chatId]) {
        chats[m.chatId] = { lastMsg: m, count: 0 };
      }
      chats[m.chatId].count++;
      if (m.createdAt && chats[m.chatId].lastMsg.createdAt) {
         if (m.createdAt.toMillis() > chats[m.chatId].lastMsg.createdAt.toMillis()) {
            chats[m.chatId].lastMsg = m;
         }
      }
    });

    // Получаем имена
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
        <div class="text">${m.subject ? '📌 '+m.subject : ''} ${m.text.substring(0, 100)}${m.text.length > 100 ? '...' : ''}</div>
        <button class="secondary-btn" onclick="window.openChat('${m.chatId}')" style="margin-top:10px">Ответить</button>
      `;
      list.appendChild(div);
    });
  } catch(e) { alert('Ошибка: ' + e.message); }
};

// Открытие чата (С ЗАГРУЗКОЙ ИМЕНИ)
window.openChat = async function(chatId) {
  currentChatId = chatId;
  window.showSection('chat-view');
  document.getElementById('chat-input').value = '';
  document.getElementById('chat-title').textContent = '💬 Загрузка...';
  
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

// Отрисовка сообщений
function renderChat(chatId) {
  const box = document.getElementById('chat-messages');
  box.innerHTML = '<p>⏳ Загрузка...</p>';
  if(chatUnsubscribe) chatUnsubscribe();
  
  chatUnsubscribe = db.collection('messages').where('chatId', '==', chatId).onSnapshot(snap => {
    box.innerHTML = '';
    const msgs = [];
    snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
    msgs.sort((a, b) => (a.createdAt ? a.createdAt.toMillis() : 0) - (b.createdAt ? b.createdAt.toMillis() : 0));
    
    if(!msgs.length) { box.innerHTML = '<p style="text-align:center;color:#888;margin-top:50px">💬 Начало переписки</p>'; return; }
    
    msgs.forEach(m => {
      const isMe = (userRole === 'admin' && m.sender === 'admin') || (userRole !== 'admin' && m.sender === 'user');
      const align = isMe ? 'flex-end' : 'flex-start';
      const bg = isMe ? '#dcf8c6' : '#ffffff';
      const border = isMe ? 'border:1px solid #a5d6a7' : 'border:1px solid #ddd';
      const t = m.createdAt ? m.createdAt.toDate().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}) : '';
      
      // ПОКАЗЫВАЕМ ИМЯ
      const senderName = m.sender === 'admin' ? '👑 Админ' : currentChatUserName;

      box.innerHTML += `<div style="display:flex; justify-content:${align}; margin:8px 0;"><div style="max-width:70%; padding:10px 15px; border-radius:15px; ${bg}; ${border}; box-shadow:0 1px 2px rgba(0,0,0,0.1);"><div style="font-size:0.8em; color:#555; margin-bottom:4px;">${senderName}</div><div style="white-space:pre-wrap;">${m.text}</div><div style="font-size:0.7em; color:#888; text-align:right; margin-top:4px;">${t}</div></div></div>`;
    });
    box.scrollTop = box.scrollHeight;
  }, err => {
    box.innerHTML = `<p style="color:red">❌ Ошибка чата (возможно, правила Firebase)</p>`;
  });
}

window.sendChatMessage = function() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text || !currentChatId) return;
  db.collection('messages').add({ chatId: currentChatId, sender: userRole, text: text, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(() => { input.value = ''; });
};

document.getElementById('chat-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') window.sendChatMessage(); });

window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('id')) setTimeout(() => window.loadMemorial(urlParams.get('id')), 500);
});
