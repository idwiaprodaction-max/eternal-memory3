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
let qrScanner = null;
let chatUnsubscribe = null;

// === НАВИГАЦИЯ ===
window.showSection = function(id) {
  document.querySelectorAll('main > section').forEach(s => { s.classList.add('hidden'); s.classList.remove('active'); });
  const t = document.getElementById(id);
  if(t) { t.classList.remove('hidden'); t.classList.add('active'); window.scrollTo(0,0); }
};

window.showProfile = function() {
  if(!currentUser) return;
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-role').textContent = userRole === 'admin' ? '👑 Администратор' : '👤 Пользователь';
  db.collection('users').doc(currentUser.uid).get().then(d => {
    document.getElementById('profile-date').textContent = d.exists && d.data().created ? d.data().created.toDate().toLocaleDateString('ru-RU') : '...';
  });
  showSection('profile');
};

window.showAdminPanel = function() {
  if(userRole !== 'admin') return alert('Доступ запрещён');
  showSection('admin');
  loadAdminList();
};

// === ЧАТЫ И СООБЩЕНИЯ ===
document.addEventListener('DOMContentLoaded', () => {
  const fbForm = document.getElementById('feedback-form');
  if(fbForm) {
    fbForm.addEventListener('submit', e => {
      e.preventDefault();
      if(!currentUser) { alert('Войдите в аккаунт'); showSection('auth'); return; }
      const subj = document.getElementById('feedback-subject').value;
      const msg = document.getElementById('feedback-message').value;
      
      db.collection('messages').add({
        chatId: currentUser.uid,
        sender: 'user',
        subject: subj,
        text: msg,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        alert('✅ Отправлено!');
        fbForm.reset();
        showSection('home');
      }).catch(err => alert('Ошибка: ' + err.message));
    });
  }
});

window.loadUserMessages = function() {
  if(!currentUser) return;
  showSection('user-messages');
  const list = document.getElementById('user-msg-list');
  list.innerHTML = '<p>Загрузка...</p>';
  
  db.collection('messages').where('chatId', '==', currentUser.uid).orderBy('createdAt', 'desc').get().then(snap => {
    list.innerHTML = '';
    if(snap.empty) { list.innerHTML = '<p>📭 Нет обращений</p>'; return; }
    snap.forEach(doc => {
      const m = doc.data();
      const d = m.createdAt ? m.createdAt.toDate().toLocaleString('ru-RU') : '';
      list.innerHTML += `<div class="message-card" style="border-left-color: ${m.sender==='admin'?'#2ecc71':'#3498db'}">
        <h4>${m.subject || 'Сообщение'}</h4>
        <div class="meta">${m.sender==='admin'?'👑 Админ':'👤 Вы'} | ${d}</div>
        <div class="text">${m.text}</div>
      </div>`;
    });
  });
};

window.showAdminChats = function() {
  if(userRole !== 'admin') return;
  showSection('admin-chats');
  const list = document.getElementById('chats-list');
  list.innerHTML = '<p>Загрузка чатов...</p>';
  
  // Получаем уникальные chatId и последние сообщения
  db.collection('messages').orderBy('createdAt', 'desc').get().then(snap => {
    list.innerHTML = '';
    const chats = {};
    snap.forEach(doc => {
      const m = doc.data();
      if(!chats[m.chatId]) chats[m.chatId] = m;
    });
    
    if(Object.keys(chats).length === 0) { list.innerHTML = '<p>📭 Нет обращений</p>'; return; }
    
    Object.values(chats).forEach(m => {
      const d = m.createdAt ? m.createdAt.toDate().toLocaleString('ru-RU') : '';
      const div = document.createElement('div');
      div.className = 'message-card';
      div.innerHTML = `
        <h4>Пользователь: ${m.chatId.substring(0,8)}...</h4>
        <div class="meta">📅 ${d} | Тема: ${m.subject || 'Без темы'}</div>
        <div class="text">${m.text.substring(0,100)}${m.text.length>100?'...':''}</div>
        <button class="secondary-btn" onclick="openChat('${m.chatId}')">💬 Личный чат</button>
      `;
      list.appendChild(div);
    });
  });
};

window.openChat = function(chatId) {
  currentChatId = chatId;
  showSection('chat-view');
  document.getElementById('chat-title').textContent = `Чат с ${chatId.substring(0,8)}...`;
  document.getElementById('chat-input').value = '';
  renderChat(chatId);
};

function renderChat(chatId) {
  const box = document.getElementById('chat-messages');
  box.innerHTML = '<p>Загрузка...</p>';
  
  if(chatUnsubscribe) chatUnsubscribe();
  
  chatUnsubscribe = db.collection('messages').where('chatId', '==', chatId).orderBy('createdAt', 'asc').onSnapshot(snap => {
    box.innerHTML = '';
    if(snap.empty) { box.innerHTML = '<p style="text-align:center;color:#888;">Начало переписки</p>'; return; }
    snap.forEach(doc => {
      const m = doc.data();
      const isMe = (userRole === 'admin' && m.sender === 'admin') || (userRole !== 'admin' && m.sender === 'user');
      const align = isMe ? 'flex-end' : 'flex-start';
      const bg = isMe ? '#dcf8c6' : '#ffffff';
      const border = isMe ? 'border:1px solid #a5d6a7' : 'border:1px solid #ddd';
      
      box.innerHTML += `<div style="display:flex; justify-content:${align}; margin:8px 0;">
        <div style="max-width:70%; padding:10px 15px; border-radius:15px; ${bg}; ${border}; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
          <div style="font-size:0.8em; color:#555; margin-bottom:4px;">${m.sender==='admin'?'👑 Админ':'👤 Пользователь'}</div>
          <div style="white-space:pre-wrap;">${m.text}</div>
          <div style="font-size:0.7em; color:#888; text-align:right; margin-top:4px;">${m.createdAt ? m.createdAt.toDate().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}) : ''}</div>
        </div>
      </div>`;
    });
    box.scrollTop = box.scrollHeight;
  });
}

window.sendChatMessage = function() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text || !currentChatId) return;
  
  db.collection('messages').add({
    chatId: currentChatId,
    sender: userRole,
    text: text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => { input.value = ''; });
};

// === QR СКАНЕР ===
window.startScanner = function() {
  showSection('scanner');
  if(window.Html5Qrcode) {
    if(qrScanner) qrScanner.stop().catch(()=>{});
    qrScanner = new Html5Qrcode("qr-reader");
    qrScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, code => {
      qrScanner.stop();
      let id = code.includes('id=') ? code.split('id=')[1].split('&')[0] : code;
      loadMemorial(id.trim());
    }, ()=>{});
  }
};
window.stopScanner = function() { if(qrScanner) qrScanner.stop().catch(()=>{}); showSection('home'); };

// === ПАМЯТНИКИ (АДМИН) ===
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

window.loadMemorial = function(id) {
  currentMemorialId = id;
  showSection('memorial');
  document.getElementById('m-name').textContent = '⏳...';
  document.getElementById('m-years').textContent = '';
  document.getElementById('m-bio').textContent = '';
  document.getElementById('family-tree-display').innerHTML = '';
  document.getElementById('memorial-qr').innerHTML = '';
  document.getElementById('edit-family-list').innerHTML = '';

  db.collection('memorials').doc(id).get().then(doc => {
    if(!doc.exists) { document.getElementById('m-name').textContent = '❌ Не найдено'; return; }
    const d = doc.data();
    document.getElementById('m-name').textContent = d.name||'';
    document.getElementById('m-years').textContent = d.years||'';
    document.getElementById('m-bio').textContent = d.details||'';
    
    const geo = document.getElementById('btn-geo');
    if(d.lat && d.lng) { geo.classList.remove('hidden'); geo.onclick = () => window.open(`https://maps.google.com/?q=${d.lat},${d.lng}`, '_blank'); }
    else geo.classList.add('hidden');

    renderFamilyTree(d.family||[]);
    const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
    if(typeof QRCode !== 'undefined') new QRCode(document.getElementById('memorial-qr'), { text: url, width: 150, height: 150 });

    if(userRole === 'admin') {
      document.getElementById('edit-name').value = d.name||'';
      document.getElementById('edit-years').value = d.years||'';
      document.getElementById('edit-details').value = d.details||'';
      document.getElementById('edit-lat').value = d.lat||'';
      document.getElementById('edit-lng').value = d.lng||'';
      document.getElementById('edit-family-list').innerHTML = '';
      (d.family||[]).forEach(f => window.addFamilyMember('edit', f.relation, f.name, f.years));
    }
  });
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

window.saveMemorial = function() {
  if(userRole !== 'admin') return alert('Нет прав');
  const fam = [];
  document.querySelectorAll('#edit-family-list > div').forEach(d => fam.push({relation: d.querySelector('.f-rel').value, name: d.querySelector('.f-name').value, years: d.querySelector('.f-years').value}));
  db.collection('memorials').doc(currentMemorialId).set({name: document.getElementById('edit-name').value, years: document.getElementById('edit-years').value, details: document.getElementById('edit-details').value, lat: document.getElementById('edit-lat').value, lng: document.getElementById('edit-lng').value, family: fam}, {merge:true}).then(() => { alert('✅ Сохранено!'); window.loadMemorial(currentMemorialId); }).catch(e => alert('Ошибка: '+e.message));
};

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
      db.collection('memorials').doc(id).set({name: document.getElementById('new-name').value, years: document.getElementById('new-years').value, details: document.getElementById('new-details').value, lat: document.getElementById('new-lat').value, lng: document.getElementById('new-lng').value, family: fam}).then(() => { alert('✅ Добавлено!'); e.target.reset(); document.getElementById('add-family-list').innerHTML = ''; showAdminPanel(); }).catch(e => alert('Ошибка: '+e.message));
    });
  }
});

// === АВТОРИЗАЦИЯ ===
window.showAuth = function(mode) {
  const r = mode==='register';
  document.getElementById('auth-title').textContent = r?'Регистрация':'Вход';
  document.getElementById('auth-submit').textContent = r?'Создать':'Войти';
  document.getElementById('switch-auth').textContent = r?'Есть аккаунт? Войти':'Нет аккаунта? Регистрация';
  showSection('auth');
};
window.toggleAuthMode = function() { showAuth(document.getElementById('auth-submit').textContent==='Создать'?'login':'register'); };

document.getElementById('auth-form').addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('email').value, pass = document.getElementById('password').value;
  const isReg = document.getElementById('auth-submit').textContent === 'Создать';
  const p = isReg ? auth.createUserWithEmailAndPassword(email, pass) : auth.signInWithEmailAndPassword(email, pass);
  p.then(c => {
    if(isReg) db.collection('users').doc(c.user.uid).set({email, role:'user', created: firebase.firestore.FieldValue.serverTimestamp()});
    showSection('home');
  }).catch(e => alert('Ошибка: '+e.message));
});
window.logout = function() { auth.signOut(); showSection('home'); };

auth.onAuthStateChanged(u => {
  currentUser = u;
  if(u) {
    db.collection('users').doc(u.uid).get().then(d => { userRole = d.exists ? d.data().role : 'user'; updateUI(); });
  } else { userRole = 'guest'; updateUI(); }
});

function updateUI() {
  const map = {'btn-login':!currentUser, 'btn-register':!currentUser, 'btn-logout':!!currentUser, 'btn-home':!!currentUser, 'btn-profile':!!currentUser, 'btn-user-msgs':!!currentUser && userRole!=='admin', 'btn-admin':userRole==='admin', 'btn-admin-chats':userRole==='admin'};
  for(const [id, show] of Object.entries(map)) { const el=document.getElementById(id); if(el) el.classList.toggle('hidden', !show); }
  const ae = document.getElementById('auth-extra'); if(ae) ae.classList.toggle('hidden', !currentUser);
  const adm = document.getElementById('admin-extra'); if(adm) adm.classList.toggle('hidden', userRole!=='admin');
}
