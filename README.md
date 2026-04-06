# 🗺️ Hunter - Chasse au Trésor Web App

Application web moderne pour gérer une chasse au trésor par équipes. Interface mobile-friendly, thémable, avec 7 types d'épreuves différents et sauvegarde automatique de la progression.

---

## 🎯 Fonctionnalités

- **10 étapes configurables** avec différents types d'épreuves
- **7 types d'épreuves** : réponse libre, réponses multiples, associations, code secret, remise en ordre, QCM, énigme
- **Gestion d'équipes** : création, reprise de partie, sauvegarde automatique
- **Page finale** avec message de victoire, statistiques et dernier indice
- **Interface moderne** : dark mode, responsive, mobile-first
- **Thémable** : couleurs, images, logos personnalisables
- **Admin** : suivi de la progression de toutes les équipes, visualisation des réponses, suppression d'équipes, réinitialisation complète — protégé par mot de passe
- **Hub d'énigmes** : les équipes choisissent librement quelle énigme résoudre

---

## 📁 Structure du projet

```
hunter/
├── backend/
│   ├── server.js              # Serveur Express.js
│   ├── package.json           # Dépendances Node.js
│   ├── config/
│   │   └── steps.json         # ⭐ Configuration des étapes (à personnaliser)
│   ├── data/
│   │   └── teams.json         # Données des équipes (auto-généré)
│   ├── uploads/               # Images uploadées
│   ├── lib/
│   │   ├── data.js            # Accès aux données
│   │   └── validators.js      # Logique de validation des réponses
│   └── routes/
│       ├── teams.js           # API équipes
│       ├── steps.js           # API étapes
│       └── admin.js           # API admin
├── frontend/
│   ├── index.html             # Page principale (SPA)
│   ├── css/
│   │   └── style.css          # Styles
│   ├── js/
│   │   └── app.js             # Logique frontend
│   └── images/                # Images du thème
├── nginx.conf                 # Configuration nginx
├── deploy.sh                  # Script de déploiement automatique
└── README.md                  # Ce fichier
```

---

## ⚡ Déploiement rapide

### Prérequis

- **Debian** (10, 11, 12) ou Ubuntu (20.04+)
- Accès **root** (sudo)
- Connexion **internet** (pour installer les dépendances)

### Étapes

1. **Copier le projet** sur votre serveur Debian :

```bash
# Via SCP depuis votre PC Windows
scp -r hunter/ user@IP_DU_SERVEUR:~/hunter/

# OU via Git
git clone <votre-repo> ~/hunter
```

2. **Personnaliser la configuration** (voir section ci-dessous) :

```bash
nano ~/hunter/backend/config/steps.json
```

3. **Lancer le déploiement** :

```bash
cd ~/hunter
chmod +x deploy.sh
sudo ./deploy.sh
```

Le script installe automatiquement :
- Node.js 20
- nginx
- Les dépendances npm
- Le service systemd `hunter`
- La configuration nginx

4. **Vérifier** que tout fonctionne :

```bash
# Vérifier le service
sudo systemctl status hunter

# Voir les logs
sudo journalctl -u hunter -f

# Tester en local
curl http://localhost
```

---

## ⚙️ Configuration des étapes

Le fichier **`backend/config/steps.json`** est le cœur de la configuration. Voici la structure complète :

```json
{
  "title": "Ma Chasse au Trésor",
  "subtitle": "Sous-titre affiché sur la page d'accueil",
  "theme": {
    "primaryColor": "#e67e22",
    "secondaryColor": "#2c3e50",
    "accentColor": "#27ae60"
  },
  "finalMessage": "Le message affiché quand toutes les étapes sont validées.\nRenvoi à la ligne supporté.",
  "finalImage": "/uploads/tresor.jpg",
  "steps": [...]
}
```

### Types d'étapes disponibles

#### 1. `single_answer` — Réponse libre
Un champ texte, l'équipe doit trouver le bon mot/phrase. Insensible aux accents et à la casse.

```json
{
  "id": 1,
  "title": "L'Énigme",
  "description": "Texte de la question...",
  "type": "single_answer",
  "image": "/uploads/step1.jpg",
  "hint": "Un indice optionnel",
  "answers": ["réponse1", "reponse1", "variante"]
}
```

#### 2. `multiple_answers` — Réponses multiples
Plusieurs champs à remplir (l'ordre n'a pas d'importance).

```json
{
  "id": 2,
  "title": "Les Éléments",
  "description": "Trouvez les 4 éléments.",
  "type": "multiple_answers",
  "answers": ["terre", "eau", "feu", "air"],
  "fieldLabels": ["Élément 1", "Élément 2", "Élément 3", "Élément 4"]
}
```

#### 3. `matching` — Associations
Relier les éléments de gauche avec ceux de droite via des menus déroulants.

```json
{
  "id": 3,
  "title": "Associations",
  "description": "Associez correctement...",
  "type": "matching",
  "pairs": [
    { "left": "Napoléon", "right": "19ème siècle" },
    { "left": "Louis XIV", "right": "17ème siècle" }
  ]
}
```

#### 4. `cipher` — Code secret
Entrer un code numérique ou alphanumérique.

```json
{
  "id": 4,
  "title": "Le Coffre-Fort",
  "description": "Trouvez le code à 4 chiffres...",
  "type": "cipher",
  "answers": ["3471"]
}
```

#### 5. `order` — Remise en ordre
Drag & drop pour remettre des éléments dans le bon ordre.

```json
{
  "id": 5,
  "title": "La Suite",
  "description": "Remettez dans l'ordre...",
  "type": "order",
  "correctOrder": ["Premier", "Deuxième", "Troisième", "Quatrième"]
}
```

#### 6. `qcm` — Questions à choix multiples
Sélection parmi des choix proposés. Mono ou multi-sélection automatique selon le nombre de réponses.

```json
{
  "id": 6,
  "title": "Culture Générale",
  "description": "Quelle est la capitale ?",
  "type": "qcm",
  "choices": ["Paris", "Lyon", "Marseille", "Bordeaux"],
  "answers": ["Paris"]
}
```

#### 7. `puzzle` — Énigme
Identique à `single_answer` mais avec une présentation différente (icône 🧩).

```json
{
  "id": 7,
  "title": "Devinette",
  "description": "Plus je sèche, plus je suis mouillée...",
  "type": "puzzle",
  "answers": ["serviette", "une serviette"]
}
```

### Ajouter des images

1. Placez vos images dans **`backend/uploads/`** (ou `frontend/images/`)
2. Référencez-les dans la config :

```json
{
  "image": "/uploads/enigme1.jpg",
  "finalImage": "/uploads/tresor.jpg"
}
```

Formats supportés : JPG, PNG, WebP, GIF, SVG.

---

## 🛡️ Espace Administrateur

### Accès

1. Cliquez sur la petite icône ⚙️ en bas à droite de l'écran
2. Entrez le mot de passe admin (défini dans `steps.json`)
3. Par défaut : `hunter2024`

### Changer le mot de passe admin

Dans `backend/config/steps.json`, modifiez le champ `adminPassword` :

```json
{
  "adminPassword": "votre_mot_de_passe_ici",
  ...
}
```

### Fonctionnalités admin

| Fonctionnalité | Description |
|---|---|
| **Vue équipes** | Voir toutes les équipes, leur progression (dots colorés), tentatives, durée |
| **Vue réponses** | Voir toutes les réponses correctes pour chaque étape |
| **Supprimer une équipe** | Bouton 🗑️ sur chaque carte d'équipe |
| **Tout réinitialiser** | Supprime toutes les équipes et leur progression |
| **Rafraîchir** | Mise à jour en temps réel de la progression |

---

## 🌐 Configuration Freebox (accès extérieur)

Pour rendre la chasse accessible depuis l'extérieur (participants à l'extérieur du réseau local) :

### 1. Trouver l'IP locale du serveur

```bash
hostname -I
# Exemple : 192.168.1.42
```

### 2. Configurer le port forwarding sur la Freebox

1. Accédez à **http://mafreebox.freebox.fr** dans votre navigateur
2. Connectez-vous avec le mot de passe admin Freebox
3. Allez dans **Paramètres de la Freebox** → **Mode avancé**
4. Cliquez sur **Gestion des ports** (ou "Redirections de ports")
5. Ajoutez une nouvelle redirection :

| Paramètre | Valeur |
|---|---|
| IP Destination | `192.168.1.42` (IP de votre serveur) |
| Redirection active | ✅ Oui |
| IP source | Toutes |
| Protocole | TCP |
| Port de début (externe) | `80` |
| Port de fin (externe) | `80` |
| Port de début (interne) | `80` |
| Port de fin (interne) | `80` |

6. Cliquez sur **Sauvegarder**

### 3. Trouver votre IP publique

```bash
curl ifconfig.me
# Exemple : 82.123.45.67
```

Les participants pourront accéder à la chasse via : **http://82.123.45.67**

### 4. (Optionnel) Utiliser un nom de domaine gratuit

La Freebox fournit un DNS dynamique gratuit :

1. Dans **Paramètres Freebox** → **Mode avancé** → **DynDNS** (ou "Nom de domaine")
2. Activez le **DNS dynamique Freebox** 
3. Choisissez un nom : `machasse.freeboxos.fr`
4. Les participants accèdent via : **http://machasse.freeboxos.fr**

Ou utilisez un service gratuit comme [No-IP](https://www.noip.com) ou [DuckDNS](https://www.duckdns.org).

### 5. (Optionnel) HTTPS avec Let's Encrypt

Pour sécuriser avec HTTPS :

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.fr
```

---

## 🔧 Commandes utiles

```bash
# État du service
sudo systemctl status hunter

# Redémarrer le service
sudo systemctl restart hunter

# Voir les logs en temps réel
sudo journalctl -u hunter -f

# Tester la config nginx
sudo nginx -t

# Recharger nginx
sudo systemctl reload nginx

# Voir les équipes enregistrées
cat /opt/hunter/backend/data/teams.json | python3 -m json.tool

# Réinitialiser les données (supprimer toutes les équipes)
echo "[]" > /opt/hunter/backend/data/teams.json
```

---

## 🔄 Mise à jour

Pour mettre à jour l'application après modification :

```bash
cd ~/hunter
sudo ./deploy.sh
```

Le script redéploie les fichiers et redémarre le service automatiquement.

Ou pour un update plus ciblé :

```bash
# Copier seulement les fichiers modifiés
sudo cp -r frontend/ /opt/hunter/frontend/
sudo cp -r backend/config/ /opt/hunter/backend/config/
sudo systemctl restart hunter
```

---

## 🎨 Personnalisation du thème

### Couleurs

Modifiez les couleurs dans `steps.json` :

```json
"theme": {
  "primaryColor": "#e67e22",    // Orange (boutons, accents)
  "secondaryColor": "#2c3e50",  // Bleu foncé (fond des boutons secondaires)
  "accentColor": "#27ae60"      // Vert (progression, succès)
}
```

### Images de fond et logo

Placez vos images dans `frontend/images/` ou `backend/uploads/` et référencez-les dans la configuration.

### Police d'écriture

Le site utilise **Fredoka One** (titres) et **Nunito** (texte) via Google Fonts. Pour changer, modifiez le `<link>` dans `index.html` et les variables CSS dans `style.css`.

---

## 📊 API Endpoints

| Méthode | URL | Description |
|---|---|---|
| `POST` | `/api/teams` | Créer une équipe |
| `POST` | `/api/teams/resume` | Reprendre une partie |
| `GET` | `/api/teams/:id` | Détails d'une équipe |
| `GET` | `/api/steps/:teamId/:step` | Obtenir une étape |
| `POST` | `/api/steps/:teamId/:step/answer` | Soumettre une réponse |
| `GET` | `/api/steps/:teamId/final` | Page finale |
| `GET` | `/api/admin/teams` | Liste des équipes (admin) |
| `GET` | `/api/admin/config` | Configuration publique |

---

## ❓ FAQ

**Q: Les données sont-elles sauvegardées ?**  
R: Oui, dans `backend/data/teams.json`. Le fichier est créé automatiquement.

**Q: Peut-on avoir plus ou moins de 10 étapes ?**  
R: Oui ! Le nombre d'étapes est dynamique : ajoutez ou supprimez des entrées dans `steps.json`.

**Q: Comment réinitialiser toutes les équipes ?**  
R: `echo "[]" > /opt/hunter/backend/data/teams.json`

**Q: L'app fonctionne-t-elle sur mobile ?**  
R: Oui, elle est conçue mobile-first. Le drag & drop fonctionne aussi au toucher.

**Q: Comment voir la progression des équipes ?**  
R: Appelez `GET /api/admin/teams` ou consultez le fichier `teams.json`.
