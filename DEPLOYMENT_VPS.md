# Panduan Deployment TurboPad ke VPS

Dokumen ini menjelaskan langkah demi langkah untuk mendeploy **TurboPad** (Frontend SPA + Node.js Backend API + SQLite Database) ke server VPS (Ubuntu / Debian / CentOS / Rocky Linux).

---

## 1. Spesifikasi Minimum VPS

* **CPU**: 1 vCPU
* **RAM**: 1 GB (direkomendasikan 2 GB jika menjalankan build di dalam VPS)
* **Penyimpanan**: 15 GB SSD / NVMe
* **OS**: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS (disarankan)
* **Port Terbuka (Firewall / Security Group)**:
  * `22` (SSH)
  * `80` (HTTP)
  * `443` (HTTPS)

---

## 2. Persiapan Awal di VPS

Masuk ke VPS via SSH dan perbarui sistem:

```bash
# Update paket sistem
sudo apt update && sudo apt upgrade -y

# Atur firewall (UFW)
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 3. Metode A: Deployment Menggunakan Docker & Docker Compose (Sangat Disarankan)

Metode ini mengemas seluruh dependensi Node.js 22, SQLite, Nginx Reverse Proxy, dan SSL Certbot ke dalam container terisolasi.

### Langkah 3.1: Install Docker di VPS
Jika Docker belum terpasang di VPS:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

Verifikasi instalasi:
```bash
docker --version
docker compose version
```

### Langkah 3.2: Clone Repository & Konfigurasi
```bash
# Masuk ke direktori home atau /var/www
git clone <URL_REPOSITORY_ANDA> turbopad
cd turbopad

# Salin konfigurasi environment
cp .env.example .env

# Edit .env sesuai kebutuhan (misal domain Anda)
nano .env
```

### Langkah 3.3: Jalankan Deployment Otomatis
Cukup jalankan script deployment:
```bash
./scripts/deploy.sh
```

Atau jalankan docker compose langsung:
```bash
docker compose up -d --build
```

Periksa status container:
```bash
docker compose ps
docker compose logs -f turbopad-app
```

Buka IP VPS Anda di browser: `http://<IP_VPS_ANDA>/api/health` — Anda akan melihat response status `ok`.

---

## 4. Konfigurasi Domain & SSL (HTTPS) Gratis via Certbot

Jika Anda sudah mengarahkan Domain (misal `turbopad.xyz` dan `www.turbopad.xyz`) ke IP VPS:

### Langkah 4.1: Dapatkan Sertifikat SSL
Jalankan certbot dari docker-compose:
```bash
docker compose run --rm turbopad-certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  -d yourdomain.com -d www.yourdomain.com \
  --email your-email@example.com --agree-tos --no-eff-email
```

### Langkah 4.2: Aktifkan SSL di Nginx
Edit file `nginx/conf.d/turbopad.conf` untuk membuka blok port 443 SSL (atau tambahkan sertifikat dari `/etc/letsencrypt/live/yourdomain.com/fullchain.pem`). Kemudian reload Nginx:
```bash
docker compose exec turbopad-nginx nginx -s reload
```

---

## 5. Metode B: Deployment Tanpa Docker (PM2 + Host Nginx)

Jika Anda lebih memilih menjalankan Node.js secara langsung di sistem operasi VPS:

### Langkah 5.1: Install Node.js 22 & PM2
```bash
# Pasang Node.js 22 LTS (dibutuhkan untuk native node:sqlite)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx

# Pasang PM2 secara global
sudo npm install -g pm2
```

### Langkah 5.2: Install Dependensi & Start PM2
```bash
cd turbopad
npm ci --omit=dev --ignore-scripts
cp .env.example .env

# Jalankan service menggunakan ecosystem config
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### Langkah 5.3: Konfigurasi Host Nginx
Salin konfigurasi nginx ke sistem:
```bash
sudo cp nginx/conf.d/turbopad.conf /etc/nginx/sites-available/turbopad.conf
# Edit turbopad_upstream di dalam file tersebut agar mengarah ke 127.0.0.1:3001
sudo sed -i 's/turbopad-app:3001/127.0.0.1:3001/g' /etc/nginx/sites-available/turbopad.conf
sudo ln -s /etc/nginx/sites-available/turbopad.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. Pembaruan Aplikasi di Masa Depan (Update / Redeploy)

Setiap kali Anda melakukan commit atau update kode baru, cukup jalankan:

```bash
cd turbopad
git pull
./scripts/deploy.sh
```

Database SQLite (`turbopad.db`) disimpan pada persistent volume (`turbopad-data`), sehingga semua data voting, registry token, dan watchlist tetap aman dan tidak akan terhapus saat container di-rebuild.

---

## 7. Verifikasi API Kesehatan Server

| Endpoint | Deskripsi |
| :--- | :--- |
| `GET /api/health` | Status server, uptime, dan timestamp |
| `GET /api/markets/meme` | Cache proxy data pasar Meme |
| `GET /api/markets/rwa` | Cache proxy data pasar RWA |
| `GET /api/tokens` | Daftar token on-chain yang dideploy via TurboPad |
| `GET /api/battles?a=BYTE&b=GLITCH` | Skor voting Meme Battles |
| `GET /api/watchlist/:wallet` | Sinkronisasi watchlist pengguna |
