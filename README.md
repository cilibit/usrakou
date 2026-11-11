# usrakou.com · KOÜ Rejyonal Anestezi

Kocaeli Üniversitesi Anesteziyoloji ve Reanimasyon AD rejyonal anestezi sayfası.

- İçerik düzenleme: https://usrakou.com/admin (GitHub erişim anahtarı ile giriş)
- İçerikler: `content/` (Markdown). Görseller: `static/img`, panelden yüklenenler `static/uploads`.
- Her kayıttan sonra GitHub Actions siteyi derleyip Natro hosting'e (public_html/deneme) FTP ile yükler (1–2 dakika).
- Yerelde derleme: `npm ci && npm run build` → `dist/`
