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
  document.getElementById(id).classList.remove('hidden');
  document.getElementById(id).classList.add('active');
};

window.showAdminPanel = function() {
  if (userRole !== 'admin') return alert('Доступ запрещён');
  showSection('admin');
  loadAdminList(); // Загружаем список
};

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

// === СПИСОК ДЛЯ АДМИНА ===
function loadAdminList() {
  const listDiv = document.getElementById('admin-list');
  listDiv.innerHTML = '<p>Загрузка базы...</p>';
  
  db.collection('memorials').get().then(snap => {
    listDiv.innerHTML = '';
    if (snap.empty) {
      listDiv.innerHTML = '<p>Памятников пока нет.</p>';
      return;
    }
    snap.forEach(doc => {
      const data = doc.data();
      const card = document.createElement('div');
      card.className = 'admin-card';
      card.innerHTML = `
        <h4>${data.name}</h4>
        <p>${data.years}</p>
        <div id="qr-${doc.id}" style="margin: 10px auto;"></div>
        <button class="secondary-btn" onclick="loadMemorial('${doc.id}')">✏️ Редактировать</button>
      `;
      listDiv.appendChild(card);
      
      // Генерируем QR для каждого в списке
      setTimeout(() => {
        const url = window.location.href.split('?')[0] + '?id=' + doc.id;
        new QRCode(document.getElementById(`qr-${doc.id}`), { text: url, width: 100, height: 100 });
      }, 100);
    });
  });
}

// === ЗАГРУЗКА ПАМЯТНИКА ===
window.loadMemorial = function(id) {
  currentMemorialId = id;
  showSection('memorial');
  
  // Очистка полей
  document.getElementById('m-name').textContent = '...';
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
    
    // Заполнение данных
    document.getElementById('m-name').textContent = d.name || '';
    document.getElementById('m-years').textContent = d.years || '';
    document.getElementById('m-bio').textContent = d.details || '';
    
    // Геолокация
    const geoBtn = document.getElementById('btn-geo');
    if (d.lat && d.lng) {
      geoBtn.classList.remove('hidden');
      geoBtn.onclick = () => window.open(`https://maps.google.com/?q=${d.lat},${d.lng}`);
    } else {
      geoBtn.classList.add('hidden');
    }

    // Семейное древо (просмотр)
    renderFamilyTree(d.family || []);
    
    // QR код
    const url = window.location.href.split('?')[0] + '?id=' + id;
    new QRCode(document.getElementById('memorial-qr'), { text: url, width: 150, height: 150 });

    // Заполнение полей для админа
    if (userRole === 'admin') {
      document.getElementById('edit-name').value = d.name || '';
      document.getElementById('edit-years').value = d.years || '';
      document.getElementById('edit-details').value = d.details || '';
      document.getElementById('edit-lat').value = d.lat || '';
      document.getElementById('edit-lng').value = d.lng || '';
      // Очистить и заполнить список редактирования
      document.getElementById('edit-family-list').innerHTML = '';
      (d.family || []).forEach(f => addFamilyMember('edit', f.relation, f.name, f.years));
    }
  });
};

// === СЕМЕЙНОЕ ДРЕВО ===
function renderFamilyTree(family) {
  const container = document.getElementById('family-tree-display');
  if (!family.length) { container.innerHTML = '<p style="color:#888">Пусто</p>'; return; }
  const map = { father:'Отец', mother:'Мать', spouse:'Супруг(а)', son:'Сын', daughter:'Дочь', brother:'Брат', sister:'Сестра' };
  let html = '<ul style="list-style:none;">';
  family.forEach(f => {
    html += `<li style="margin:5px 0;"><b>${map[f.relation]||f.relation}:</b> ${f.name} ${f.years?'('+f.years+')':''}</li>`;
  });
  container.innerHTML = html + '</ul>';
}

window.addFamilyMember = function(mode, rel='', name='', years='') {
  const listId = mode === 'edit' ? 'edit-family-list' : 'add-family-list';
  const div = document.createElement('div');
  div.style.cssText = "display:flex; gap:5px; margin:5px 0;";
  div.innerHTML = `
    <select class="f-rel" style="width:30%">
      <option value="father" ${rel=='father'?'selected':''}>Отец</option>
      <option value="mother" ${rel=='mother'?'selected':''}>Мать</option>
      <option value="spouse" ${rel=='spouse'?'selected':''}>Супруг(а)</option>
      <option value="son" ${rel=='son'?'selected':''}>Сын</option>
      <option value="daughter" ${rel=='daughter'?'selected':''}>Дочь</option>
    </select>
    <input class="f-name" placeholder="ФИО" value="${name}">
    <input class="f-years" placeholder="Годы" value="${years}" style="width:25%">
    <button type="button" class="secondary-btn" onclick="this.parentElement.remove()">✕</button>
  `;
  document.getElementById(listId).appendChild(div);
};

// === СОХРАНЕНИЕ (АДМИН) ===
window.saveMemorial = function() {
  if (userRole !== 'admin') return;
  
  // Сбор родственников
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
    alert('Сохранено!');
    loadMemorial(currentMemorialId);
  });
};

// === ДОБАВЛЕНИЕ НОВОГО (АДМИН) ===
document.addEventListener('DOMContentLoaded', () => {
  const addForm = document.getElementById('add-memorial');
  if (addForm) {
    addForm.addEventListener('submit', e => {
      e.preventDefault();
      if (userRole !== 'admin') return;
      const id = document.getElementById('new-id').value.trim();
      
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
        alert('Добавлено!');
        e.target.reset();
        document.getElementById('add-family-list').innerHTML = '';
        showAdminPanel();
      });
    });
  }
});

// === КНОПКА "НАДО ИЗМЕНИТЬ?" ===
window.requestChange = function() {
  const name = document.getElementById('m-name').textContent;
  const subject = encodeURIComponent(`Запрос на изменение: ${name}`);
  const body = encodeURIComponent(`Здравствуйте!\nЯ хочу изменить информацию о памятнике "${name}".\n\nОпишите, что нужно исправить:\n...`);
  // Замени admin@example.com на свою почту
  window.location.href = `mailto:admin@example.com?subject=${subject}&body=${body}`;
};

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
  
  const promise = isReg ? auth.createUserWithEmailAndPassword(email, pass) : auth.signInWithEmailAndPassword(email, pass);
  promise.then(cred => {
    if (isReg) db.collection('users').doc(cred.user.uid).set({ email, role: 'user' });
    showSection('home');
  }).catch(err => alert(err.message));
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
  document.getElementById('btn-admin').classList.toggle('hidden', userRole !== 'admin');
  
  document.getElementById('auth-extra').classList.toggle('hidden', !currentUser);
  document.getElementById('admin-extra').classList.toggle('hidden', userRole !== 'admin');
}
