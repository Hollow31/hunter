const express = require('express');
const { readTeams, writeTeams, readConfig } = require('../lib/data');
const { validateAnswer } = require('../lib/validators');

const router = express.Router();

// Get all steps overview for a team (hub page)
router.get('/:teamId', (req, res) => {
  const { teamId } = req.params;

  const teams = readTeams();
  const team = teams.find(t => t.id === teamId);

  if (!team) {
    return res.status(404).json({ error: 'Équipe non trouvée.' });
  }

  const config = readConfig();

  const typeIcons = {
    single_answer: '✏️',
    multiple_answers: '📝',
    multi_questions: '📝',
    matching: '🔗',
    cipher: '🔐',
    order: '📋',
    qcm: '🎯',
    puzzle: '🧩',
    photo_upload: '📷'
  };

  const stepsOverview = config.steps.map((step, i) => ({
    number: i + 1,
    title: step.title,
    type: step.type,
    icon: typeIcons[step.type] || '❓',
    isCompleted: team.completedSteps.includes(i + 1)
  }));

  res.json({
    teamName: team.name,
    totalSteps: config.steps.length,
    completedCount: team.completedSteps.length,
    allCompleted: team.completedSteps.length >= config.steps.length,
    steps: stepsOverview
  });
});

// Get final page data (only if all steps completed)
// MUST be before /:teamId/:stepNumber to avoid "final" being matched as a step number
router.get('/:teamId/final', (req, res) => {
  const { teamId } = req.params;

  const teams = readTeams();
  const team = teams.find(t => t.id === teamId);

  if (!team) {
    return res.status(404).json({ error: 'Équipe non trouvée.' });
  }

  const config = readConfig();

  if (team.completedSteps.length < config.steps.length) {
    return res.status(403).json({ error: 'Toutes les étapes ne sont pas encore validées.' });
  }

  const startTime = new Date(team.startedAt);
  const endTime = new Date(team.completedAt);
  const duration = Math.floor((endTime - startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  res.json({
    teamName: team.name,
    finalMessage: config.finalMessage,
    finalImage: config.finalImage || null,
    duration: `${minutes}min ${seconds}s`,
    totalAttempts: Object.values(team.attempts).reduce((a, b) => a + b, 0)
  });
});

// Get step info for a team (without answers!)
router.get('/:teamId/:stepNumber', (req, res) => {
  const { teamId, stepNumber } = req.params;
  const stepNum = parseInt(stepNumber, 10);

  const teams = readTeams();
  const team = teams.find(t => t.id === teamId);

  if (!team) {
    return res.status(404).json({ error: 'Équipe non trouvée.' });
  }

  const config = readConfig();

  if (isNaN(stepNum) || stepNum < 1 || stepNum > config.steps.length) {
    return res.status(400).json({ error: 'Numéro d\'étape invalide.' });
  }

  const step = config.steps[stepNum - 1];

  // Build safe step data (no answers!)
  const safeStep = {
    id: step.id,
    number: stepNum,
    title: step.title,
    description: step.description,
    type: step.type,
    image: step.image || null,
    hint: step.hint || null,
    totalSteps: config.steps.length,
    isCompleted: team.completedSteps.includes(stepNum)
  };

  // Type-specific data (without revealing answers)
  if (step.type === 'matching') {
    safeStep.leftItems = step.pairs.map(p => p.left);
    safeStep.rightItems = step.pairs.map(p => p.right).sort(() => Math.random() - 0.5);
  }
  if (step.type === 'order') {
    safeStep.items = [...step.correctOrder].sort(() => Math.random() - 0.5);
  }
  if (step.type === 'qcm') {
    safeStep.choices = step.choices;
    safeStep.multiSelect = step.answers.length > 1;
  }
  if (step.type === 'multiple_answers') {
    safeStep.fieldCount = step.answers.length;
    safeStep.fieldLabels = step.fieldLabels || null;
  }
  if (step.type === 'multi_questions') {
    safeStep.questions = step.questions.map(q => ({
      description: q.description,
      hint: q.hint || null
    }));
  }

  res.json(safeStep);
});

// Submit answer for a step
router.post('/:teamId/:stepNumber/answer', (req, res) => {
  const { teamId, stepNumber } = req.params;
  const { answer } = req.body;
  const stepNum = parseInt(stepNumber, 10);

  const teams = readTeams();
  const teamIndex = teams.findIndex(t => t.id === teamId);

  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Équipe non trouvée.' });
  }

  const team = teams[teamIndex];
  const config = readConfig();

  if (isNaN(stepNum) || stepNum < 1 || stepNum > config.steps.length) {
    return res.status(400).json({ error: 'Numéro d\'étape invalide.' });
  }

  if (team.completedSteps.includes(stepNum)) {
    return res.status(400).json({ error: 'Cette étape a déjà été validée.' });
  }

  if (answer === undefined || answer === null) {
    return res.status(400).json({ error: 'La réponse est requise.' });
  }

  const step = config.steps[stepNum - 1];

  // Track attempts
  if (!team.attempts[stepNum]) {
    team.attempts[stepNum] = 0;
  }
  team.attempts[stepNum]++;

  const result = validateAnswer(answer, step);

  if (result.valid) {
    team.completedSteps.push(stepNum);

    const isLastStep = team.completedSteps.length >= config.steps.length;
    if (isLastStep) {
      team.completedAt = new Date().toISOString();
    }

    teams[teamIndex] = team;
    writeTeams(teams);

    const response = {
      valid: true,
      message: result.message,
      isFinished: isLastStep
    };

    if (isLastStep) {
      response.finalMessage = config.finalMessage;
      response.finalImage = config.finalImage || null;
    }

    return res.json(response);
  }

  teams[teamIndex] = team;
  writeTeams(teams);

  res.json({
    valid: false,
    message: result.message,
    attempts: team.attempts[stepNum]
  });
});

module.exports = router;
