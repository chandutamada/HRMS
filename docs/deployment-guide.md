# Production Deployment Guide

## 1. Production Architecture Overview

In production, the HRMS system operates with a single unified backend instance, a standalone Next.js server (or static CDN distribution), and compiled Android APK / App Bundles.

```
                  +-----------------------------------+
                  |   Internet / Cloudflare CDN / WAF  |
                  +-----------------+-----------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
  Port 443 (HTTPS)                                Port 443 (HTTPS)
            |                                               |
  +---------v----------+                          +---------v----------+
  |    Nginx Proxy     |                          |    Nginx Proxy     |
  |  (admin.hrms.com)  |                          |   (api.hrms.com)   |
  +---------+----------+                          +---------+----------+
            |                                               |
  +---------v----------+                          +---------v----------+
  |  Next.js Server    |                          |  NestJS Node.js    |
  |  (Port 3000)       |                          |  (Port 4000)       |
  +--------------------+                          +---------+----------+
                                                            |
                                                  +---------v----------+
                                                  |   MySQL 8.4 LTS    |
                                                  |   (Port 3306)      |
                                                  +--------------------+
```

---

## 2. Production Build Procedures

### 2.1 Backend REST API (`apps/api`)
```bash
cd apps/api
npm.cmd run build
```
- Output compiled to: `apps/api/dist/main.js`

### 2.2 Next.js HR Web Admin (`apps/web`)
```bash
cd apps/web
npm.cmd run build
```
- Produces production-optimized `.next` build with pre-rendered static routes and server actions.

### 2.3 Flutter Android Application (`apps/mobile`)
1. Create a release keystore:
```bash
keytool -genkey -v -keystore android/app/hrms-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias hrms
```
2. Configure `apps/mobile/android/key.properties`:
```properties
storePassword=YourKeystorePassword
keyPassword=YourKeyPassword
keyAlias=hrms
storeFile=hrms-release.jks
```
3. Build the release APK or Google Play App Bundle:
```bash
flutter build apk --release
# or
flutter build appbundle --release
```
- Output file: `apps/mobile/build/app/outputs/flutter-apk/app-release.apk`

---

## 3. Production Process Management (PM2)

Deploy the NestJS API and Next.js server with PM2 for automated restarts, clustering, and log rotation:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'hrms-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        DATABASE_URL: 'mysql://user:password@localhost:3306/hrms_db?schema=public&connection_limit=25',
      },
    },
    {
      name: 'hrms-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
```

Command to start in production:
```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## 4. Nginx Reverse Proxy & SSL Configuration

```nginx
# API Server Configuration (api.hrms.internal)
server {
    listen 443 ssl http2;
    server_name api.hrms.internal;

    ssl_certificate /etc/letsencrypt/live/api.hrms.internal/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.hrms.internal/privkey.pem;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:4000;
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

# Web Dashboard Configuration (admin.hrms.internal)
server {
    listen 443 ssl http2;
    server_name admin.hrms.internal;

    ssl_certificate /etc/letsencrypt/live/admin.hrms.internal/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.hrms.internal/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 5. Security & API Key Restrictions

1. **Google Maps Web API Key**:
   - In Google Cloud Console, restrict the Web key to **HTTP Referrers**:
     - `https://admin.hrms.internal/*`
     - `https://*.hrms.internal/*`
2. **Google Maps Android API Key**:
   - Restrict to **Android Apps**:
     - Package Name: `com.hrms.mobile`
     - SHA-1 Fingerprint: Generated via `keytool -list -v -keystore android/app/hrms-release.jks`.
3. **Database Security**:
   - MySQL 8.4 must bind to `127.0.0.1` and not listen on public interfaces.
   - Restrict database user privileges to `hrms_db` only.
