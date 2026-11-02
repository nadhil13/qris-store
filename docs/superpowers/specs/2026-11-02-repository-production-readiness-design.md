# Repository Production Readiness Package

## Intent

Merapikan repository Atelier Nusantara agar mudah dipahami, dijalankan, diuji, dan dikembangkan oleh kontributor lain. Paket ini melengkapi dokumentasi yang sudah ada tanpa menyamarkan frontend-only demo sebagai layanan produksi.

## Goals

- Menjelaskan arsitektur, model data, deployment, demo flow, aksesibilitas, performa, privasi, dan syarat penggunaan.
- Menambahkan CI dasar untuk pemeriksaan syntax, whitespace, dan file wajib.
- Menambahkan konfigurasi editor dan repository yang konsisten.
- Menambahkan test suite yang memeriksa parser QRIS, katalog, harga, stok, checkout, dan sinkronisasi browser pada level yang realistis untuk static app.
- Menyediakan migration plan dan API direction untuk backend mendatang tanpa membuat endpoint fiktif.

## Non-goals

- Tidak mengubah frontend menjadi aplikasi backend.
- Tidak membuat autentikasi server, webhook pembayaran, database, atau deployment aktif.
- Tidak menambahkan dependency produksi hanya untuk dokumentasi.
- Tidak menyatakan QRIS sudah memverifikasi settlement provider.

## Approaches

### Paket minimal

Dokumentasi dan konfigurasi dasar saja. Lebih cepat, tetapi belum memberi perlindungan regresi untuk alur QRIS dan katalog.

### Paket 2, dipilih

Semua dokumentasi poin 9 sampai 16 dan 24 sampai 27, konfigurasi `.editorconfig`, `.gitattributes`, `CODEOWNERS`, GitHub Actions CI, serta test suite fokus. Deployment dijelaskan sebagai panduan manual, bukan workflow deploy aktif. Ini seimbang dengan kondisi repository saat ini.

### Paket maksimum

Menambahkan CI, deployment otomatis, Dependabot, dan test browser yang lebih luas. Ditunda karena belum ada package manifest, environment deployment, atau backend yang dapat diuji secara jujur.

## Deliverables

- `ARCHITECTURE.md`
- `DEPLOYMENT.md`
- `SUPPORT.md`
- `PRIVACY.md`
- `TERMS.md`
- `ACCESSIBILITY.md`
- `PERFORMANCE.md`
- `DEMO.md`
- `DATA-MODEL.md`
- `MIGRATION.md`
- `API.md`
- `.editorconfig`
- `.gitattributes`
- `.github/CODEOWNERS`
- `.github/workflows/ci.yml`
- Test suite yang dapat dijalankan tanpa dependency tambahan jika memungkinkan, atau dependency test yang dipilih hanya bila benar-benar diperlukan.
- Pembaruan `README.md`, `CHANGELOG.md`, dan `SECURITY-ROADMAP.md` bila diperlukan untuk menghubungkan dokumen.

## Implementation notes

- Dokumentasi menyebut kondisi aktual: `localStorage`, BroadcastChannel antar-tab, kredensial demo di client, dan QRIS tanpa settlement webhook.
- CI menjalankan pemeriksaan syntax JavaScript, whitespace, file wajib, dan test suite yang tersedia.
- Test difokuskan pada kontrak perilaku yang dapat dipisahkan dari DOM. Jika struktur saat ini terlalu terikat browser, test akan memverifikasi helper yang sudah ada atau menambahkan boundary kecil tanpa mengubah UX.
- Nama dan email author tidak ditambahkan ke dokumen publik selain metadata lisensi yang sudah ada.

## Acceptance criteria

- Semua file deliverable ada dan saling tertaut.
- Tidak ada klaim backend, deployment aktif, statistik, atau settlement yang tidak terbukti.
- `node --check` untuk file JavaScript lulus.
- CI workflow valid secara YAML dan menjalankan pemeriksaan yang tersedia.
- Test suite lulus secara lokal.
- README menjelaskan lokasi dokumen baru dan perintah verifikasi.
- Perubahan di-commit dan di-push ke branch `main`.
