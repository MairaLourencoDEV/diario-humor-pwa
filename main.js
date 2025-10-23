// Mapeamento dos humores e caminho dos ícones 
const MOODS = [
  { id: 'feliz', label: 'Feliz', icon128: 'icons/pumpkinHappy-128.png', icon512: 'icons/pumpkinHappy-512.png' },
  { id: 'confuso', label: 'Confuso', icon128: 'icons/pumpkinConfused-128.png', icon512: 'icons/pumpkinConfused-512.png' },
  { id: 'enjoado', label: 'Enjoado', icon128: 'icons/pumpkinNauseous-128.png', icon512: 'icons/pumpkinNauseous-512.png' },
  { id: 'triste', label: 'Triste', icon128: 'icons/ghostSad-128.png', icon512: 'icons/ghostSad-512.png' },
  { id: 'raiva', label: 'Com raiva', icon128: 'icons/ghostAngry-128.png', icon512: 'icons/ghostAngry-512.png' }
];

const STORAGE_KEY = 'diarioHumor_v1';
let editId = null;
let deferredPrompt = null;
let stream = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('entryDate').valueAsDate = new Date();

  document.getElementById('entryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveEntry();
  });
  document.getElementById('clearForm').addEventListener('click', resetForm);

  // câmera controls
  document.getElementById('openCamera').addEventListener('click', openCameraStream);
  document.getElementById('takePhoto').addEventListener('click', capturePhoto);
  document.getElementById('closeCamera').addEventListener('click', stopCamera);

  renderEntries();
  setupInstallUI();
  registerServiceWorker();
});

function getEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Erro ao ler storage', e);
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function saveEntry() {
  const date = document.getElementById('entryDate').value;
  const note = document.getElementById('entryNote').value.trim();
  const selected = document.querySelector('input[name="mood"]:checked');
  const photoEl = document.querySelector('#photoPreview img');

  if (!selected) {
    alert('Escolha um humor.');
    return;
  }

  const moodId = selected.value;
  const moodDef = MOODS.find(m => m.id === moodId) || { id: moodId, label: moodId, icon128: '', icon512: '' };

  const entries = getEntries();
  const photoData = photoEl ? photoEl.src : null;

  if (editId) {
    const idx = entries.findIndex(e => e.id === editId);
    if (idx >= 0) {
      entries[idx] = { ...entries[idx], date, mood: moodDef, note, photo: photoData, updatedAt: new Date().toISOString() };
    }
    editId = null;
  } else {
    const entry = {
      id: `e-${Date.now()}`,
      date,
      mood: moodDef,
      note,
      photo: photoData,
      createdAt: new Date().toISOString()
    };
    entries.unshift(entry);
  }

  saveEntries(entries);
  renderEntries();
  resetForm();
}

function renderEntries() {
  const container = document.getElementById('entriesContainer');
  const emptyState = document.getElementById('emptyState');
  container.innerHTML = '';

  const entries = getEntries();
  if (entries.length === 0) {
    emptyState.style.display = 'block';
    return;
  } else {
    emptyState.style.display = 'none';
  }

  entries.forEach(entry => {
    const card = document.createElement('article');
    card.className = 'entry-card';

    const emojiDiv = document.createElement('div');
    emojiDiv.className = 'emoji';
    const moodImg = document.createElement('img');
    moodImg.src = entry.mood.icon128 || '';
    moodImg.alt = entry.mood.label || '';
    emojiDiv.appendChild(moodImg);

    const meta = document.createElement('div');
    meta.className = 'entry-meta';

    const dateEl = document.createElement('div');
    dateEl.className = 'entry-date';
    dateEl.innerText = formatDateHuman(entry.date);

    const note = document.createElement('div');
    note.className = 'entry-note';
    note.innerText = entry.note || '(sem nota)';

    meta.appendChild(dateEl);
    meta.appendChild(note);

    if (entry.photo) {
      const photo = document.createElement('img');
      photo.src = entry.photo;
      photo.style.maxWidth = '96px';
      photo.style.borderRadius = '8px';
      photo.style.marginTop = '8px';
      meta.appendChild(photo);
    }

    const actions = document.createElement('div');
    actions.className = 'entry-actions';

    const quoteBtn = document.createElement('button');
    quoteBtn.className = 'icon-btn';
    quoteBtn.innerText = 'Ver citação';
    quoteBtn.addEventListener('click', async () => {
      const q = await fetchQuote();
      alert(q ? `"${q.content}" — ${q.author}` : 'Não foi possível obter citação.');
    });

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.innerText = 'Editar';
    editBtn.addEventListener('click', () => editEntry(entry.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.innerText = 'Excluir';
    delBtn.addEventListener('click', () => deleteEntry(entry.id));

    actions.appendChild(quoteBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    card.appendChild(emojiDiv);
    card.appendChild(meta);
    card.appendChild(actions);

    container.appendChild(card);
  });
}

function formatDateHuman(dateStr) {
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function resetForm() {
  document.getElementById('entryDate').valueAsDate = new Date();
  document.getElementById('entryNote').value = '';
  document.querySelectorAll('input[name="mood"]').forEach(r => r.checked = false);
  const pv = document.getElementById('photoPreview');
  pv.innerHTML = '';
  stopCamera();
}

function editEntry(id) {
  const entries = getEntries();
  const e = entries.find(x => x.id === id);
  if (!e) return;
  editId = id;
  document.getElementById('entryDate').value = e.date;
  document.getElementById('entryNote').value = e.note || '';
  document.querySelectorAll('input[name="mood"]').forEach(r => r.checked = (r.value === e.mood.id));
  if (e.photo) {
    const pv = document.getElementById('photoPreview');
    pv.innerHTML = `<img src="${e.photo}" alt="foto" />`;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteEntry(id) {
  if (!confirm('Excluir esta entrada?')) return;
  const entries = getEntries().filter(e => e.id !== id);
  saveEntries(entries);
  renderEntries();
}

/* CÂMERA */
async function openCameraStream() {
  const video = document.getElementById('cameraPreview');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Câmera não suportada neste dispositivo.');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    video.style.display = 'block';
  } catch (err) {
    console.error('Erro ao acessar câmera', err);
    alert('Permissão de câmera negada ou erro ao abrir câmera.');
  }
}

function stopCamera() {
  const video = document.getElementById('cameraPreview');
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  video.style.display = 'none';
}

function capturePhoto() {
  const video = document.getElementById('cameraPreview');
  const canvas = document.getElementById('cameraCanvas');
  if (!video.srcObject) {
    alert('Abra a câmera antes de tirar a foto.');
    return;
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  const pv = document.getElementById('photoPreview');
  pv.innerHTML = `<img src="${dataUrl}" alt="foto" />`;
  stopCamera();
}

/* QUOTE API */
async function fetchQuote() {
  try {
    const res = await fetch('https://api.quotable.io/random');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('Erro ao buscar citação', e);
    return null;
  }
}

/* PWA install prompt */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  btn.style.display = 'inline-block';
  btn.addEventListener('click', async () => {
    btn.style.display = 'none';
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
});

function setupInstallUI() {
  const btn = document.getElementById('installBtn');
  btn.style.display = 'none';
}

/* SERVICE WORKER */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(() => console.log('Service Worker registrado'))
      .catch(err => console.error('Erro SW', err));
  }
}
