const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readTeams, writeTeams, readConfig } = require('../lib/data');

const router = express.Router();

// Create a new team
router.post('/', (req, res) => {
  const { name, members } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Le nom d\'équipe est requis.' });
  }
  if (name.trim().length > 50) {
    return res.status(400).json({ error: 'Le nom d\'équipe est trop long (max 50 caractères).' });
  }

  const teams = readTeams();

  // Check for duplicate team name
  if (teams.find(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: 'Ce nom d\'équipe est déjà pris.' });
  }

  const config = readConfig();
  const totalSteps = config.steps.length;

  const team = {
    id: uuidv4(),
    name: name.trim(),
    members: members || [],
    currentStep: 1,
    completedSteps: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    attempts: {}
  };

  teams.push(team);
  writeTeams(teams);

  res.status(201).json({
    id: team.id,
    name: team.name,
    currentStep: team.currentStep,
    totalSteps
  });
});

// Get team by ID (for session restore)
router.get('/:id', (req, res) => {
  const teams = readTeams();
  const team = teams.find(t => t.id === req.params.id);

  if (!team) {
    return res.status(404).json({ error: 'Équipe non trouvée.' });
  }

  const config = readConfig();
  const totalSteps = config.steps.length;

  res.json({
    id: team.id,
    name: team.name,
    members: team.members,
    currentStep: team.currentStep,
    completedSteps: team.completedSteps,
    totalSteps,
    completedAt: team.completedAt,
    startedAt: team.startedAt
  });
});

// Resume a team by name
router.post('/resume', (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Le nom d\'équipe est requis.' });
  }

  const teams = readTeams();
  const team = teams.find(t => t.name.toLowerCase() === name.trim().toLowerCase());

  if (!team) {
    return res.status(404).json({ error: 'Équipe non trouvée.' });
  }

  const config = readConfig();
  const totalSteps = config.steps.length;

  res.json({
    id: team.id,
    name: team.name,
    currentStep: team.currentStep,
    completedSteps: team.completedSteps,
    totalSteps,
    completedAt: team.completedAt
  });
});

module.exports = router;
