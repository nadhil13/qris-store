# Panduan Kontribusi

Terima kasih sudah membantu memperbaiki Atelier Nusantara. Repository ini adalah frontend statis, jadi kontribusi sebaiknya menjaga alur browser tetap ringan dan dapat dijalankan tanpa toolchain tambahan.

## Sebelum mulai

1. Baca [README.md](README.md) dan [DESIGN.md](DESIGN.md).
2. Pastikan perubahan tidak memasukkan password, token, data pelanggan, atau QRIS merchant yang bersifat privat.
3. Untuk perubahan besar, buka issue lebih dulu agar arah dan batasnya jelas.

## Alur kerja

1. Fork repository dan buat branch dari `main`.
2. Gunakan nama branch yang singkat, misalnya `fix/cart-scroll` atau `docs/qris-limitations`.
3. Buat perubahan sekecil mungkin dan pertahankan pola HTML, CSS, serta JavaScript yang sudah ada.
4. Jalankan pemeriksaan:

   ```cmd
   node --check scripts\app.js
   node --check scripts\qris.js
   node tests\run-tests.mjs
   python -m http.server 5500
   ```

5. Uji desktop, viewport sekitar 390px, keyboard, Escape pada modal, reduced motion, dan state kosong atau error yang relevan.
6. Update dokumentasi bila perilaku, batas teknis, atau perintah menjalankan berubah.
7. Buka pull request dengan template yang tersedia.

## Gaya perubahan

- Gunakan copy yang spesifik dan tidak membuat klaim yang belum dibuktikan.
- Jangan menambah tombol yang belum memiliki perilaku nyata.
- Jangan menyimpan secret di frontend.
- Pertahankan dukungan browser untuk static HTTP server.
- Tambahkan catatan pada `CHANGELOG.md` jika perubahan terlihat oleh pengguna.

## Commit

Gunakan subject yang jelas dalam bahasa Inggris, misalnya:

```text
Fix cart state after catalog refresh
Add QRIS limitations to documentation
```

## Pull request

Pull request yang baik menjelaskan masalah, perubahan, cara verifikasi, dan risiko yang tersisa. Maintainer dapat meminta revisi, pengujian tambahan, atau pemecahan perubahan menjadi beberapa pull request.
