/* ========================================
   Hunter - Chasse au Trésor Web App
   Main Application Logic
   ======================================== */

const API = '/api';

// ---- State ----
let state = {
  teamId: null,
  teamName: null,
  currentStep: 1,
  totalSteps: 10,
  stepData: null,
  selectedQcm: []
};

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  setupTabs();
  setupFormHandlers();
  restoreSession();
});

// ---- API Helpers ----
async function apiFetch(url, options = {}) {
  const resp = await fetch(API + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || 'Erreur serveur');
  }
  return data;
}

function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

// ---- Config ----
async function loadConfig() {
  try {
    const config = await apiFetch('/admin/config');
    document.getElementById('game-title').textContent = config.title;
    document.getElementById('game-subtitle').textContent = config.subtitle;
    document.title = config.title;
    state.totalSteps = config.totalSteps;

    // Apply theme
    if (config.theme) {
      const root = document.documentElement;
      if (config.theme.primaryColor) root.style.setProperty('--primary', config.theme.primaryColor);
      if (config.theme.secondaryColor) root.style.setProperty('--secondary', config.theme.secondaryColor);
      if (config.theme.accentColor) root.style.setProperty('--accent', config.theme.accentColor);
    }

    // Load help phone numbers
    if (config.helpPhones && config.helpPhones.length > 0) {
      const container = document.getElementById('help-popup-numbers');
      container.innerHTML = config.helpPhones.map(p => {
        const tel = p.number.replace(/\s/g, '');
        return `<a href="tel:${tel}" class="help-phone-link">📱 ${escapeHtml(p.label)} : ${escapeHtml(p.number)}</a>`;
      }).join('');
    }
  } catch (e) {
    console.error('Config load failed:', e);
  }
}

// ---- Session ----
function saveSession() {
  if (state.teamId) {
    localStorage.setItem('hunter_team_id', state.teamId);
    localStorage.setItem('hunter_team_name', state.teamName);
  }
}

function clearSession() {
  localStorage.removeItem('hunter_team_id');
  localStorage.removeItem('hunter_team_name');
}

async function restoreSession() {
  const teamId = localStorage.getItem('hunter_team_id');
  if (!teamId) return;

  try {
    showLoading();
    const team = await apiFetch(`/teams/${encodeURIComponent(teamId)}`);
    state.teamId = team.id;
    state.teamName = team.name;
    state.totalSteps = team.totalSteps;

    if (team.completedAt) {
      showScreen('final');
      await loadFinalScreen();
    } else {
      showScreen('hub');
      await loadHub();
    }
  } catch (e) {
    clearSession();
  } finally {
    hideLoading();
  }
}

// ---- Tabs ----
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      hideError();
    });
  });
}

// ---- Form Handlers ----
function setupFormHandlers() {
  // Create team
  document.getElementById('btn-create').addEventListener('click', async () => {
    const name = document.getElementById('team-name').value.trim();
    const membersRaw = document.getElementById('team-members').value.trim();

    if (!name) {
      showError('Veuillez entrer un nom d\'équipe.');
      return;
    }

    const members = membersRaw ? membersRaw.split(',').map(m => m.trim()).filter(Boolean) : [];

    try {
      showLoading();
      hideError();
      const team = await apiFetch('/teams', {
        method: 'POST',
        body: JSON.stringify({ name, members })
      });

      state.teamId = team.id;
      state.teamName = team.name;
      state.totalSteps = team.totalSteps;
      saveSession();

      showScreen('hub');
      await loadHub();
    } catch (e) {
      showError(e.message);
    } finally {
      hideLoading();
    }
  });

  // Resume team
  document.getElementById('btn-resume').addEventListener('click', async () => {
    const name = document.getElementById('resume-name').value.trim();

    if (!name) {
      showError('Veuillez entrer votre nom d\'équipe.');
      return;
    }

    try {
      showLoading();
      hideError();
      const team = await apiFetch('/teams/resume', {
        method: 'POST',
        body: JSON.stringify({ name })
      });

      state.teamId = team.id;
      state.teamName = team.name;
      state.totalSteps = team.totalSteps;
      saveSession();

      if (team.completedAt) {
        showScreen('final');
        await loadFinalScreen();
      } else {
        showScreen('hub');
        await loadHub();
      }
    } catch (e) {
      showError(e.message);
    } finally {
      hideLoading();
    }
  });

  // Enter key on inputs
  document.getElementById('team-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-create').click();
  });
  document.getElementById('resume-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-resume').click();
  });

  // Submit answer
  document.getElementById('btn-submit').addEventListener('click', submitAnswer);
}

// ---- Screens ----
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Error ----
function showError(msg) {
  const el = document.getElementById('home-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError() {
  document.getElementById('home-error').classList.add('hidden');
}

// ---- Hub ----
async function loadHub() {
  try {
    showLoading();
    const data = await apiFetch(`/steps/${encodeURIComponent(state.teamId)}`);

    document.getElementById('hub-team').textContent = '🏴‍☠️ ' + data.teamName;
    document.getElementById('hub-progress').textContent =
      `${data.completedCount}/${data.totalSteps} résolues`;
    document.getElementById('hub-progress-fill').style.width =
      `${(data.completedCount / data.totalSteps) * 100}%`;

    state.totalSteps = data.totalSteps;

    const grid = document.getElementById('hub-grid');
    grid.innerHTML = '';

    data.steps.forEach(step => {
      const el = document.createElement('div');
      el.className = 'hub-step' + (step.isCompleted ? ' completed' : '');
      el.innerHTML = `
        <div class="hub-step-number">${step.isCompleted ? '✓' : step.number}</div>
        <div class="hub-step-info">
          <div class="hub-step-title">${escapeHtml(step.title)}</div>
          <div class="hub-step-type">${step.icon} ${escapeHtml(step.type.replace('_', ' '))}</div>
        </div>
        <div class="hub-step-status">${step.isCompleted ? '✅' : '➡️'}</div>
      `;
      el.addEventListener('click', () => {
        if (step.isCompleted) return; // already done
        state.currentStep = step.number;
        showScreen('step');
        loadStep(step.number);
      });
      if (step.isCompleted) {
        el.style.cursor = 'default';
        el.style.opacity = '0.7';
      }
      grid.appendChild(el);
    });

    // Show final button if all completed
    const completeSection = document.getElementById('hub-complete');
    if (data.allCompleted) {
      completeSection.classList.remove('hidden');
      document.getElementById('btn-final').onclick = async () => {
        showScreen('final');
        await loadFinalScreen();
      };
    } else {
      completeSection.classList.add('hidden');
    }
  } catch (e) {
    console.error('Hub load failed:', e);
  } finally {
    hideLoading();
  }
}

function goToHub() {
  showScreen('hub');
  loadHub();
}

// ---- Step Loading ----
async function loadStep(stepNum) {
  try {
    showLoading();
    const step = await apiFetch(`/steps/${encodeURIComponent(state.teamId)}/${stepNum}`);
    state.stepData = step;
    state.selectedQcm = [];

    // Update progress
    document.getElementById('step-counter').textContent = `${stepNum}/${state.totalSteps}`;
    document.getElementById('progress-fill').style.width =
      `${((stepNum - 1) / state.totalSteps) * 100}%`;

    // Update step info
    document.getElementById('step-badge').textContent = `Étape ${stepNum}`;
    document.getElementById('step-title').textContent = step.title;
    document.getElementById('step-description').textContent = step.description;

    // Type badge
    const typeLabels = {
      single_answer: '✏️ Réponse libre',
      multiple_answers: '📝 Réponses multiples',
      multi_questions: '📝 Multi-questions',
      matching: '🔗 Associations',
      cipher: '🔐 Code secret',
      order: '📋 Ordre',
      qcm: '🎯 QCM',
      puzzle: '🧩 Énigme',
      photo_upload: '📷 Photo'
    };
    document.getElementById('step-type-badge').textContent = typeLabels[step.type] || step.type;

    // Image
    const imgContainer = document.getElementById('step-image-container');
    if (step.image) {
      document.getElementById('step-image').src = step.image;
      imgContainer.classList.remove('hidden');
    } else {
      imgContainer.classList.add('hidden');
    }

    // Hint
    const hintArea = document.getElementById('hint-area');
    if (step.hint) {
      document.getElementById('hint-text').textContent = step.hint;
      document.getElementById('hint-content').classList.add('hidden');
      hintArea.classList.remove('hidden');
    } else {
      hintArea.classList.add('hidden');
    }

    // Build answer area
    buildAnswerArea(step);

    // Reset feedback
    hideFeedback();

    // Re-enable submit
    document.getElementById('btn-submit').disabled = false;

  } catch (e) {
    console.error('Step load failed:', e);
  } finally {
    hideLoading();
  }
}

// ---- Answer Area Builder ----
function buildAnswerArea(step) {
  const area = document.getElementById('answer-area');
  area.innerHTML = '';

  switch (step.type) {
    case 'single_answer':
    case 'cipher':
    case 'puzzle':
      area.innerHTML = `
        <div class="answer-field">
          <label>${step.type === 'cipher' ? 'Entrez le code' : 'Votre réponse'}</label>
          <input type="text" id="answer-input" placeholder="${step.type === 'cipher' ? 'Code...' : 'Tapez votre réponse...'}" autocomplete="off">
        </div>
      `;
      // Enter key
      setTimeout(() => {
        const input = document.getElementById('answer-input');
        if (input) {
          input.focus();
          input.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('btn-submit').click();
          });
        }
      }, 100);
      break;

    case 'multiple_answers':
      let html = '';
      for (let i = 0; i < step.fieldCount; i++) {
        const label = step.fieldLabels ? step.fieldLabels[i] : `Réponse ${i + 1}`;
        html += `
          <div class="answer-field">
            <label>${escapeHtml(label)}</label>
            <input type="text" class="multi-answer" data-index="${i}" placeholder="..." autocomplete="off">
          </div>
        `;
      }
      area.innerHTML = html;
      break;

    case 'multi_questions':
      let mqHtml = '';
      step.questions.forEach((q, i) => {
        mqHtml += `
          <div class="mq-block">
            <div class="mq-description">${escapeHtml(q.description)}</div>
            ${q.hint ? `<button class="btn btn-hint btn-hint-mini" onclick="toggleMqHint(${i})">💡</button><div id="mq-hint-${i}" class="hint-content hidden"><p>${escapeHtml(q.hint)}</p></div>` : ''}
            <input type="text" class="multi-question-answer" data-index="${i}" placeholder="Réponse..." autocomplete="off">
          </div>
        `;
      });
      area.innerHTML = mqHtml;
      break;

    case 'matching':
      let matchHtml = '<div class="matching-grid">';
      step.leftItems.forEach((left, i) => {
        const options = step.rightItems.map(r =>
          `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`
        ).join('');
        matchHtml += `
          <div class="matching-row">
            <div class="matching-left">${escapeHtml(left)}</div>
            <div class="matching-arrow">→</div>
            <select class="matching-select" data-left="${escapeHtml(left)}">
              <option value="">Choisir...</option>
              ${options}
            </select>
          </div>
        `;
      });
      matchHtml += '</div>';
      area.innerHTML = matchHtml;
      break;

    case 'order':
      let orderHtml = '<ul class="order-list" id="order-list">';
      step.items.forEach((item, i) => {
        orderHtml += `
          <li class="order-item" draggable="true" data-value="${escapeHtml(item)}">
            <span class="order-number">${i + 1}</span>
            <span class="order-handle">⠿</span>
            <span class="order-text">${escapeHtml(item)}</span>
          </li>
        `;
      });
      orderHtml += '</ul>';
      area.innerHTML = orderHtml;
      setupDragAndDrop();
      break;

    case 'qcm':
      const indicator = step.multiSelect ? 'qcm-checkbox' : 'qcm-radio';
      let qcmHtml = '<div class="qcm-grid">';
      step.choices.forEach(choice => {
        qcmHtml += `
          <div class="qcm-option" data-value="${escapeHtml(choice)}">
            <div class="${indicator}"></div>
            <span class="qcm-label">${escapeHtml(choice)}</span>
          </div>
        `;
      });
      qcmHtml += '</div>';
      if (step.multiSelect) {
        qcmHtml += '<p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 8px; text-align: center;">Plusieurs réponses possibles</p>';
      }
      area.innerHTML = qcmHtml;

      // QCM click handlers
      document.querySelectorAll('.qcm-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const val = opt.dataset.value;
          if (step.multiSelect) {
            opt.classList.toggle('selected');
            if (state.selectedQcm.includes(val)) {
              state.selectedQcm = state.selectedQcm.filter(v => v !== val);
            } else {
              state.selectedQcm.push(val);
            }
          } else {
            document.querySelectorAll('.qcm-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            state.selectedQcm = [val];
          }
        });
      });
      break;

    case 'photo_upload':
      area.innerHTML = `
        <div class="photo-upload-area">
          <label class="photo-upload-label" id="photo-drop-zone">
            <input type="file" id="photo-input" accept="image/*" hidden>
            <div class="photo-upload-icon">📷</div>
            <div class="photo-upload-text">Cliquez ou déposez une photo ici</div>
            <div class="photo-upload-hint">JPEG, PNG, WebP — max 10 Mo</div>
          </label>
          <div id="photo-preview-container" class="photo-preview-container hidden">
            <img id="photo-preview" src="" alt="Aperçu">
            <button class="btn btn-back btn-sm" onclick="clearPhotoPreview()">✕ Changer</button>
          </div>
        </div>
      `;
      // File input handler
      setTimeout(() => {
        const input = document.getElementById('photo-input');
        const dropZone = document.getElementById('photo-drop-zone');
        if (input) {
          input.addEventListener('change', handlePhotoSelect);
        }
        if (dropZone) {
          dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-active'); });
          dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
          dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag-active');
            if (e.dataTransfer.files.length > 0) {
              document.getElementById('photo-input').files = e.dataTransfer.files;
              handlePhotoSelect({ target: { files: e.dataTransfer.files } });
            }
          });
        }
      }, 100);
      break;
  }
}

// ---- Drag and Drop for Order type ----
function setupDragAndDrop() {
  const list = document.getElementById('order-list');
  if (!list) return;

  let dragItem = null;

  list.querySelectorAll('.order-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      list.querySelectorAll('.order-item').forEach(i => i.classList.remove('drag-over'));
      updateOrderNumbers();
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (dragItem && dragItem !== item) {
        const items = [...list.children];
        const fromIndex = items.indexOf(dragItem);
        const toIndex = items.indexOf(item);
        if (fromIndex < toIndex) {
          list.insertBefore(dragItem, item.nextSibling);
        } else {
          list.insertBefore(dragItem, item);
        }
        updateOrderNumbers();
      }
    });

    // Touch support for mobile
    let touchStartY = 0;
    item.addEventListener('touchstart', e => {
      dragItem = item;
      touchStartY = e.touches[0].clientY;
      item.classList.add('dragging');
    }, { passive: true });

    item.addEventListener('touchmove', e => {
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetItem = target?.closest('.order-item');

      list.querySelectorAll('.order-item').forEach(i => i.classList.remove('drag-over'));
      if (targetItem && targetItem !== dragItem) {
        targetItem.classList.add('drag-over');
      }
    }, { passive: false });

    item.addEventListener('touchend', e => {
      item.classList.remove('dragging');
      const touch = e.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetItem = target?.closest('.order-item');

      if (targetItem && targetItem !== dragItem) {
        const items = [...list.children];
        const fromIndex = items.indexOf(dragItem);
        const toIndex = items.indexOf(targetItem);
        if (fromIndex < toIndex) {
          list.insertBefore(dragItem, targetItem.nextSibling);
        } else {
          list.insertBefore(dragItem, targetItem);
        }
      }

      list.querySelectorAll('.order-item').forEach(i => i.classList.remove('drag-over'));
      updateOrderNumbers();
    });
  });
}

function updateOrderNumbers() {
  document.querySelectorAll('#order-list .order-item').forEach((item, i) => {
    item.querySelector('.order-number').textContent = i + 1;
  });
}

// ---- Submit Answer ----
async function submitAnswer() {
  const step = state.stepData;
  if (!step) return;

  let answer;

  switch (step.type) {
    case 'single_answer':
    case 'cipher':
    case 'puzzle':
      answer = document.getElementById('answer-input')?.value?.trim();
      if (!answer) {
        showFeedback(false, 'Veuillez entrer une réponse.');
        return;
      }
      break;

    case 'multiple_answers':
      answer = [];
      document.querySelectorAll('.multi-answer').forEach(input => {
        answer.push(input.value.trim());
      });
      if (answer.some(a => !a)) {
        showFeedback(false, 'Veuillez remplir toutes les réponses.');
        return;
      }
      break;

    case 'multi_questions':
      answer = [];
      document.querySelectorAll('.multi-question-answer').forEach(input => {
        answer.push(input.value.trim());
      });
      if (answer.some(a => !a)) {
        showFeedback(false, 'Veuillez remplir toutes les réponses.');
        return;
      }
      break;

    case 'matching':
      answer = {};
      let allFilled = true;
      document.querySelectorAll('.matching-select').forEach(select => {
        if (!select.value) allFilled = false;
        answer[select.dataset.left] = select.value;
      });
      if (!allFilled) {
        showFeedback(false, 'Veuillez compléter toutes les associations.');
        return;
      }
      break;

    case 'order':
      answer = [];
      document.querySelectorAll('#order-list .order-item').forEach(item => {
        answer.push(item.dataset.value);
      });
      break;

    case 'qcm':
      if (state.selectedQcm.length === 0) {
        showFeedback(false, 'Veuillez sélectionner une réponse.');
        return;
      }
      answer = step.multiSelect ? state.selectedQcm : state.selectedQcm[0];
      break;

    case 'photo_upload':
      // Photo upload uses a separate flow
      await submitPhotoUpload();
      return;
  }

  try {
    showLoading();
    document.getElementById('btn-submit').disabled = true;

    const result = await apiFetch(
      `/steps/${encodeURIComponent(state.teamId)}/${state.currentStep}/answer`,
      {
        method: 'POST',
        body: JSON.stringify({ answer })
      }
    );

    if (result.valid) {
      showFeedback(true, result.message);

      if (result.isFinished) {
        // Game complete!
        setTimeout(async () => {
          showScreen('final');
          await loadFinalScreen();
        }, 2000);
      } else {
        // Back to hub after a short delay
        setTimeout(() => {
          goToHub();
        }, 2000);
      }
    } else {
      showFeedback(false, result.message);
      document.getElementById('btn-submit').disabled = false;
    }
  } catch (e) {
    showFeedback(false, e.message);
    document.getElementById('btn-submit').disabled = false;
  } finally {
    hideLoading();
  }
}

// ---- Photo Upload Helpers ----
let selectedPhotoFile = null;

function handlePhotoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showFeedback(false, 'Le fichier doit être une image.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showFeedback(false, 'La photo est trop volumineuse (max 10 Mo).');
    return;
  }

  selectedPhotoFile = file;

  // Show preview
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById('photo-preview').src = ev.target.result;
    document.getElementById('photo-preview-container').classList.remove('hidden');
    document.getElementById('photo-drop-zone').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function clearPhotoPreview() {
  selectedPhotoFile = null;
  document.getElementById('photo-preview-container').classList.add('hidden');
  document.getElementById('photo-drop-zone').classList.remove('hidden');
  document.getElementById('photo-input').value = '';
}

async function submitPhotoUpload() {
  if (!selectedPhotoFile) {
    showFeedback(false, 'Veuillez sélectionner une photo.');
    return;
  }

  try {
    showLoading();
    document.getElementById('btn-submit').disabled = true;

    // Read file as base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        // Remove "data:image/jpeg;base64," prefix
        const base64Data = dataUrl.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(selectedPhotoFile);
    });

    const result = await apiFetch(
      `/upload/${encodeURIComponent(state.teamId)}/${state.currentStep}`,
      {
        method: 'POST',
        body: JSON.stringify({ photo: base64, mimeType: selectedPhotoFile.type })
      }
    );

    showFeedback(true, result.message);
    selectedPhotoFile = null;

    if (result.isFinished) {
      setTimeout(async () => {
        showScreen('final');
        await loadFinalScreen();
      }, 2000);
    } else {
      setTimeout(() => {
        goToHub();
      }, 2000);
    }
  } catch (e) {
    showFeedback(false, e.message);
    document.getElementById('btn-submit').disabled = false;
  } finally {
    hideLoading();
  }
}

// ---- Feedback ----
function showFeedback(success, message) {
  const fb = document.getElementById('feedback');
  fb.classList.remove('hidden', 'success', 'error');
  fb.classList.add(success ? 'success' : 'error');
  document.getElementById('feedback-message').textContent = message;
  fb.style.animation = 'none';
  fb.offsetHeight; // trigger reflow
  fb.style.animation = '';
}

function hideFeedback() {
  document.getElementById('feedback').classList.add('hidden');
}

// ---- Multi-question hints ----
function toggleMqHint(index) {
  const el = document.getElementById('mq-hint-' + index);
  if (el) el.classList.toggle('hidden');
}

// ---- Hint ----
function toggleHint() {
  const content = document.getElementById('hint-content');
  const btn = document.getElementById('btn-hint');
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    btn.textContent = '💡 Masquer l\'indice';
  } else {
    content.classList.add('hidden');
    btn.textContent = '💡 Voir l\'indice';
  }
}

// ---- Final Screen ----
async function loadFinalScreen() {
  try {
    showLoading();
    const data = await apiFetch(`/steps/${encodeURIComponent(state.teamId)}/final`);

    document.getElementById('final-team-name').textContent = '🏴‍☠️ ' + data.teamName;
    document.getElementById('final-duration').textContent = data.duration;
    document.getElementById('final-attempts').textContent = data.totalAttempts;
    document.getElementById('final-message').textContent = data.finalMessage;

    if (data.finalImage) {
      document.getElementById('final-image').src = data.finalImage;
      document.getElementById('final-image-container').classList.remove('hidden');
    }

    // Launch confetti!
    launchConfetti();
  } catch (e) {
    console.error('Final screen load failed:', e);
  } finally {
    hideLoading();
  }
}

// ---- Confetti Effect ----
function launchConfetti() {
  const container = document.getElementById('confetti');
  if (!container) return;

  const colors = ['#e67e22', '#27ae60', '#3498db', '#e74c3c', '#f39c12', '#9b59b6'];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.classList.add('confetti-piece');
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
    piece.style.animationDelay = Math.random() * 2 + 's';
    piece.style.width = (Math.random() * 8 + 6) + 'px';
    piece.style.height = (Math.random() * 8 + 6) + 'px';
    container.appendChild(piece);
  }
}

// ---- Help Popup ----
function toggleHelpPopup() {
  const popup = document.getElementById('help-popup');
  popup.classList.toggle('hidden');
}

// Close help popup when clicking outside
document.addEventListener('click', (e) => {
  const popup = document.getElementById('help-popup');
  const btn = document.getElementById('btn-help');
  if (!popup.contains(e.target) && e.target !== btn) {
    popup.classList.add('hidden');
  }
});

// ---- Utilities ----
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========================================
//  ADMIN
// ========================================

let adminToken = null;

// Setup admin tabs
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-admintab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-admintab]').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('admintab-' + tab.dataset.admintab).classList.add('active');
    });
  });

  // Admin login
  document.getElementById('btn-admin-login').addEventListener('click', adminLogin);
  document.getElementById('admin-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') adminLogin();
  });

  // Reset all
  document.getElementById('btn-reset-all').addEventListener('click', async () => {
    if (!confirm('⚠️ Supprimer TOUTES les équipes et leur progression ? Cette action est irréversible.')) return;
    try {
      showLoading();
      await adminFetch('/admin/reset', { method: 'POST' });
      await loadAdminTeams();
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      hideLoading();
    }
  });

  // Restore admin session
  const savedToken = sessionStorage.getItem('hunter_admin_token');
  if (savedToken) {
    adminToken = savedToken;
  }
});

async function adminFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminToken) {
    headers['Authorization'] = 'Bearer ' + adminToken;
  }
  const resp = await fetch(API + url, { headers, ...options });
  const data = await resp.json();
  if (!resp.ok) {
    if (resp.status === 401) {
      adminToken = null;
      sessionStorage.removeItem('hunter_admin_token');
      showScreen('admin-login');
    }
    throw new Error(data.error || 'Erreur serveur');
  }
  return data;
}

async function adminLogin() {
  const password = document.getElementById('admin-password').value;
  const errorEl = document.getElementById('admin-login-error');

  if (!password) {
    errorEl.textContent = 'Veuillez entrer le mot de passe.';
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    showLoading();
    errorEl.classList.add('hidden');
    const result = await apiFetch('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    adminToken = result.token;
    sessionStorage.setItem('hunter_admin_token', adminToken);
    document.getElementById('admin-password').value = '';

    showScreen('admin');
    await loadAdminTeams();
    await loadAdminAnswers();
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.classList.remove('hidden');
  } finally {
    hideLoading();
  }
}

function adminLogout() {
  if (adminToken) {
    fetch(API + '/admin/logout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + adminToken }
    }).catch(() => {});
  }
  adminToken = null;
  sessionStorage.removeItem('hunter_admin_token');
  showScreen('home');
}

async function loadAdminTeams() {
  try {
    const teams = await adminFetch('/admin/teams');
    const list = document.getElementById('admin-teams-list');

    if (teams.length === 0) {
      list.innerHTML = '<div class="admin-empty">Aucune équipe inscrite pour le moment.</div>';
      return;
    }

    list.innerHTML = teams.map(team => {
      const startDate = new Date(team.startedAt).toLocaleString('fr-FR');
      const isComplete = team.completedAt !== null;
      const statusClass = isComplete ? 'done' : 'in-progress';
      const statusText = isComplete ? '✅ Terminé' : '🔄 En cours';

      let duration = '-';
      if (isComplete) {
        const d = Math.floor((new Date(team.completedAt) - new Date(team.startedAt)) / 1000);
        duration = `${Math.floor(d / 60)}min ${d % 60}s`;
      }

      const stepDots = Array.from({ length: team.totalSteps }, (_, i) => {
        const done = team.completedSteps.includes(i + 1);
        return `<div class="admin-step-dot ${done ? 'done' : ''}">${i + 1}</div>`;
      }).join('');

      const photosHtml = Object.keys(team.photos).length > 0
        ? `<div class="admin-team-photos">
            <div class="admin-detail-label">📷 Photos uploadées</div>
            <div class="admin-photos-grid">
              ${Object.entries(team.photos).map(([stepNum, url]) =>
                `<div class="admin-photo-item">
                  <a href="${escapeHtml(url)}" target="_blank">
                    <img src="${escapeHtml(url)}" alt="Photo étape ${stepNum}" class="admin-photo-thumb">
                  </a>
                  <span class="admin-photo-label">Étape ${stepNum}</span>
                  <a href="${escapeHtml(url)}" download="${escapeHtml(team.name)}_etape${stepNum}" class="admin-photo-download">⬇️</a>
                </div>`
              ).join('')}
            </div>
          </div>`
        : '';

      return `
        <div class="admin-team-card ${isComplete ? 'completed' : ''}">
          <div class="admin-team-header">
            <div class="admin-team-name">
              🏴‍☠️ ${escapeHtml(team.name)}
              ${team.members.length ? '<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 400;">(' + escapeHtml(team.members.join(', ')) + ')</span>' : ''}
            </div>
            <span class="admin-team-status ${statusClass}">${statusText}</span>
          </div>
          <div class="admin-team-details">
            <div class="admin-detail">
              <div class="admin-detail-label">Progression</div>
              <div class="admin-detail-value">${team.completedSteps.length}/${team.totalSteps}</div>
            </div>
            <div class="admin-detail">
              <div class="admin-detail-label">Tentatives</div>
              <div class="admin-detail-value">${team.totalAttempts}</div>
            </div>
            <div class="admin-detail">
              <div class="admin-detail-label">Début</div>
              <div class="admin-detail-value" style="font-size: 0.8rem;">${startDate}</div>
            </div>
            <div class="admin-detail">
              <div class="admin-detail-label">Durée</div>
              <div class="admin-detail-value">${duration}</div>
            </div>
          </div>
          <div class="admin-steps-progress">${stepDots}</div>
          ${photosHtml}
          <div class="admin-team-actions">
            <button class="btn btn-danger btn-sm" onclick="deleteTeam('${team.id}', '${escapeHtml(team.name)}')">🗑️ Supprimer</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Admin teams load failed:', e);
  }
}

async function deleteTeam(teamId, teamName) {
  if (!confirm(`Supprimer l'équipe "${teamName}" ?`)) return;
  try {
    showLoading();
    await adminFetch(`/admin/teams/${teamId}`, { method: 'DELETE' });
    await loadAdminTeams();
  } catch (e) {
    alert('Erreur : ' + e.message);
  } finally {
    hideLoading();
  }
}

async function loadAdminAnswers() {
  try {
    const steps = await adminFetch('/admin/steps');
    const list = document.getElementById('admin-answers-list');

    list.innerHTML = steps.map(step => {
      let answerHtml = '';

      switch (step.type) {
        case 'single_answer':
        case 'cipher':
        case 'puzzle':
          answerHtml = `<strong>Réponses acceptées :</strong> ${step.answers.map(a => `<code>${escapeHtml(a)}</code>`).join(', ')}`;
          break;

        case 'multiple_answers':
          answerHtml = `<strong>Réponses :</strong><ul class="answer-list">${step.answers.map(a => `<li><code>${escapeHtml(a)}</code></li>`).join('')}</ul>`;
          break;

        case 'matching':
          answerHtml = `<strong>Associations :</strong><ul class="answer-list">${step.pairs.map(p => `<li>${escapeHtml(p.left)} → <code>${escapeHtml(p.right)}</code></li>`).join('')}</ul>`;
          break;

        case 'order':
          answerHtml = `<strong>Ordre correct :</strong><ol class="answer-list">${step.correctOrder.map(i => `<li><code>${escapeHtml(i)}</code></li>`).join('')}</ol>`;
          break;

        case 'qcm':
          answerHtml = `<strong>Choix :</strong> ${step.choices.map(c =>
            step.answers.includes(c)
              ? `<code style="background: rgba(39,174,96,0.2);">${escapeHtml(c)} ✓</code>`
              : `<code>${escapeHtml(c)}</code>`
          ).join(', ')}`;
          break;

        case 'multi_questions':
          answerHtml = `<strong>Questions :</strong><ul class="answer-list">${step.questions.map((q, i) =>
            `<li>${escapeHtml(q.description)}<br>→ ${q.answers.map(a => `<code>${escapeHtml(a)}</code>`).join(', ')}</li>`
          ).join('')}</ul>`;
          break;

        case 'photo_upload':
          answerHtml = `<strong>📷 Upload de photo</strong> — L'équipe doit charger une photo pour valider.`;
          break;
      }

      if (step.hint) {
        answerHtml += `<br><small style="color: var(--text-muted);">💡 Indice : ${escapeHtml(step.hint)}</small>`;
      }

      return `
        <div class="admin-answer-card">
          <div class="admin-answer-header">
            <span class="admin-answer-title">${step.number}. ${escapeHtml(step.title)}</span>
            <span class="admin-answer-type">${step.type}</span>
          </div>
          <div class="admin-answer-body">${answerHtml}</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Admin answers load failed:', e);
  }
}

