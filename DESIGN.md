# DESIGN SYSTEM: Atelier Nusantara (アトリエ ヌサンタラ)
**Universal Curated Marketplace: Makanan, Minuman, Fashion, Kriya, Gadget & Produk Digital**
**Dial:** ENERGY 2 / RHYTHM 2 / MOTION 2

## 1. Aesthetic Identity & Direction
- **Concept:** Elevated Curated Commerce, organic warm parchment minimalism, refined Japanese-Nordic lifestyle boutique aesthetic (Kinfolk & Monocle aesthetic).
- **Scope:** Universal marketplace yang dapat menjual apa saja: kuliner slow-cooked, kopi artisan, karya keramik kasongan, busana tenun etis, gear kerja meja kayu, hingga voucher & tiket digital.
- **Mood:** Artisanal, serene, sensory, versatile, warm, dan highly trustworthy.
- **Tone:** Direct, hospitable, human, authentic. Bebas dari AI buzzwords generik.

## 2. Color System (Tokens)
```css
:root {
  /* Surface & Base */
  --color-paper: #F9F6F0;
  --color-paper-soft: #F4EFEB;
  --color-paper-card: #FFFFFF;
  --color-paper-border: rgba(30, 24, 20, 0.08);
  --color-paper-border-hover: rgba(30, 24, 20, 0.16);

  /* Typography / Ink */
  --color-ink-primary: #1C1613;
  --color-ink-secondary: #5C524A;
  --color-ink-tertiary: #8C8077;
  --color-ink-inverted: #FDFBF7;

  /* Botanical & Artisan Accents */
  --color-matcha-deep: #2A402D;
  --color-matcha-leaf: #3D583F;
  --color-matcha-subtle: #E8EFE8;
  --color-terracotta: #C25E3B;
  --color-terracotta-hover: #AA4E2E;
  --color-terracotta-soft: #FBF0EB;

  /* Functional Status */
  --color-success: #2E6B48;
  --color-warning: #B87326;
  --color-danger: #BA3C34;
  --color-qris-brand: #C8102E; /* QRIS red standard */

  /* Shadows & Depth */
  --shadow-sm: 0 2px 8px rgba(28, 22, 19, 0.04);
  --shadow-md: 0 8px 24px rgba(28, 22, 19, 0.07);
  --shadow-lg: 0 16px 48px rgba(28, 22, 19, 0.12);
  --shadow-modal: 0 24px 64px rgba(28, 22, 19, 0.18);

  /* Transitions */
  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 180ms;
  --duration-normal: 320ms;
  --duration-slow: 600ms;
}
```

## 3. Typography
- **Display / Headings:** `"Playfair Display"`, Georgia, serif (optical sizing, editorial elegance).
- **Body & Interactive:** `"Plus Jakarta Sans"`, -apple-system, BlinkMacSystemFont, sans-serif (crisp modern clarity, balanced metrics).
- **Tabular, Code & Prices:** `"JetBrains Mono"`, monospace (presisi angka harga IDR dan raw payload QRIS EMVCo).

## 4. GSAP Animation Engine (UI UX Pro Max & Scroll-Craft)
- **Hero Entrance Choreography:** `gsap.timeline()` dengan stagger berurutan dari kicker, headline, deskripsi, aksi tombol, hingga kartu hero showcase.
- **3D Interactive Parallax:** Dynamic mousemove tilt pada showcase card menggunakan `gsap.quickTo()` rotasi sumbu X dan Y.
- **Magnetic Buttons:** Efek magnetik mikro pada `.btn-primary` dan `.btn-checkout` (UI UX Pro Max Motion Result 7).
- **ScrollTrigger Catalog Reveal:** Animasi glide-up dan fade-in kartu katalog bertingkat saat pengguna menggulir ke seksi produk.
- **Reduced-Motion Fallback:** Kepatuhan penuh WCAG 2.2 AAA via `prefers-reduced-motion: reduce` mematikan semua gerak non-esensial secara instan.

## 5. Layout & Signature Scroll-Craft Moves
- **Hero Layering:** Dual-layer narrative hero dengan slow parallax dan chef highlight.
- **Multi-Category Tabs:** Tab kategori horizontal scrollable untuk Makanan, Minuman, Kriya, Fashion, Gadget, dan Produk Digital.
- **Dynamic Payment Engine:**
  - Dynamic QRIS generator dengan ISO EMVCo payload, Tag 01, 54, 62, dan kalkulasi CRC16 real-time.
  - Simulasi transaksi GoPay / Semua Bank dengan struk digital instan dan pelacak progres pesanan langsung.
