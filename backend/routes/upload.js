const express = require('express');
const fs = require('fs');
const path = require('path');
const { readTeams, writeTeams, readConfig } = require('../lib/data');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Middleware to properly parse raw binary body for image uploads
const rawImageParser = express.raw({ type: 'image/*', limit: '10mb' });

// Upload a photo for a photo_upload step
router.post('/:teamId/:stepNumber', rawImageParser, (req, res) => {
  const { teamId, stepNumber } = req.params;
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

  const step = config.steps[stepNum - 1];
  if (step.type !== 'photo_upload') {
    return res.status(400).json({ error: 'Cette étape n\'est pas de type photo.' });
  }

  if (team.completedSteps.includes(stepNum)) {
    return res.status(400).json({ error: 'Cette étape a déjà été validée.' });
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('image/')) {
    return res.status(400).json({ error: 'Le fichier doit être une image (JPEG, PNG, WebP).' });
  }

  const buffer = req.body;

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return res.status(400).json({ error: 'Aucune photo reçue.' });
  }

  if (buffer.length > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'La photo est trop volumineuse (max 10 Mo).' });
  }

  // Determine extension
  const mediaType = contentType.split(';')[0].trim();
  const extMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };
  const ext = extMap[mediaType] || '.jpg';

  // Save file: team-photos/<teamId>_step<N>.<ext>
  const photosDir = path.join(UPLOADS_DIR, 'team-photos');
  if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
  }

  // Sanitize team name for filename
  const safeName = team.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const filename = `${safeName}_step${stepNum}${ext}`;
  const filepath = path.join(photosDir, filename);

  fs.writeFileSync(filepath, buffer);

  // Mark step as completed
  team.completedSteps.push(stepNum);

  if (!team.attempts[stepNum]) {
    team.attempts[stepNum] = 0;
  }
  team.attempts[stepNum]++;

  const isLastStep = team.completedSteps.length >= config.steps.length;
  if (isLastStep) {
    team.completedAt = new Date().toISOString();
  }

  // Store photo path in team data
  if (!team.photos) team.photos = {};
  team.photos[stepNum] = `/uploads/team-photos/${filename}`;

  teams[teamIndex] = team;
  writeTeams(teams);

  res.json({
    valid: true,
    message: 'Photo enregistrée avec succès !',
    photoUrl: `/uploads/team-photos/${filename}`,
    isFinished: isLastStep
  });
});

module.exports = router;
