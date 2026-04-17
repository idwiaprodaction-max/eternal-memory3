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
let qrScanner = null;
let chatUnsubscribe = null;

// ============================================
// 📍 НАВИГАЦИЯ
// ============================================
window.showSection = function(id) {
  console.log("🔀 Переход в раздел:", id);
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

// ============================================
// 👤 ПРОФИЛЬ
// ============================================
window.showProfile = function() {
  if (!currentUser) return;
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-role').textContent = userRole === 'admin' ? '👑 Администратор' : '👤 Пользователь';
  
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

// ============================================
// 🛠 АДМИНКА
// ============================================
window.showAdminPanel = function() {
  if (userRole !== 'admin') {
    alert('Доступ запрещён');
    return;
  }
  showSection('admin');
  loadAdminList();
};

// ============================================
// 💬 ЧАТЫ И СООБЩЕНИЯ
// ============================================
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
        chatId: currentUser.uid,
        sender: 'user',
        subject: subject,
        text: message,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        alert('✅ Сообщение отправлено администратору!');
        document.getElementById('feedback-subject').value = '';
        document.getElementById('feedback-message').value = '';
        showSection('home');
      }).catch(err => {
        console.error("Ошибка отправки:", err);
        alert('Ошибка: ' + err.message);
      });
    });
  }
});

// История сообщений пользователя
window.loadUserMessages = function() {
  if (!currentUser) return;
  showSection('user-messages');
  const list = document.getElementById('user-msg-list');
  list.innerHTML = '<p>⏳ Загрузка...</p>';
  
  db.collection('messages')
    .where('chatId', '==', currentUser.uid)
    .get()
    .then(snap => {
      list.innerHTML = '';
      const msgs = [];
      snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
      
      // Сортировка на клиенте (новые сверху)
      msgs.sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      if (msgs.length === 0) {
        list.innerHTML = '<p>📭 Нет обращений</p>';
        return;
      }
      
      msgs.forEach(m => {
        const d = m.createdAt ? m.createdAt.toDate().toLocaleString('ru-RU') : '';
        const color = m.sender === 'admin' ? '#2ecc71' : '#3498db';
        list.innerHTML += `
          <div class="message-card" style="border-left-color: ${color}">
            <h4>${m.subject || 'Сообщение'}</h4>
            <div class="meta">${m.sender === 'admin' ? '👑 Ответ админа' : '👤 Вы'} | ${d}</div>
            <div class="text">${m.text}</div>
          </div>`;
      });
    })
    .catch(err => {
      console.error("Ошибка загрузки:", err);
      list.innerHTML = `<p style="color:red">❌ ${err.message}</p>`;
    });
};

// Список чатов для админа
window.showAdminChats = function() {
  if (userRole !== 'admin') return;
  showSection('admin-chats');
  const list = document.getElementById('chats-list');
  list.innerHTML = '<p>⏳ Загрузка чатов...</p>';
  
  db.collection('messages').get().then(snap => {
    list.innerHTML = '';
    const chats = {};
    
    snap.forEach(doc => {
      const m = doc.data();
      if (!chats[m.chatId]) {
        chats[m.chatId] = { lastMsg: m, count: 0 };
      }
      chats[m.chatId].count++;
    });
    
    if (Object.keys(chats).length === 0) {
      list.innerHTML = '<p>📭 Нет обращений</p>';
      return;
    }
    
    Object.values(chats).forEach(chat => {
      const m = chat.lastMsg;
      const d = m.createdAt ? m.createdAt.toDate().toLocaleString('ru-RU') : '';
      const div = document.createElement('div');
      div.className = 'message-card';
      div.innerHTML = `
        <h4>Пользователь: ${m.chatId.substring(0, 8)}...</h4>
        <div class="meta">📅 ${d} | Сообщений: ${chat.count}</div>
        <div class="text">${m.subject ? '📌 ' + m.subject : ''} ${m.text.substring(0, 100)}${m.text.length > 100 ? '...' : ''}</div>
        <button class="secondary-btn" onclick="window.openChat('${m.chatId}')" style="margin-top:10px">💬 Открыть чат</button>
      `;
      list.appendChild(div);
    });
  }).catch(err => {
    console.error("Ошибка:", err);
    list.innerHTML = `<p style="color:red">❌ ${err.message}</p>`;
  });
};

// Открытие чата
window.openChat = function(chatId) {
  currentChatId = chatId;
  showSection('chat-view');
  document.getElementById('chat-title').textContent = `💬 Чат с ${chatId.substring(0, 8)}...`;
  document.getElementById('chat-input').value = '';
  renderChat(chatId);
};

// Отображение чата
function renderChat(chatId) {
  const box = document.getElementById('chat-messages');
  box.innerHTML = '<p>⏳ Загрузка переписки...</p>';
  
  if (chatUnsubscribe) chatUnsubscribe();
  
  // Запрос БЕЗ orderBy (чтобы не требовался индекс)
  chatUnsubscribe = db.collection('messages')
    .where('chatId', '==', chatId)
    .onSnapshot(snap => {
      box.innerHTML = '';
      const msgs = [];
      
      snap.forEach(doc => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      
      // Сортировка на клиенте
      msgs.sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeA - timeB;
      });
      
      if (msgs.length === 0) {
        box.innerHTML = '<p style="text-align:center;color:#888;margin-top:50px">💬 Начало переписки</p>';
        return;
      }
      
      msgs.forEach(m => {
        const isMe = (userRole === 'admin' && m.sender === 'admin') || 
                     (userRole !== 'admin' && m.sender === 'user');
        const align = isMe ? 'flex-end' : 'flex-start';
        const bg = isMe ? '#dcf8c6' : '#ffffff';
        const border = isMe ? 'border:1px solid #a5d6a7' : 'border:1px solid #ddd';
        
        const timeStr = m.createdAt ? m.createdAt.toDate().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        }) : '';
        
        box.innerHTML += `
          <div style="display:flex; justify-content:${align}; margin:8px 0;">
            <div style="max-width:70%; padding:10px 15px; border-radius:15px; ${bg}; ${border}; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
              <div style="font-size:0.8em; color:#555; margin-bottom:4px;">
                ${m.sender === 'admin' ? '👑 Администратор' : '👤 Пользователь'}
              </div>
              <div style="white-space:pre-wrap; word-wrap:break-word;">${m.text}</div>
              <div style="font-size:0.7em; color:#888; text-align:right; margin-top:4px;">${timeStr}</div>
            </div>
          </div>`;
      });
      
      box.scrollTop = box.scrollHeight;
    }, err => {
      console.error("Ошибка чата:", err);
      box.innerHTML = `<p style="color:red; text-align:center;">❌ Ошибка загрузки чата<br>${err.message}</p>`;
    });
}

// Отправка сообщения в чате
window.sendChatMessage = function() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  
  if (!text || !currentChatId) {
    alert('Введите сообщение');
    return;
  }
  
  db.collection('messages').add({
    chatId: currentChatId,
    sender: userRole,
    text: text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    input.value = '';
    input.focus();
  }).catch(err => {
    console.error("Ошибка отправки:", err);
    alert('Ошибка отправки: ' + err.message);
  });
};

// Отправка по Enter
document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.sendChatMessage();
      }
    });
  }
});

// ============================================
// 📷 QR СКАНЕР
// ============================================
window.startScanner = function() {
  console.log("📷 Запуск сканера QR...");
  showSection('scanner');
  
  if (typeof Html5Qrcode !== 'undefined') {
    if (qrScanner) {
      qrScanner.stop().catch(() => {});
    }
    
    qrScanner = new Html5Qrcode("qr-reader");
    qrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      function(code) {
        // Успешное сканирование
        qrScanner.stop().then(() => {
          console.log("✅ Отсканирован QR:", code);
          
          // Извлекаем ID из QR кода
          let memorialId = code.trim();
          
          // Если это URL, извлекаем параметр id
          if (code.includes('id=')) {
            const urlParams = new URLSearchParams(code.split('?')[1]);
            memorialId = urlParams.get('id') || code.split('id=')[1].split('&')[0];
          } else if (code.includes(window.location.hostname)) {
            // Это полный URL нашего сайта
            try {
              const url = new URL(code);
              memorialId = url.searchParams.get('id') || url.pathname.split('/').pop();
            } catch(e) {
              memorialId = code;
            }
          }
          
          memorialId = memorialId.trim();
          console.log("🎯 ID памятника:", memorialId);
          
          if (memorialId) {
            showSection('scanner');
            loadMemorial(memorialId);
          } else {
            alert('❌ Не удалось распознать QR-код памятника');
            showSection('home');
          }
        }).catch(() => {});
      },
      function(errorMessage) {
        // Ошибки сканирования игнорируем
      }
    ).catch(err => {
      console.error("❌ Ошибка запуска камеры:", err);
      alert("Не удалось запустить камеру. Проверьте разрешения.\n" + err);
      showSection('home');
    });
  } else {
    alert("Библиотека сканера не загружена. Обновите страницу.");
    showSection('home');
  }
};

window.stopScanner = function() {
  if (qrScanner) {
    qrScanner.stop().catch(() => {});
  }
  showSection('home');
};

// ============================================
// 📋 СПИСОК ПАМЯТНИКОВ (АДМИН)
// ============================================
function loadAdminList() {
  const listDiv = document.getElementById('admin-list');
  listDiv.innerHTML = '<p>⏳ Загрузка базы...</p>';
  
  db.collection('memorials').get().then(snap => {
    listDiv.innerHTML = '';
    
    if (snap.empty) {
      listDiv.innerHTML = '<p>📭 Памятников пока нет. Добавьте первый!</p>';
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
      listDiv.appendChild(card);
      
      // Генерация QR для карточки
      setTimeout(() => {
        const qrContainer = document.getElementById(`qr-${doc.id}`);
        if (qrContainer && typeof QRCode !== 'undefined') {
          const url = `${window.location.origin}${window.location.pathname}?id=${doc.id}`;
          new QRCode(qrContainer, {
            text: url,
            width: 90,
            height: 90,
            correctLevel: QRCode.CorrectLevel.M
          });
        }
      }, 100);
    });
  }).catch(err => {
    console.error("Ошибка загрузки списка:", err);
    listDiv.innerHTML = `<p style="color:red">❌ Ошибка: ${err.message}</p>`;
  });
}

// ============================================
// 🪦 ЗАГРУЗКА ПАМЯТНИКА
// ============================================
window.loadMemorial = function(id) {
  console.log("🪦 Загрузка памятника:", id);
  currentMemorialId = id;
  showSection('memorial');
  
  // Очистка полей
  document.getElementById('m-name').textContent = '⏳ Загрузка...';
  document.getElementById('m-years').textContent = '';
  document.getElementById('m-bio').textContent = '';
  document.getElementById('family-tree-display').innerHTML = '';
  document.getElementById('memorial-qr').innerHTML = '';
  document.getElementById('edit-family-list').innerHTML = '';

  db.collection('memorials').doc(id).get().then(doc => {
    if (!doc.exists) {
      console.error("❌ Памятник не найден:", id);
      document.getElementById('m-name').textContent = '❌ Запись не найдена';
      document.getElementById('m-years').textContent = `ID: ${id}`;
      return;
    }
    
    const d = doc.data();
    console.log("✅ Данные получены:", d);
    
    // Заполнение основных полей
    document.getElementById('m-name').textContent = d.name || 'Без имени';
    document.getElementById('m-years').textContent = d.years || '';
    document.getElementById('m-bio').textContent = d.details || 'Биография не указана';
    
    // Геолокация
    const geoBtn = document.getElementById('btn-geo');
    if (d.lat && d.lng) {
      geoBtn.classList.remove('hidden');
      geoBtn.onclick = () => {
        const url = `https://www.google.com/maps?q=${d.lat},${d.lng}`;
        window.open(url, '_blank');
      };
    } else {
      geoBtn.classList.add('hidden');
    }
    
    // Семейное древо
    renderFamilyTree(d.family || []);
    
    // QR код памятника
    const qrContainer = document.getElementById('memorial-qr');
    if (qrContainer && typeof QRCode !== 'undefined') {
      qrContainer.innerHTML = '';
      const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
      new QRCode(qrContainer, {
        text: url,
        width: 150,
        height: 150,
        correctLevel: QRCode.CorrectLevel.H
      });
    }
    
    // Заполнение полей для админа
    if (userRole === 'admin') {
      document.getElementById('edit-name').value = d.name || '';
      document.getElementById('edit-years').value = d.years || '';
      document.getElementById('edit-details').value = d.details || '';
      document.getElementById('edit-lat').value = d.lat || '';
      document.getElementById('edit-lng').value = d.lng || '';
      
      document.getElementById('edit-family-list').innerHTML = '';
      (d.family || []).forEach(f => {
        window.addFamilyMember('edit', f.relation, f.name, f.years);
      });
    }
  }).catch(err => {
    console.error("❌ Ошибка загрузки:", err);
    document.getElementById('m-name').textContent = '❌ Ошибка загрузки';
    document.getElementById('m-years').textContent = err.message;
  });
};

// ============================================
// 👨‍👩‍‍👦 СЕМЕЙНОЕ ДРЕВО
// ============================================
function renderFamilyTree(family) {
  const container = document.getElementById('family-tree-display');
  if (!family || family.length === 0) {
    container.innerHTML = '<p style="color:#888; font-style:italic;">Информация о родственниках не добавлена</p>';
    return;
  }
  
  const relations = {
    'father': 'Отец',
    'mother': 'Мать',
    'spouse': 'Супруг(а)',
    'son': 'Сын',
    'daughter': 'Дочь',
    'brother': 'Брат',
    'sister': 'Сестра',
    'grandfather': 'Дедушка',
    'grandmother': 'Бабушка'
  };
  
  let html = '<ul style="list-style:none; padding-left:0;">';
  family.forEach(f => {
    const relName = relations[f.relation] || f.relation;
    const yearsStr = f.years ? `<span style="color:#666; font-size:0.9em;"> (${f.years})</span>` : '';
    html += `<li style="margin:8px 0; padding:10px; background:#f9f9f9; border-radius:6px; border-left:3px solid var(--accent);">
      <strong>${relName}:</strong> ${f.name}${yearsStr}
    </li>`;
  });
  container.innerHTML = html + '</ul>';
}

window.addFamilyMember = function(mode, relation = '', name = '', years = '') {
  const listId = mode === 'edit' ? 'edit-family-list' : 'add-family-list';
  const container = document.getElementById(listId);
  if (!container) return;
  
  const div = document.createElement('div');
  div.style.cssText = "display:flex; gap:8px; margin:8px 0; align-items:center; flex-wrap:wrap;";
  
  const relations = [
    { value: 'father', label: 'Отец' },
    { value: 'mother', label: 'Мать' },
    { value: 'spouse', label: 'Супруг(а)' },
    { value: 'son', label: 'Сын' },
    { value: 'daughter', label: 'Дочь' },
    { value: 'brother', label: 'Брат' },
    { value: 'sister', label: 'Сестра' }
  ];
  
  let optionsHtml = relations.map(r => 
    `<option value="${r.value}" ${relation === r.value ? 'selected' : ''}>${r.label}</option>`
  ).join('');
  
  div.innerHTML = `
    <select class="f-rel" style="flex:1; min-width:100px; padding:5px;">${optionsHtml}</select>
    <input class="f-name" placeholder="ФИО родственника" value="${name}" style="flex:2; padding:5px;">
    <input class="f-years" placeholder="Годы (напр. 1950-2020)" value="${years}" style="flex:1.5; padding:5px;">
    <button type="button" class="secondary-btn" onclick="this.parentElement.remove()" style="padding:5px 10px;">✕</button>
  `;
  
  container.appendChild(div);
};

// ============================================
// 💾 СОХРАНЕНИЕ ПАМЯТНИКА
// ============================================
window.saveMemorial = function() {
  if (userRole !== 'admin') {
    alert('❌ Нет прав на редактирование');
    return;
  }
  
  // Собираем семейное древо
  const family = [];
  document.querySelectorAll('#edit-family-list > div').forEach(div => {
    family.push({
      relation: div.querySelector('.f-rel').value,
      name: div.querySelector('.f-name').value.trim(),
      years: div.querySelector('.f-years').value.trim()
    });
  });
  
  // Фильтруем пустые записи
  const validFamily = family.filter(f => f.name);
  
  const data = {
    name: document.getElementById('edit-name').value.trim(),
    years: document.getElementById('edit-years').value.trim(),
    details: document.getElementById('edit-details').value.trim(),
    lat: document.getElementById('edit-lat').value.trim(),
    lng: document.getElementById('edit-lng').value.trim(),
    family: validFamily,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  db.collection('memorials').doc(currentMemorialId).set(data, { merge: true })
    .then(() => {
      alert('✅ Изменения сохранены!');
      window.loadMemorial(currentMemorialId);
    })
    .catch(err => {
      console.error("Ошибка сохранения:", err);
      alert('❌ Ошибка сохранения: ' + err.message);
    });
};

// ============================================
// ➕ ДОБАВЛЕНИЕ НОВОГО ПАМЯТНИКА
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  const addForm = document.getElementById('add-memorial');
  if (addForm) {
    addForm.addEventListener('submit', e => {
      e.preventDefault();
      
      if (userRole !== 'admin') {
        alert('❌ Нет прав');
        return;
      }
      
      const id = document.getElementById('new-id').value.trim().toLowerCase();
      if (!id) {
        alert('Введите ID памятника');
        return;
      }
      
      // Собираем семейное древо
      const family = [];
      document.querySelectorAll('#add-family-list > div').forEach(div => {
        family.push({
          relation: div.querySelector('.f-rel').value,
          name: div.querySelector('.f-name').value.trim(),
          years: div.querySelector('.f-years').value.trim()
        });
      });
      
      const data = {
        name: document.getElementById('new-name').value.trim(),
        years: document.getElementById('new-years').value.trim(),
        details: document.getElementById('new-details').value.trim(),
        lat: document.getElementById('new-lat').value.trim(),
        lng: document.getElementById('new-lng').value.trim(),
        family: family.filter(f => f.name),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      db.collection('memorials').doc(id).set(data)
        .then(() => {
          alert(`✅ Памятник "${data.name}" добавлен!\nID: ${id}`);
          e.target.reset();
          document.getElementById('add-family-list').innerHTML = '';
          showAdminPanel();
        })
        .catch(err => {
          console.error("Ошибка добавления:", err);
          alert('❌ Ошибка: ' + err.message);
        });
    });
  }
});

// ============================================
// 🔐 АВТОРИЗАЦИЯ
// ============================================
window.showAuth = function(mode) {
  const isRegister = mode === 'register';
  document.getElementById('auth-title').textContent = isRegister ? 'Регистрация' : 'Вход';
  document.getElementById('auth-submit').textContent = isRegister ? 'Создать аккаунт' : 'Войти';
  document.getElementById('switch-auth').textContent = isRegister 
    ? 'Уже есть аккаунт? Войти' 
    : 'Нет аккаунта? Зарегистрироваться';
  showSection('auth');
};

window.toggleAuthMode = function() {
  const isRegister = document.getElementById('auth-submit').textContent === 'Создать аккаунт';
  showAuth(isRegister ? 'login' : 'register');
};

document.getElementById('auth-form').addEventListener('submit', e => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const isRegister = document.getElementById('auth-submit').textContent === 'Создать аккаунт';
  
  const promise = isRegister
    ? auth.createUserWithEmailAndPassword(email, password)
    : auth.signInWithEmailAndPassword(email, password);
  
  promise.then(userCredential => {
    if (isRegister) {
      // Создаём запись пользователя
      db.collection('users').doc(userCredential.user.uid).set({
        email: email,
        role: 'user',
        created: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    showSection('home');
  }).catch(error => {
    console.error("Ошибка авторизации:", error);
    alert('❌ ' + error.message);
  });
});

window.logout = function() {
  auth.signOut();
  showSection('home');
};

// Отслеживание состояния авторизации
auth.onAuthStateChanged(user => {
  currentUser = user;
  
  if (user) {
    console.log("✅ Пользователь авторизован:", user.email);
    db.collection('users').doc(user.uid).get().then(doc => {
      userRole = doc.exists ? doc.data().role : 'user';
      console.log("👤 Роль:", userRole);
      updateUI();
    }).catch(err => {
      console.error("Ошибка получения роли:", err);
      userRole = 'user';
      updateUI();
    });
  } else {
    console.log("🚪 Пользователь вышел");
    userRole = 'guest';
    updateUI();
  }
});

function updateUI() {
  const elements = {
    'btn-login': !currentUser,
    'btn-register': !currentUser,
    'btn-logout': !!currentUser,
    'btn-home': !!currentUser,
    'btn-profile': !!currentUser,
    'btn-user-msgs': !!currentUser && userRole !== 'admin',
    'btn-admin': userRole === 'admin',
    'btn-admin-chats': userRole === 'admin'
  };
  
  for (const [id, show] of Object.entries(elements)) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('hidden', !show);
    }
  }
  
  const authExtra = document.getElementById('auth-extra');
  if (authExtra) authExtra.classList.toggle('hidden', !currentUser);
  
  const adminExtra = document.getElementById('admin-extra');
  if (adminExtra) adminExtra.classList.toggle('hidden', userRole !== 'admin');
}

// ============================================
// 🔗 ОБРАБОТКА ССЫЛОК С QR-КОДАМИ
// ============================================
window.addEventListener('load', () => {
  console.log("📄 Страница загружена");
  
  // Проверяем URL параметры
  const urlParams = new URLSearchParams(window.location.search);
  const memorialId = urlParams.get('id');
  
  if (memorialId) {
    console.log("🎯 Найден параметр id:", memorialId);
    // Небольшая задержка чтобы Firebase успел инициализироваться
    setTimeout(() => {
      window.loadMemorial(memorialId);
    }, 500);
  }
});
