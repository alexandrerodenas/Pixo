# Security headers. The CSP mirrors CONTENT_SECURITY_POLICY in vite.config.js (and vercel.json), plus frame-ancestors.
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' blob: https://tfhub.dev https://www.kaggle.com https://storage.googleapis.com https://huggingface.co https://*.huggingface.co https://cdn.jsdelivr.net; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
