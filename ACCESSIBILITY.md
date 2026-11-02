# Accessibility

## Current commitments

- Dokumen HTML memakai `lang="id"`, title, landmark, dan heading yang relevan.
- Kontrol memakai elemen native bila memungkinkan.
- Modal dapat ditutup dengan Escape.
- Focus state terlihat pada kontrol yang dapat digunakan.
- Layout diuji untuk viewport mobile sekitar 390px.
- Motion non-esensial mengikuti `prefers-reduced-motion`.
- Gambar yang dipakai oleh interface memiliki alternative text sesuai konteks.

## Manual checks

Gunakan keyboard untuk mencapai navigasi, katalog, keranjang, checkout, modal, dan admin. Pastikan Enter atau Space menjalankan tombol dan Escape menutup dialog. Uji zoom browser dan pembaca layar pada alur utama.

## Known limits

Audit WCAG formal, pengujian screen reader menyeluruh, dan pengukuran kontras otomatis belum menjadi bagian dari repository. Laporkan elemen yang tidak dapat dioperasikan tanpa mouse melalui issue.
