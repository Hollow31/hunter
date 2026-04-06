const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'teams.json');

function readTeams() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
    return [];
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeTeams(teams) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(teams, null, 2), 'utf8');
}

function readConfig() {
  const configFile = path.join(__dirname, '..', 'config', 'steps.json');
  const raw = fs.readFileSync(configFile, 'utf8');
  return JSON.parse(raw);
}

module.exports = { readTeams, writeTeams, readConfig };
