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
      // Already finished
      state.currentStep = team.totalSteps;
      showScreen('final');
      await loadFinalScreen();
    } else {
      state.currentStep = team.currentStep;
      showScreen('step');
      await loadStep(state.currentStep);
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
      state.currentStep = team.currentStep;
      state.totalSteps = team.totalSteps;
      saveSession();

      showScreen('step');
      await loadStep(state.currentStep);
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
      state.currentStep = team.currentStep;
      state.totalSteps = team.totalSteps;
      saveSession();

      if (team.completedAt) {
        showScreen('final');
        await loadFinalScreen();
      } else {
        showScreen('step');
        await loadStep(state.currentStep);
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

// ---- Step Loading ----
async function loadStep(stepNum) {
  try {
    showLoading();
    const step = await apiFetch(`/steps/${encodeURIComponent(state.teamId)}/${stepNum}`);
    state.stepData = step;
    state.selectedQcm = [];

    // Update progress
    document.getElementById('team-display').textContent = '🏴‍☠️ ' + state.teamName;
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
      matching: '🔗 Associations',
      cipher: '🔐 Code secret',
      order: '📋 Ordre',
      qcm: '🎯 QCM',
      puzzle: '🧩 Énigme'
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

      // Animate progress
      document.getElementById('progress-fill').style.width =
        `${(state.currentStep / state.totalSteps) * 100}%`;

      if (result.isFinished) {
        // Game complete!
        setTimeout(async () => {
          showScreen('final');
          await loadFinalScreen();
        }, 1800);
      } else {
        // Next step
        state.currentStep = result.nextStep;
        setTimeout(() => {
          loadStep(state.currentStep);
        }, 1800);
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

// ---- Utilities ----
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
