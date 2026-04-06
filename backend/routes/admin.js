const express = require('express');
const { readTeams, readConfig } = require('../lib/data');

const router = express.Router();

// Simple admin view - get all teams progress
router.get('/teams', (req, res) => {
  const teams = readTeams();
  const config = readConfig();
  const totalSteps = config.steps.length;

  const summary = teams.map(t => ({
    id: t.id,
    name: t.name,
    members: t.members,
    currentStep: t.currentStep,
    completedSteps: t.completedSteps.length,
    totalSteps,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    totalAttempts: Object.values(t.attempts || {}).reduce((a, b) => a + b, 0)
  }));

  res.json(summary);
});

// Get game config (public parts only)
router.get('/config', (req, res) => {
  const config = readConfig();
  res.json({
    title: config.title,
    subtitle: config.subtitle || '',
    totalSteps: config.steps.length,
    theme: config.theme || {}
  });
});

module.exports = router;
