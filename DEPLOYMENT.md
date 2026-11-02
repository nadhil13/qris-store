# Deployment Guide

Repository ini menghasilkan file statis. Tidak ada deployment provider yang dikonfigurasi otomatis.

## Local preview

```cmd
cd /d "C:\Users\USER\Downloads\WEBSITE\TEST-PAYMENT"
python -m http.server 5500
```

Buka `http://localhost:5500/index.html`.

## Static hosting

GitHub Pages, Netlify, Vercel, atau hosting web biasa dapat dipakai sebagai hosting file statis. Buat project baru pada provider pilihan, arahkan root publish ke folder repository, dan pastikan `index.html` menjadi entry file. Langkah dashboard dapat berbeda menurut provider.

Sebelum mengaktifkan domain publik:

- ganti kredensial admin demo dengan autentikasi server;
- pindahkan data order dan QRIS dari browser ke backend;
- konfigurasi HTTPS;
- uji service worker pada domain final;
- pastikan aset eksternal memiliki izin dan kebijakan yang sesuai.

## Cache invalidation

Naikkan `CACHE_NAME` pada `sw.js` saat aset yang dicache berubah. Uji reload pertama dan reload setelah service worker aktif. Jangan memakai service worker sebagai tempat penyimpanan order.

## Not configured

Repository ini belum memiliki workflow deployment, environment secret, domain, atau provider settlement. Panduan ini tidak berarti deployment publik sudah aktif.
