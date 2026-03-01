# Launch Guide - Feruza Channel

Ushbu yo'riqnoma domenni sozlash, xavfsizlik va email deliverability bo'yicha muhim qadamlarni o'z ichiga oladi.

## 1. DNS & Redirects
- **A Record**: `example.com` → `server_ip` (Root domain uchun).
- **WWW Record**: `www` → `example.com` (CNAME orqali yoki to'g'ridan-to'g'ri A record).
- **Redirect (301 Permanent)**:
  - **HTTP → HTTPS**: Barcha trafikni xavfsiz protokolga yo'naltiring.
  - **WWW → Non-WWW**: SEO uchun bitta versiyani tanlang (masalan: `https://example.com`).
  - *Diqqat!* Redirect 301 (Permanent) bo'lishi shart, 302 bo'lsa SEO zarar ko'radi.

## 2. SSL Xavfsizligi
- **Certbot (Let's Encrypt)**: 
  ```bash
  sudo certbot --nginx -d example.com -d www.example.com
  ```
- **Auto-Renew**: 
  ```bash
  sudo certbot renew --dry-run
  ```
- **HSTS Ogohlantirishi**: 
  > [!WARNING]
  > HSTS ni `includeSubDomains` va `preload` bilan yoqishdan oldin barcha subdomainlar HTTPS da to'g'ri ishlashiga ishonch hosil qiling. Aks holda noto'g'ri sozlansa, butun domen "qamalib qoladi".

## 3. Email Security (SPF, DKIM, DMARC)
Email inboxga tushishi va spoofing'dan himoyalanish uchun quyidagilar shart:

- **SPF (TXT yozuv)**: 
  Siz foydalanayotgan SMTP provayderiga mos yozilishi shart (masalan, Google: `v=spf1 include:_spf.google.com ~all`).
- **DKIM (TXT yozuv)**: 
  Provayder bergan public key'ni DNSga qo'shing.
- **DMARC (TXT yozuv)**: 
  Bosqichma-bosqich yondashuv tavsiya etiladi:
  1. `v=DMARC1; p=none; rua=mailto:admin@example.com` (1-2 hafta monitoring)
  2. `v=DMARC1; p=quarantine;` (Monitoringdan so'ng)
  3. `v=DMARC1; p=reject;` (To'liq xavfsizlik)

### Email Qoidalari:
- **FROM Domain**: Yuboruvchi email nomi (`noreply@example.com`) domen va SPF bilan to'liq mos bo'lishi shart.
- **SMTP Port**: `587` (STARTTLS) yoki `465` (SSL/TLS). TLS majburiy.

## 4. Backup va Restore
- **Backup Script**: `npm run backup` (database va `uploads/` papkasini zip qiladi).
- **Saqlash (Retention)**: Backup'lar serverdagi `backend/backups/` papkasida saqlanadi. 7 kundan eski fayllar avtomatik o'chiriladi.
- **Restore Jarayoni**: 
  ```bash
  node scripts/restore.js backups/backup-filename.zip
  ```
- **Cron (Avtomatlashtirish)**:
  ```bash
  0 2 * * * cd /var/www/feruzachannel/backend && npm run backup
  ```

## 5. Monitoring va PM2
- **PM2 Ishga tushirish**:
  ```bash
  pm2 start ecosystem.config.json --env production
  ```
- **Restart va Loglar**:
  ```bash
  pm2 restart feruzachannel-backend
  pm2 logs feruzachannel-backend
  ```
- **Log Joylashuvi**: 
  - Express loglari: `backend/logs/error.log`
  - PM2 loglari: `~/.pm2/logs/`

Monitoring tizimi quyidagi xatolarda admin emailiga alert yuboradi:
- **SMTP Failures**: Ketma-ket 3 marta yubora olmasa.
- **DB Errors**: Baza bilan bog'liq har qanday xato.
- **Crashes**: Uncaught exception va unhandled rejections.
