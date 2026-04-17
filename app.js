// === НАСТРОЙКИ FIREBASE ===
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

console.log("✅ Firebase подключен!");

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ ===
window.showSection = function(id) {
  document.querySelectorAll('main > section').forEach(function(sec) {
    sec.classList.add('hidden');
    sec.classList.remove('active');
  });
  var target = document.getElementById(id);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
};

window.showAuth = function(mode) {
  var isReg = (mode === 'register');
  document.getElementById('auth-title').textContent = isReg ? 'Регистрация' : 'Вход';
  document.getElementById('auth-submit').textContent = isReg ? 'Создать аккаунт' : 'Войти';
  document.getElementById('switch-auth').textContent = isReg ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
  window.showSection('auth');
};

window.toggleAuthMode = function() {
  var cur = document.getElementById('auth-submit').textContent;
  window.showAuth(cur === 'Войти' ? 'register' : 'login');
};

window.logout = function() {
  auth.signOut();
  window.showSection('home');
};

// === QR СКАНЕР ===
window.startScanner = function() {
  console.log("Запуск сканера QR...");
  window.showSection('scanner');
  
  if (window.Html5Qrcode) {
    if (qrScanner) {
      qrScanner.stop().catch(function(){});
    }
    
    qrScanner = new Html5Qrcode("qr-reader");
    qrScanner.start(
      { facingMode: "environment" }, 
      { fps: 10, qrbox: { width: 250, height: 250 } }, 
      function(code) {
        qrScanner.stop();
        var id = code.includes('id=') ? code.split('id=')[1].split('&')[0] : code;
        console.log("Отсканирован ID:", id);
        window.loadMemorial(id.trim());
      },
      function(err) {}
    ).catch(function(err) {
      console.error("Ошибка камеры:", err);
      alert("Не удалось запустить камеру. Проверьте разрешения.");
      window.showSection('home');
    });
  }
};

window.stopScanner = function() {
  if (qrScanner) qrScanner.stop().catch(function(){});
  window.showSection('home');
};

// === ЗАГРУЗКА ПАМЯТНИКА ===
window.loadMemorial = function(id) {
  currentMemorialId = id;
  window.showSection('memorial');
  
  db.collection('memorials').doc(id).get().then(function(doc) {
    if (!doc.exists) {
      document.getElementById('m-name').textContent = '❌ Запись не найдена';
      document.getElementById('m-years').textContent = '';
      document.getElementById('m-bio').textContent = '';
      return;
    }
    var d = doc.data();
    
    document.getElementById('m-name').textContent = d.name || 'Без имени';
    document.getElementById('m-years').textContent = d.years || '';
    document.getElementById('m-bio').textContent = d.details || 'Нет биографии';
    
    // Геолокация
    var geoBtn = document.getElementById('btn-geo');
    if (geoBtn) {
      if (d.lat && d.lng) {
        geoBtn.classList.remove('hidden');
        geoBtn.onclick = function() {
          window.open('https://www.google.com/maps?q=' + d.lat + ',' + d.lng, '_blank');
        };
      } else {
        geoBtn.classList.add('hidden');
      }
    }
    
    // Семейное древо
    window.renderFamilyTree(d.family || []);
    
    // QR код (показываем всем)
    var qrContainer = document.getElementById('memorial-qr');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      var url = window.location.href.split('?')[0] + '?id=' + id;
      if (window.QRCode) {
        new QRCode(qrContainer, { text: url, width: 150, height: 150 });
      }
    }
    
    // Поля редактирования для админа
    if (userRole === 'admin') {
      document.getElementById('edit-name').value = d.name || '';
      document.getElementById('edit-years').value = d.years || '';
      document.getElementById('edit-details').value = d.details || '';
      document.getElementById('edit-lat').value = d.lat || '';
      document.getElementById('edit-lng').value = d.lng || '';
      
      // Семейное древо для редактирования
      var familyList = document.getElementById('edit-family-list');
      if (familyList) {
        familyList.innerHTML = '';
        (d.family || []).forEach(function(rel, idx) {
          window.addFamilyFieldToEdit(rel.relation, rel.name, idx);
        });
      }
    }
  }).catch(function(e) {
    console.error("Ошибка:", e);
    alert('Ошибка загрузки: ' + e.message);
  });
};

// === СЕМЕЙНОЕ ДРЕВО - ОТОБРАЖЕНИЕ ===
window.renderFamilyTree = function(family) {
  var container = document.getElementById('family-tree-display');
  if (!container) return;
  
  if (!family || family.length === 0) {
    container.innerHTML = '<p style="color:#888; font-style:italic;">Семейное древо не заполнено</p>';
    return;
  }
  
  var relations = {
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
  
  var html = '<div style="display:grid; gap:10px; margin-top:15px;">';
  family.forEach(function(rel) {
    var relName = relations[rel.relation] || rel.relation;
    html += '<div style="background:#f5f5f5; padding:10px; border-radius:5px;">';
    html += '<strong>' + relName + ':</strong> ' + rel.name;
    if (rel.years) html += ' <span style="color:#666; font-size:0.9em;">(' + rel.years + ')</span>';
    html += '</div>';
  });
  html += '</div>';
  
  container.innerHTML = html;
};

// === ДОБАВЛЕНИЕ ПОЛЕЙ СЕМЕЙНОГО ДРЕВА (для админа) ===
window.addFamilyFieldToEdit = function(relation, name, index) {
  var container = document.getElementById('edit-family-list');
  if (!container) return;
  
  var div = document.createElement('div');
  div.className = 'family-field';
  div.style.cssText = 'display:flex; gap:10px; margin:10px 0; align-items:center; flex-wrap:wrap;';
  
  var relations = [
    {value:'father', label:'Отец'},
    {value:'mother', label:'Мать'},
    {value:'spouse', label:'Супруг(а)'},
    {value:'son', label:'Сын'},
    {value:'daughter', label:'Дочь'},
    {value:'brother', label:'Брат'},
    {value:'sister', label:'Сестра'},
    {value:'grandfather', label:'Дедушка'},
    {value:'grandmother', label:'Бабушка'}
  ];
  
  var select = document.createElement('select');
  select.className = 'family-relation';
  select.dataset.index = index;
  relations.forEach(function(r) {
    var opt = document.createElement('option');
    opt.value = r.value;
    opt.textContent = r.label;
    if (r.value === relation) opt.selected = true;
    select.appendChild(opt);
  });
  
  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'family-name';
  input.placeholder = 'ФИО родственника';
  input.value = name || '';
  input.style.flex = '1';
  
  var yearsInput = document.createElement('input');
  yearsInput.type = 'text';
  yearsInput.className = 'family-years';
  yearsInput.placeholder = 'Годы (напр. 1950-2020)';
  yearsInput.value = '';
  yearsInput.style.width = '150px';
  
  var removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.className = 'secondary-btn';
  removeBtn.style.padding = '5px 10px';
  removeBtn.onclick = function() {
    div.remove();
  };
  
  div.appendChild(select);
  div.appendChild(input);
  div.appendChild(yearsInput);
  div.appendChild(removeBtn);
  container.appendChild(div);
};

window.addFamilyMember = function() {
  window.addFamilyFieldToEdit('', '', Date.now());
};

// === СОХРАНЕНИЕ С СЕМЕЙНЫМ ДРЕВОМ ===
window.saveMemorial = function() {
  if (!currentMemorialId || userRole !== 'admin') {
    return alert('Нет прав');
  }
  
  // Собираем семейное древо
  var family = [];
  var familyFields = document.querySelectorAll('.family-field');
  familyFields.forEach(function(field) {
    var relation = field.querySelector('.family-relation').value;
    var name = field.querySelector('.family-name').value;
    var years = field.querySelector('.family-years').value;
    if (name) {
      family.push({relation: relation, name: name, years: years});
    }
  });
  
  db.collection('memorials').doc(currentMemorialId).set({
    name: document.getElementById('edit-name').value,
    years: document.getElementById('edit-years').value,
    details: document.getElementById('edit-details').value,
    lat: document.getElementById('edit-lat').value,
    lng: document.getElementById('edit-lng').value,
    family: family,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, {merge: true}).then(function() {
    alert('✅ Сохранено!');
    window.loadMemorial(currentMemorialId);
  }).catch(function(e) {
    alert('Ошибка: ' + e.message);
  });
};

// === ДОБАВЛЕНИЕ ПАМЯТНИКА ===
document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('auth-form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = document.getElementById('email').value;
      var pass = document.getElementById('password').value;
      var isReg = document.getElementById('auth-submit').textContent === 'Создать аккаунт';
      
      var promise = isReg 
        ? auth.createUserWithEmailAndPassword(email, pass) 
        : auth.signInWithEmailAndPassword(email, pass);
      
      promise.then(function(cred) {
        if (isReg) {
          db.collection('users').doc(cred.user.uid).set({
            email: email,
            role: 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        window.showSection('home');
      }).catch(function(err) {
        alert('Ошибка: ' + err.message);
      });
    });
  }
  
  var addForm = document.getElementById('add-memorial');
  if (addForm) {
    addForm.addEventListener('submit', function(e) {
      e.preventDefault();
      if (userRole !== 'admin') return;
      
      var id = document.getElementById('new-id').value.trim();
      if (!id) return alert('Введите ID');
      
      // Собираем семейное древо из формы добавления
      var family = [];
      var familyFields = document.querySelectorAll('#add-family-list .family-field');
      familyFields.forEach(function(field) {
        var relation = field.querySelector('.family-relation').value;
        var name = field.querySelector('.family-name').value;
        var years = field.querySelector('.family-years').value;
        if (name) {
          family.push({relation: relation, name: name, years: years});
        }
      });
      
      db.collection('memorials').doc(id).set({
        name: document.getElementById('new-name').value,
        years: document.getElementById('new-years').value,
        details: document.getElementById('new-details').value,
        lat: document.getElementById('new-lat').value,
        lng: document.getElementById('new-lng').value,
        family: family,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function() {
        alert('✅ Памятник добавлен! QR код сгенерирован автоматически.');
        e.target.reset();
        document.getElementById('add-family-list').innerHTML = '';
        window.showSection('admin');
      }).catch(function(err) {
        alert('Ошибка: ' + err.message);
      });
    });
  }
  
  // Авторизация
  auth.onAuthStateChanged(function(user) {
    currentUser = user;
    console.log("Auth:", user ? user.email : 'null');
    
    if (user) {
      db.collection('users').doc(user.uid).get().then(function(doc) {
        userRole = doc.exists ? doc.data().role : 'user';
        updateUI();
      });
    } else {
      userRole = 'guest';
      updateUI();
    }
  });
});

function updateUI() {
  var btns = {
    'btn-login': !currentUser,
    'btn-register': !currentUser,
    'btn-logout': !!currentUser,
    'btn-admin': userRole === 'admin'
  };
  
  for (var id in btns) {
    var el = document.getElementById(id);
    if (el) {
      el.classList.toggle('hidden', !btns[id]);
    }
  }
  
  var authExtra = document.getElementById('auth-extra');
  if (authExtra) authExtra.classList.toggle('hidden', !currentUser);
  
  var adminExtra = document.getElementById('admin-extra');
  if (adminExtra) adminExtra.classList.toggle('hidden', userRole !== 'admin');
}

// Загрузка по ссылке
window.addEventListener('load', function() {
  var params = new URLSearchParams(window.location.search);
  if (params.has('id')) {
    window.loadMemorial(params.get('id'));
  }
});
