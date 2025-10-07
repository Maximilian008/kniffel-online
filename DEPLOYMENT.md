# Deployment Guide - Kniffel Online

## Ziel: Online-Spiel zwischen Italien und Deutschland

### 1. Server-Deployment (VPS/Cloud)

**Option A: Digitaler Ocean, Hetzner, AWS EC2**
```bash
# Server aufsetzen (Ubuntu/Debian)
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm installieren
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc

# Projekt clonen/uploaden
git clone [your-repo] kniffel-online
cd kniffel-online
pnpm install
pnpm build

# Umgebungsvariablen setzen
cp .env.example .env
# Editiere .env:
# NODE_ENV=production
# PORT=3000
# CORS_ORIGIN=*

# PM2 für Prozess-Management
npm install -g pm2
pm2 start "pnpm start" --name kniffel-server
pm2 save
pm2 startup
```

**Option B: Railway/Render/Vercel (einfacher)**
1. Repository auf GitHub pushen
2. Bei Railway/Render anmelden
3. Repository verbinden
4. Umgebungsvariablen setzen:
   - `NODE_ENV=production`
   - `PORT=3000` (wird oft automatisch gesetzt)
   - `CORS_ORIGIN=*`

### 2. Domain & SSL

**Mit eigener Domain:**
```bash
# Nginx als Reverse Proxy
sudo apt install nginx
sudo nano /etc/nginx/sites-available/kniffel

# Nginx-Konfiguration:
server {
    listen 80;
    server_name deine-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

sudo ln -s /etc/nginx/sites-available/kniffel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL mit Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.com
```

### 3. Firewall-Konfiguration

```bash
# Ubuntu UFW
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Oder spezifisch für Node.js (wenn kein Nginx)
sudo ufw allow 3000
```

### 4. Quick-Start ohne Domain

**Für schnellen Test mit Server-IP:**

1. **VPS/Cloud-Server mieten** (z.B. Hetzner: 4€/Monat)
2. **Node.js + pnpm installieren** (siehe oben)
3. **Projekt deployen:**
   ```bash
   cd kniffel-online
   pnpm install && pnpm build
   
   # .env anpassen
   echo "NODE_ENV=production" > .env
   echo "PORT=3000" >> .env
   echo "CORS_ORIGIN=*" >> .env
   
   # Starten
   pm2 start "pnpm start" --name kniffel
   ```
4. **Firewall öffnen:**
   ```bash
   sudo ufw allow 3000
   ```
5. **Zugriff über IP:** `http://DEINE-SERVER-IP:3000`

### 5. Client-Konfiguration

**Falls Server nicht auf Standard-Port läuft:**

In `apps/web/.env.local`:
```
VITE_SOCKET_URL=http://DEINE-SERVER-IP:3000
# oder
VITE_SOCKET_URL=https://deine-domain.com
```

### 6. Monitoring & Wartung

```bash
# Logs anschauen
pm2 logs kniffel

# Server-Status
pm2 status

# Restart bei Updates
pm2 restart kniffel

# Health-Check
curl http://localhost:3000/healthz
```

### 7. Geschätzte Kosten

- **VPS (Hetzner/DO):** 4-10€/Monat
- **Domain:** 10-15€/Jahr (optional)
- **SSL:** Kostenlos (Let's Encrypt)

**Total:** ~5€/Monat für stabiles Fernspiel

### 8. Schnellste Lösung: Railway

1. Code auf GitHub pushen
2. Railway.app besuchen
3. "Deploy from GitHub" → Repository auswählen
4. Automatisch deployed → URL erhalten
5. **Fertig!** Kostenlos für kleine Projekte.

---

**Hilfe bei Problemen:**
- Server-Logs: `pm2 logs`
- Health-Check: `/healthz` endpoint
- CORS-Probleme: `CORS_ORIGIN=*` in .env setzen