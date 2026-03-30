
# Documentation de déploiement Docker — Projet IoT

## 1. Prérequis

### Outils nécessaires
- Docker ≥ 24.x
- Docker Compose ≥ 2.x
- git ≥ 2.x

### Ports utilisés
- Frontend : 80
- Backend API : 3005
- MongoDB : 27017
- MQTT : 1883

## 2. Architecture générale
```
Utilisateur → Frontend → API → MongoDB
                          ↳ MQTT Broker
```

## 3. Récupération du projet
```
git clone https://github.com/itzcxms/IOT-Dashboard
git clone https://github.com/itzcxms/IOT-API
```

## 4. Configuration des variables d’environnement
Copier `.env.example` vers `.env` dans les deux projets.

## 5. Exemple complet de docker-compose.yml
```yaml
version: "3.9"
services:
  frontend:
    build: ./IOT-Dashboard
    ports:
      - "80:80"
    depends_on:
      - api

  api:
    build: ./IOT-API
    ports:
      - "3005:3005"
    environment:
      - MONGO_URI=mongodb://mongo:27017/iot-db
    depends_on:
      - mongo
      - mqtt

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

  mqtt:
    image: eclipse-mosquitto
    ports:
      - "1883:1883"

volumes:
  mongo_data:
```

## 6. Déploiement
```
docker compose up --build
```
Mode détaché :
```
docker compose up --build -d
```

## 7. Arrêt propre
```
docker compose down
```
Supprimer volumes :
```
docker compose down -v
```

## 8. Mise à jour
```
git pull
docker compose down
docker compose up --build -d
```

## 9. Sauvegardes MongoDB
```
docker exec -it <mongo> mongodump --out /data/db/backup/
```
Restauration :
```
docker exec -it <mongo> mongorestore /data/db/backup/
```

## 10. Sécurité
- Utiliser HTTPS (reverse proxy recommandé)
- Ne pas exposer MongoDB en production
- Utiliser un JWT_SECRET long et complexe
- Mettre à jour régulièrement les images Docker

## 11. Dépannage
```
docker ps
docker compose logs -f api
docker exec -it api bash
```
