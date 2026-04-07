const express = require('express');
const crypto = require('crypto');
const { readTeams, writeTeams, readConfig } = require('../lib/data');

const router = express.Router();

// Active admin tokens (in-memory, cleared on restart)
const adminTokens = new Set();

// Admin login
router.post('/login', (req, res) => {
  const { password } = req.body;
  const config = readConfig();

  if (!password || password !== config.adminPassword) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.add(token);

  res.json({ token });
});

// Middleware: check admin token
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non autorisé.' });
  }
  const token = auth.slice(7);
  if (!adminTokens.has(token)) {
    return res.status(401).json({ error: 'Session expirée, reconnectez-vous.' });
  }
  next();
}

// Get all teams progress (admin)
router.get('/teams', requireAdmin, (req, res) => {
  const teams = readTeams();
  const config = readConfig();
  const totalSteps = config.steps.length;

  const summary = teams.map(t => ({
    id: t.id,
    name: t.name,
    members: t.members,
    completedSteps: t.completedSteps || [],
    totalSteps,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    attempts: t.attempts || {},
    totalAttempts: Object.values(t.attempts || {}).reduce((a, b) => a + b, 0)
  }));

  res.json(summary);
});

// Get all steps with answers (admin)
router.get('/steps', requireAdmin, (req, res) => {
  const config = readConfig();

  const steps = config.steps.map((step, i) => ({
    number: i + 1,
    title: step.title,
    type: step.type,
    description: step.description,
    answers: step.answers || null,
    pairs: step.pairs || null,
    correctOrder: step.correctOrder || null,
    choices: step.choices || null,
    questions: step.questions || null,
    hint: step.hint || null
  }));

  res.json(steps);
});

// Reset all teams (admin)
router.post('/reset', requireAdmin, (req, res) => {
  writeTeams([]);
  res.json({ message: 'Toutes les équipes ont été supprimées.' });
});

// Delete a specific team (admin)
router.delete('/teams/:id', requireAdmin, (req, res) => {
  const teams = readTeams();
  const filtered = teams.filter(t => t.id !== req.params.id);

  if (filtered.length === teams.length) {
    return res.status(404).json({ error: 'Équipe non trouvée.' });
  }

  writeTeams(filtered);
  res.json({ message: 'Équipe supprimée.' });
});

// Get game config (public parts only - no auth required)
router.get('/config', (req, res) => {
  const config = readConfig();
  res.json({
    title: config.title,
    subtitle: config.subtitle || '',
    totalSteps: config.steps.length,
    theme: config.theme || {}
  });
});

// Admin logout
router.post('/logout', (req, res) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    adminTokens.delete(auth.slice(7));
  }
  res.json({ message: 'Déconnecté.' });
});

module.exports = router;
