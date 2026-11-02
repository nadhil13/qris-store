import { generateDynamicQRISPayload, renderQRCodeSVG, convertStaticToDynamicQRIS, parseEMVCoQRIS } from './qris.js';

// ==========================================================================
// CATALOG DATA WITH ENHANCED ARTISAN VARIANTS & STORYTELLING
// ==========================================================================
export const PRODUCTS = [
  {
    id: 'prod-01',
    name: 'Wagyu Se’i Sapi Asap',
    category: 'makanan',
    price: 78000,
    tags: ['Best Seller', 'Signature'],
    desc: 'Daging wagyu meltique diasap perlahan dengan kayu kosambi 12 jam, disajikan bersama sambal lu’at kecombrang dan tumis daun pepaya organik.',
    story: 'Terinspirasi tradisi se’i Rote dan Kupang, menggunakan kayu kosambi liar NTT beraroma manis alami yang mengunci kelembutan serat marbling wagyu.',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80',
    calories: '480 kkal',
    origin: 'Kupang x Wagyu Australia',
    variants: {
      title: 'Tingkat Kepedasan Sambal Lu’at',
      options: ['Level 0: Ramah Anak', 'Level 1: Sedang Nikmat', 'Level 2: Pedas Nampol', 'Level 3: Ekstra Kecombrang']
    }
  },
  {
    id: 'prod-02',
    name: 'Truffle Mushroom Sourdough',
    category: 'makanan',
    price: 54000,
    tags: ['Artisan Bakery', 'Vegetarian'],
    desc: 'Roti sourdough ragi alami buatan sendiri, tumisan jamur portobello & shimeji lokal, krim bawang putih panggang, dan minyak truffle organik.',
    story: 'Ragi sourdough dirawat aktif selama 4 tahun dengan fermentasi lambat 36 jam menghasilkan rongga roti renyah luar biasa dan ramah pencernaan.',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=700&q=80',
    calories: '360 kkal',
    origin: 'Sourdough 36h Ferment',
    variants: {
      title: 'Pilihan Tambahan Toping',
      options: ['Original Truffle Cream', 'Ekstra Keju Emmental (+Rp 8.000)', 'Poached Egg Organik (+Rp 6.000)']
    }
  },
  {
    id: 'prod-03',
    name: 'Bebek Crispy Confit Gianyar',
    category: 'makanan',
    price: 88000,
    tags: ['Chef Special'],
    desc: 'Bebek lokal Bali dimasak lambat metode confit rempah 8 jam lalu digoreng garing keemasan. Dilengkapi trio sambal matah, mbe, dan embe Bali.',
    story: 'Menggunakan bebek muda dari Gianyar yang direndam dalam rempah base genep lengkap dan lemak bebek murni hingga dagingnya mudah lepas dari tulang.',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80',
    calories: '590 kkal',
    origin: 'Gianyar, Bali',
    variants: {
      title: 'Pilihan Sambal Pendamping',
      options: ['Trio Sambal Komplit', 'Sambal Matah Sereh Segar', 'Sambal Embe Bawang Crispy']
    }
  },
  {
    id: 'prod-04',
    name: 'Tempeh Avokad Glaze Asam Jawa',
    category: 'makanan',
    price: 48000,
    tags: ['Plant-Based', 'Lokal'],
    desc: 'Tempe kedelai lokal non-GMO panggang glasir asam jawa karamel, alpukat mentega segar, rempah biji wijen di atas multigrain toast.',
    story: 'Mengangkat tempe warisan tradisional pengrajin Grobogan, dipadukan karamel asam jawa Purworejo yang gurih, asam, dan legit.',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=700&q=80',
    calories: '340 kkal',
    origin: 'Kedelai Lokal Grobogan',
    variants: {
      title: 'Pilihan Roti Dasar',
      options: ['Multigrain Toast Panggang', 'Gluten-Free Seed Bread (+Rp 5.000)', 'Nasi Merah Organik']
    }
  },
  {
    id: 'prod-05',
    name: 'Uji Matcha Cold Whisk Espresso',
    category: 'minuman',
    price: 42000,
    tags: ['Favorit', 'Cold Brew'],
    desc: 'Ceremonial grade Uji Matcha di-whisk segar saat dipesan, dipadukan espresso single-origin Bali Kintamani dan oat milk barista creamy.',
    story: 'Perpaduan harmonis teh hijau Uji Kyoto kelas seremoni dengan aroma citrus segar jeruk kintamani dari kopi pegunungan Bali.',
    image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=700&q=80',
    calories: '140 kkal',
    origin: 'Uji Kyoto x Kintamani Bali',
    variants: {
      title: 'Pilihan Es & Tingkat Manis',
      options: ['Normal Ice / Less Sweet 50%', 'Normal Ice / Normal Sugar', 'No Added Sugar (Murni)', 'Hangat / Warm Oat']
    }
  },
  {
    id: 'prod-06',
    name: 'Kopi Kenangan Senja (Butterscotch)',
    category: 'minuman',
    price: 38000,
    tags: ['Signature Drink'],
    desc: 'Espresso Aceh Gayo washed, saus artisan butterscotch buatan rumah, garam laut Kusamba Bali, dan susu segar steam bertekstur beludru.',
    story: 'Karamel mentega dibuat perlahan dengan gula kelapa organik Kulon Progo dan sejumput kristal garam laut Kusamba yang mengangkat cita rasa manis gurih.',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=80',
    calories: '190 kkal',
    origin: 'Gayo Arabica x Garam Kusamba',
    variants: {
      title: 'Suhu & Pilihan Susu',
      options: ['Dingin (Fresh Milk Standar)', 'Dingin (Ganti Oat Milk +Rp 6.000)', 'Hangat / Hot Latte']
    }
  },
  {
    id: 'prod-07',
    name: 'Rosella Sparkling Kombucha',
    category: 'minuman',
    price: 36000,
    tags: ['Organic', 'Probiotik'],
    desc: 'Fermentasi teh bunga rosella merah liar pegunungan, sereh wangi, madu hutan murni, dan soda alami berkilau menyegarkan.',
    story: 'Difermentasi batch kecil selama 14 hari menghasilkan gelembung mikro alami yang kaya probiotik baik untuk kesehatan pencernaan.',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=700&q=80',
    calories: '65 kkal',
    origin: 'Rosella Lereng Merbabu',
    variants: {
      title: 'Tingkat Kesegaran Es',
      options: ['Ice Dingin Segar', 'Chilled Tanpa Es Tambahan']
    }
  },
  {
    id: 'prod-08',
    name: 'Lavender Earl Grey Fog',
    category: 'minuman',
    price: 39000,
    tags: ['Artisan Tea'],
    desc: 'Seduhan teh hitam bergamot organik, sirup lavender alami, busa susu vanila lembut Madagascar, dan kelopak bunga edible.',
    story: 'Teh bergamot dataran tinggi Malabar dipadukan bunga lavender kering aromaterapi yang menenangkan pikiran di tengah kesibukan.',
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=700&q=80',
    calories: '110 kkal',
    origin: 'Perkebunan Malabar Jawa Barat',
    variants: {
      title: 'Suhu & Penyajian',
      options: ['Hangat Menenangkan', 'Dingin Berbusa (Iced)']
    }
  },
  {
    id: 'prod-09',
    name: 'Cangkir Stoneware Kasongan (280ml)',
    category: 'barang',
    price: 125000,
    tags: ['Kriya Lokal', 'Limited'],
    desc: 'Cangkir keramik tanah liat lokal diputar tangan dan dibakar suhu tinggi 1200°C oleh perajin Kasongan. Tekstur matte alami, tahan panas & microwave.',
    story: 'Setiap cangkir memiliki guratan unik jejak jemari perajin Yogyakarta. Didesain ergonomis pas dalam genggaman untuk momen menyeruput kopi santai.',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=700&q=80',
    calories: 'Kapasitas 280ml',
    origin: 'Desa Gerabah Kasongan, DIY',
    variants: {
      title: 'Pilihan Warna & Finishing',
      options: ['Terracotta Raw Clay', 'Sandstone Matte Grey', 'Matcha Moss Glaze']
    }
  },
  {
    id: 'prod-10',
    name: 'Biji Kopi Aceh Gayo Anaerobic (250g)',
    category: 'barang',
    price: 110000,
    tags: ['Specialty Coffee'],
    desc: 'Biji kopi pilihan single-origin Takengon Aceh Gayo, proses fermentasi anaerobik natural. Profil rasa: aprikot, teh hitam, gula aren karamel.',
    story: 'Ditanam pada ketinggian 1.500 mdpl oleh petani koperasi Pantan Musara, disangrai profil medium-light untuk menonjolkan keasaman buah yang jernih.',
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=700&q=80',
    calories: 'Isi Bersih 250g',
    origin: 'Pantan Musara, Takengon',
    variants: {
      title: 'Pilihan Bentuk Gilingan',
      options: ['Biji Utuh (Whole Beans)', 'Giling Kasar (Cold Brew/French Press)', 'Giling Sedang (V60/Aeropress)', 'Giling Halus (Espresso/Mokapot)']
    }
  },
  {
    id: 'prod-11',
    name: 'Bento Cutlery Set Bambu Organik',
    category: 'barang',
    price: 65000,
    tags: ['Eco-Friendly'],
    desc: 'Set sendok, garpu, pisau mentega, dan sumpit bambu alami halus dilapisi lilin lebah murni, lengkap dengan pouch pembungkus kain linen tenun.',
    story: 'Dibuat dari bambu petung berkelanjutan Jawa Tengah, bebas lapisan kimia beracun, ringan dibawa saat bepergian demi mengurangi sampah plastik sekali pakai.',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80',
    calories: 'Set 4 Pcs + Pouch',
    origin: 'Pengrajin Bambu Temanggung',
    variants: {
      title: 'Pilihan Warna Pouch Linen',
      options: ['Natural Flax Linen', 'Indigo Tenun Biru', 'Olive Green']
    }
  },
  {
    id: 'prod-12',
    name: 'Lilin Kedelai Cendana & Cengkeh (200g)',
    category: 'barang',
    price: 95000,
    tags: ['Aromaterapi'],
    desc: 'Lilin aromaterapi 100% natural soy wax dalam toples kaca amber, dipadukan minyak atsiri kayu cendana NTT dan sentuhan hangat cengkeh.',
    story: 'Menghadirkan kehangatan malam nusantara dengan sumbu katun bebas timbal, menghasilkan aroma menenangkan yang membantu tidur lelap.',
    image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=700&q=80',
    calories: 'Durasi 45 Jam Bakar',
    origin: 'Kupang x Banyuwangi',
    variants: {
      title: 'Pilihan Aroma Varian',
      options: ['Cendana & Cengkeh (Warm Woody)', 'Pandan & Melati (Fresh Floral)', 'Kopi Tubruk & Vanilla (Cozy Sweet)']
    }
  },
  {
    id: 'prod-13',
    name: 'Kemeja Tenun Ikat Flores Kontemporer',
    category: 'fashion',
    price: 285000,
    tags: ['Karya Artisan', 'Eco-Fashion'],
    desc: 'Kemeja potongan modern berbahan kain tenun ikat tangan pewarna alam daun tarum dan mengkudu dari perajin perempuan Sikka, Flores.',
    story: 'Ditenun tradisional menggunakan alat tenun bukan mesin (ATBM) selama 21 hari dengan motif geometris penjaga laut yang sarat makna leluhur.',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=700&q=80',
    calories: 'Katun Tenun Alami',
    origin: 'Maumere, Sikka, Flores',
    variants: {
      title: 'Pilihan Ukuran & Pola',
      options: ['Ukuran M: Dada 104cm', 'Ukuran L: Dada 110cm', 'Ukuran XL: Dada 116cm']
    }
  },
  {
    id: 'prod-14',
    name: 'Dompet Kartu Kulit Nabati Pull-Up',
    category: 'fashion',
    price: 145000,
    tags: ['Handmade Leather'],
    desc: 'Dompet saku 6 slot kartu dan 1 kompartemen uang kertas, dibuat dari kulit sapi samak nabati tanpa kromium yang menua dengan patina indah.',
    story: 'Dijahit tangan dengan benang lilin poliester tahan putus oleh perajin kulit Manding, Bantul. Semakin sering digunakan, kilau patinanya semakin elegan.',
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=700&q=80',
    calories: 'Kulit Sapi Asli 100%',
    origin: 'Sentra Kulit Manding, DIY',
    variants: {
      title: 'Pilihan Warna Kulit',
      options: ['Chestnut Tan (Cokelat Hangat)', 'Espresso Dark Brown', 'Olive Green Patina']
    }
  },
  {
    id: 'prod-15',
    name: 'Mechanical Numpad Kayu Jati Solid',
    category: 'gadget',
    price: 320000,
    tags: ['Tech & Craft', 'Wireless'],
    desc: 'Numpad mekanikal 18 tombol dengan case kayu jati daur ulang presisi CNC, konektivitas ganda Bluetooth 5.0 dan kabel USB-C berbalut kain.',
    story: 'Menggabungkan kehangatan material kayu jati Jepara dengan switch mekanikal halus berperedam suara silikon untuk kenyamanan mengetik maksimal.',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=700&q=80',
    calories: 'Baterai 1200mAh',
    origin: 'Jepara Wood Tech',
    variants: {
      title: 'Pilihan Karakter Switch',
      options: ['Gateron Yellow (Linear Halus & Sunyi)', 'Gateron Brown (Tactile Empuk)', 'Kailh Box White (Clicky Renyah)']
    }
  },
  {
    id: 'prod-16',
    name: 'Desk Mat Kulit Vegan & Felt Wool (80x40cm)',
    category: 'gadget',
    price: 115000,
    tags: ['Workspace Gear'],
    desc: 'Alas meja kerja dua sisi fleksibel: satu sisi kulit vegan tahan air mudah dibersihkan, sisi lain wol felt alami yang hangat dan lembut untuk mouse optik.',
    story: 'Merapikan ruang kerja dengan sentuhan estetika minimalis, melindungi permukaan meja dari goresan, serta memberikan bantalan tangan saat bekerja lama.',
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=700&q=80',
    calories: 'Dimensi 80 x 40 cm',
    origin: 'Studio Kerja Minimalis',
    variants: {
      title: 'Pilihan Kombinasi Warna',
      options: ['Forest Green & Warm Grey Felt', 'Tan Mocca & Charcoal Felt', 'Midnight Blue & Ash Felt']
    }
  },
  {
    id: 'prod-17',
    name: 'Kartu Hadiah Digital Atelier (E-Voucher)',
    category: 'digital',
    price: 100000,
    tags: ['Instant Delivery', 'Gift Card'],
    desc: 'Voucher belanja digital dengan kode aktivasi instan otomatis setelah scan QRIS. Dapat digunakan untuk belanja makanan, kopi, maupun barang kriya.',
    story: 'Hadiah sempurna tanpa repot untuk kerabat dan rekan kerja. Berlaku selamanya tanpa tanggal kedaluwarsa dan bisa digabung dengan promo lainnya.',
    image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=700&q=80',
    calories: 'Digital Gift Code',
    origin: 'Atelier Digital Registry',
    variants: {
      title: 'Pilihan Nominal Saldo',
      options: ['Saldo Rp 100.000', 'Saldo Rp 250.000', 'Saldo Rp 500.000']
    }
  },
  {
    id: 'prod-18',
    name: 'Tiket Workshop Manual Brew & Cupping',
    category: 'digital',
    price: 175000,
    tags: ['Interactive Pass', 'Community'],
    desc: 'Akses eksklusif kelas interaktif 2 jam bersama Q-Grader bersertifikat internasional: belajar kalibrasi grind size, rasio pour over, dan sensori rasa.',
    story: 'Setiap peserta mendapatkan e-sertifikat resmi, lembar panduan cupping digital, serta kupon diskon 20% untuk pembelian biji kopi single origin.',
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80',
    calories: 'Durasi 120 Menit',
    origin: 'Atelier Coffee Lab',
    variants: {
      title: 'Pilihan Jadwal Kelas',
      options: ['Sesi Akhir Pekan (Sabtu 10:00 WIB)', 'Sesi Malam Santai (Jumat 19:30 WIB)', 'Akses Rekaman Video & Modul PDF']
    }
  }
];

export function getCategoryLabel(cat) {
  switch (cat) {
    case 'makanan': return 'Makanan Gourmet';
    case 'minuman': return 'Minuman Artisan';
    case 'barang': return 'Kriya & Rumah';
    case 'fashion': return 'Fashion & Busana';
    case 'gadget': return 'Gadget & Tech';
    case 'digital': return 'Produk Digital';
    default: return 'Pilihan Spesial';
  }
}

// ==========================================================================
// APPLICATION STATE (WITH LOCALSTORAGE PERSISTENCE)
// ==========================================================================
const STORAGE_KEY_CART = 'atelier_rasa_cart_v2';
const STORAGE_KEY_ORDER = 'atelier_rasa_active_order_v2';
const STORAGE_KEY_ALL_ORDERS = 'atelier_rasa_all_orders_v2';
const STORAGE_KEY_QRIS_CONFIG = 'atelier_rasa_qris_config_v2';
const STORAGE_KEY_STORE_CONFIG = 'atelier_rasa_store_config_v2';
const STORAGE_KEY_CUSTOM_PRODUCTS = 'atelier_rasa_products_v2';
const STORAGE_KEY_ADMIN_SESSION = 'atelier_rasa_admin_session_v2';
const ADMIN_REALTIME_CHANNEL = 'atelier-nusantara-admin';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'atelier2026';

export const REAL_USER_STATIC_QRIS = '00020101021126610014COM.GO-JEK.WWW01189360091430501410280210G0501410280303UMI51440014ID.CO.QRIS.WWW0215ID10265330868010303UMI5204899953033605802ID5925Toko Terpusat Belanja, Di6013JAKARTA BARAT61051182062070703A0163048201';

export const SHIPPING_RATES = {
  instant: { name: 'GoSend Instan', price: 15000, eta: '1 - 2 Jam' },
  regular: { name: 'Kurir Reguler', price: 10000, eta: '1 - 2 Hari' },
  pickup: { name: 'Ambil di Butik', price: 0, eta: 'Siap 30 Mnt' }
};

const state = {
  cart: [],
  activeCategory: 'semua',
  searchQuery: '',
  sortBy: 'featured',
  voucherDiscount: 0,
  activeVoucherCode: '',
  audioEnabled: true,
  currentOrder: null,
  paymentTimerInterval: null,
  activeOrder: null, // For Live Order Tracker
  allOrders: [], // Persistent order list for Admin Dashboard
  productsList: [], // Persistent product catalog for Admin CRUD
  merchantQRISMode: 'custom', // Auto-activated with user's real GoPay QRIS
  customStaticQRIS: REAL_USER_STATIC_QRIS,
  merchantWhatsApp: '6281234567890',
  shippingMethod: 'instant',
  customer: {
    name: '',
    phone: '',
    address: ''
  },
  adminAuthenticated: false,
  adminRealtimeChannel: null,
  adminRealtimeSourceId: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  adminSyncError: '',
  activeQuickViewProduct: null,
  selectedVariant: '',
  activeProductEditId: ''
};

export function getActiveProducts() {
  if (state.productsList && state.productsList.length > 0) {
    return state.productsList;
  }
  return PRODUCTS;
}

function getAdminSyncStatusElement() {
  return document.getElementById('admin-sync-status') || document.getElementById('admin-live-sync');
}

export function createAdminRealtimeChannel(onMessage) {
  const sourceId = state.adminRealtimeSourceId;
  let channel = null;
  let closed = false;

  const handleMessage = (event) => {
    const message = event && event.data ? event.data : event;
    if (!message || message.sourceId === sourceId || !message.domain || !message.timestamp) return;
    onMessage(message);
  };

  const handleStorage = (event) => {
    if (event.key !== STORAGE_KEY_ALL_ORDERS && event.key !== STORAGE_KEY_CUSTOM_PRODUCTS && event.key !== STORAGE_KEY_STORE_CONFIG) return;
    handleMessage({
      sourceId: `storage-${event.storageArea ? 'local' : 'unknown'}`,
      domain: event.key === STORAGE_KEY_ALL_ORDERS ? 'orders' : event.key === STORAGE_KEY_CUSTOM_PRODUCTS ? 'products' : 'store',
      timestamp: Date.now()
    });
  };

  try {
    if (typeof window.BroadcastChannel === 'function') {
      channel = new BroadcastChannel(ADMIN_REALTIME_CHANNEL);
      channel.addEventListener('message', handleMessage);
    }
  } catch (error) {
    state.adminSyncError = 'Sinkronisasi browser tidak tersedia, data lokal tetap bisa digunakan.';
    const statusEl = getAdminSyncStatusElement();
    if (statusEl) statusEl.textContent = state.adminSyncError;
  }
  window.addEventListener('storage', handleStorage);

  return {
    publish(change) {
      if (closed) return;
      const message = {
        sourceId,
        domain: change && change.domain ? change.domain : 'store',
        timestamp: Date.now()
      };
      if (channel) {
        channel.postMessage(message);
      }
    },
    close() {
      closed = true;
      window.removeEventListener('storage', handleStorage);
      if (channel) {
        channel.removeEventListener('message', handleMessage);
        channel.close();
      }
    }
  };
}

function ensureAdminRealtimeChannel() {
  if (state.adminRealtimeChannel) return state.adminRealtimeChannel;
  state.adminRealtimeChannel = createAdminRealtimeChannel((message) => {
    loadStateFromStorage();
    refreshAdminWorkspace({ reason: 'remote', highlightInvoice: message.invoice || '' });
  });
  return state.adminRealtimeChannel;
}

export function publishAdminChange(domain, details = {}) {
  ensureAdminRealtimeChannel().publish({ domain, ...details });
  refreshAdminWorkspace({ reason: 'local' });
}

export function refreshAdminWorkspace(options = {}) {
  const modal = document.getElementById('admin-dashboard-modal-backdrop');
  if (!modal || !modal.classList.contains('open')) return;

  const statusEl = getAdminSyncStatusElement();
  if (statusEl) {
    statusEl.textContent = state.adminSyncError || `Sinkron terakhir ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    statusEl.dataset.reason = options.reason || 'local';
  }

  const countEl = document.getElementById('admin-orders-count');
  if (countEl) countEl.textContent = `${state.allOrders.length} pesanan tercatat`;
  const totalOmzet = state.allOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
  const totalOrders = state.allOrders.length;
  const omzetEl = document.getElementById('admin-metric-omzet');
  const ordersEl = document.getElementById('admin-metric-orders');
  const aovEl = document.getElementById('admin-metric-aov');
  const settledEl = document.getElementById('admin-metric-settled');
  if (omzetEl) omzetEl.textContent = formatIDR(totalOmzet);
  if (ordersEl) ordersEl.textContent = totalOrders;
  if (aovEl) aovEl.textContent = formatIDR(totalOrders ? Math.round(totalOmzet / totalOrders) : 0);
  if (settledEl) settledEl.textContent = totalOrders;
  const needsActionEl = document.getElementById('admin-needs-action');
  if (needsActionEl) needsActionEl.textContent = state.allOrders.filter(order => (order.statusStep || 0) === 0).length;
  const activeOrdersEl = document.getElementById('admin-active-orders');
  if (activeOrdersEl) activeOrdersEl.textContent = state.allOrders.filter(order => (order.statusStep || 0) < 3).length;
  const emptyStateEl = document.getElementById('admin-empty-state');
  if (emptyStateEl) emptyStateEl.hidden = state.allOrders.length !== 0;
  const productBadge = document.getElementById('admin-product-count-badge');
  if (productBadge) productBadge.textContent = getActiveProducts().length;
  const overviewOrders = document.getElementById('admin-overview-orders');
  if (overviewOrders) overviewOrders.textContent = `${state.allOrders.length} pesanan tercatat`;
  const overviewProducts = document.getElementById('admin-overview-products');
  if (overviewProducts) overviewProducts.textContent = `${getActiveProducts().length} produk di katalog`;
  const storefrontWhatsapp = document.getElementById('admin-storefront-whatsapp');
  if (storefrontWhatsapp && document.activeElement !== storefrontWhatsapp) {
    storefrontWhatsapp.value = state.merchantWhatsApp;
  }
  const storefrontCatalogStatus = document.getElementById('admin-storefront-catalog-status');
  if (storefrontCatalogStatus) {
    storefrontCatalogStatus.textContent = `${getActiveProducts().length} produk terhubung ke katalog pelanggan.`;
  }
  renderAdminOrderTable();
  renderAdminProductsTable();
  animateAdminWorkspaceChange(options);
}

export function animateAdminWorkspaceEntrance() {
  if (!window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets = document.querySelectorAll('#admin-ops-summary, #admin-view-orders > .admin-metrics-grid, #admin-view-tools, #admin-view-orders > div:last-child');
  window.gsap.fromTo(targets, { y: 18, opacity: 0 }, {
    y: 0,
    opacity: 1,
    duration: 0.48,
    stagger: 0.07,
    ease: 'power2.out',
    overwrite: true
  });
}

export function animateAdminWorkspaceChange(options = {}) {
  if (!window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (options.highlightInvoice) {
    const row = document.querySelector(`[data-admin-row="${options.highlightInvoice}"]`);
    if (row) {
      window.gsap.fromTo(row, { backgroundColor: 'rgba(194, 94, 59, 0.16)' }, {
        backgroundColor: 'transparent',
        duration: 1.1,
        ease: 'power2.out',
        overwrite: true
      });
    }
  }
}

// ==========================================================================
// PERSISTENCE HELPERS
// ==========================================================================
function saveStateToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_CART, JSON.stringify(state.cart));
    if (state.activeOrder) {
      localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(state.activeOrder));
    } else {
      localStorage.removeItem(STORAGE_KEY_ORDER);
    }
    localStorage.setItem(STORAGE_KEY_ALL_ORDERS, JSON.stringify(state.allOrders));
    localStorage.setItem(STORAGE_KEY_QRIS_CONFIG, JSON.stringify({
      mode: state.merchantQRISMode,
      staticString: state.customStaticQRIS
    }));
    localStorage.setItem(STORAGE_KEY_STORE_CONFIG, JSON.stringify({
      merchantWhatsApp: state.merchantWhatsApp,
      shippingMethod: state.shippingMethod,
      customer: state.customer
    }));
    localStorage.setItem(STORAGE_KEY_CUSTOM_PRODUCTS, JSON.stringify(state.productsList));
    if (state.adminAuthenticated) {
      localStorage.setItem(STORAGE_KEY_ADMIN_SESSION, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
    }
  } catch (err) {
    console.warn('Storage save failed:', err);
  }
}

function loadStateFromStorage() {
  const readJSON = (key, fallback = null) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn(`Storage data invalid for ${key}:`, error);
      return fallback;
    }
  };

  state.cart = readJSON(STORAGE_KEY_CART, []) || [];
  state.activeOrder = readJSON(STORAGE_KEY_ORDER, null);
  if (state.activeOrder) updateOrderTrackerDockUI();

  const savedAllOrders = readJSON(STORAGE_KEY_ALL_ORDERS, null);
  if (Array.isArray(savedAllOrders)) {
    state.allOrders = savedAllOrders;
  } else {
      // Seed with sample completed order for realistic demo
      state.allOrders = [
        {
          invoice: 'INV-RASA-882104',
          date: '01/11/2026, 08.45',
          customer: { name: 'Siti Rahmawati', phone: '081299887766', address: 'Jl. Senopati No. 42' },
          shipping: { method: 'instant', name: 'GoSend Instan', price: 15000 },
          items: [{ product: PRODUCTS[0], quantity: 2, note: 'Level 1: Sedang Nikmat' }],
          amount: 173000,
          paymentMethod: 'QRIS Dinamis (GoPay Verified)',
          statusStep: 3,
          statusLabel: 'Pesanan Selesai Diterima'
        }
      ];
  }
  const savedProducts = readJSON(STORAGE_KEY_CUSTOM_PRODUCTS, null);
  state.productsList = Array.isArray(savedProducts) ? savedProducts : PRODUCTS.map(p => ({ ...p, isAvailable: true }));
  state.adminAuthenticated = !!localStorage.getItem(STORAGE_KEY_ADMIN_SESSION);

  const savedQRIS = readJSON(STORAGE_KEY_QRIS_CONFIG, null);
  state.merchantQRISMode = savedQRIS?.mode || 'custom';
  state.customStaticQRIS = savedQRIS?.staticString || REAL_USER_STATIC_QRIS;

  const savedStore = readJSON(STORAGE_KEY_STORE_CONFIG, null);
  if (savedStore) {
    if (savedStore.merchantWhatsApp) state.merchantWhatsApp = savedStore.merchantWhatsApp;
    if (savedStore.shippingMethod) state.shippingMethod = savedStore.shippingMethod;
    if (savedStore.customer) state.customer = savedStore.customer;
  }
}

// ==========================================================================
// WEB AUDIO SYNTHESIZER
// ==========================================================================
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playClick() {
    if (!state.audioEnabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  playSuccess() {
    if (!state.audioEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const playNote = (freq, time, dur) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(time);
      osc.stop(time + dur);
    };

    playNote(523.25, now, 0.15);        // C5
    playNote(659.25, now + 0.12, 0.15); // E5
    playNote(783.99, now + 0.24, 0.35); // G5
  }

  playCashChime() {
    if (!state.audioEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Coin clink 1 (high ping)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1320, now);
    osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // 2. Coin clink 2 (rich mechanical click)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(987.77, now + 0.06);
    gain2.gain.setValueAtTime(0.25, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.25);

    // 3. Resonant Cash Register Bell (Ching! 2093Hz + 2637Hz harmonics)
    const oscBell = this.ctx.createOscillator();
    const gainBell = this.ctx.createGain();
    oscBell.type = 'sine';
    oscBell.frequency.setValueAtTime(2093, now + 0.12);
    gainBell.gain.setValueAtTime(0.35, now + 0.12);
    gainBell.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    oscBell.connect(gainBell);
    gainBell.connect(this.ctx.destination);
    oscBell.start(now + 0.12);
    oscBell.stop(now + 0.85);

    const oscHarm = this.ctx.createOscillator();
    const gainHarm = this.ctx.createGain();
    oscHarm.type = 'sine';
    oscHarm.frequency.setValueAtTime(2637, now + 0.12);
    gainHarm.gain.setValueAtTime(0.2, now + 0.12);
    gainHarm.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    oscHarm.connect(gainHarm);
    gainHarm.connect(this.ctx.destination);
    oscHarm.start(now + 0.12);
    oscHarm.stop(now + 0.7);
  }
}

const sfx = new SoundFX();

// Cross-tab real-time sync channel
let orderBroadcastChannel = null;
try {
  orderBroadcastChannel = new BroadcastChannel('atelier_rasa_sync');
  orderBroadcastChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'NEW_PAYMENT') {
      const order = event.data.order;
      triggerPaymentAlert(order);
      loadStateFromStorage();
      const adminModal = document.getElementById('admin-dashboard-modal-backdrop');
      if (adminModal && adminModal.classList.contains('open')) {
        openAdminDashboardModal();
      }
      showToast(`Pesanan masuk: ${formatIDR(order.amount)} dari ${order.customer ? order.customer.name : 'Pelanggan'}`);
    }
  };
} catch (e) {
  // BroadcastChannel fallback
}

export function triggerPaymentAlert(order) {
  // 1. Play Cash Register Sound Chime
  sfx.playCashChime();

  // 2. Haptic Vibration (Phone Alert Pattern)
  if (navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200, 100, 400]);
    } catch (e) {
      // ignore
    }
  }

  // 3. Web Notification API (OS-Level Push Alert)
  const custName = (order.customer && order.customer.name) || 'Pelanggan';
  const amountStr = formatIDR(order.amount);
  const title = `💰 Pembayaran QRIS Masuk!`;
  const body = `Diterima: ${amountStr} dari ${custName} (${order.invoice})`;

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=128&q=80',
        tag: order.invoice,
        requireInteraction: true
      });
    } catch (e) {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body: body,
            icon: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=128&q=80',
            tag: order.invoice
          });
        });
      }
    }
  }
}

export function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Browser ini tidak mendukung Web Notifications.');
    return;
  }

  Notification.requestPermission().then(permission => {
    updateNotificationPermissionStatus();
    if (permission === 'granted') {
      sfx.playCashChime();
      showToast('Izin notifikasi aktif! HP Anda akan berbunyi saat pembayaran masuk.');
      triggerPaymentAlert({
        invoice: 'TEST-NOTIF',
        amount: 150000,
        customer: { name: 'Tes Notifikasi Kasir' }
      });
    } else {
      showToast('Izin notifikasi belum diberikan atau diblokir.');
    }
  });
}

export function testNotificationSound() {
  sfx.playCashChime();
  if (navigator.vibrate) {
    try { navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) { }
  }
  showToast('🔊 Memutar bunyi kasir Ka-ching & getar HP!');
}

export function updateNotificationPermissionStatus() {
  const badge = document.getElementById('notif-permission-status');
  if (!badge) return;
  if (!('Notification' in window)) {
    badge.textContent = 'Tidak Didukung';
    badge.style.background = '#E5E7EB';
    badge.style.color = '#374151';
  } else if (Notification.permission === 'granted') {
    badge.textContent = 'Aktif (Berdering & Pop-up)';
    badge.style.background = '#D1FAE5';
    badge.style.color = '#065F46';
  } else if (Notification.permission === 'denied') {
    badge.textContent = 'Diblokir di Browser';
    badge.style.background = '#FEE2E2';
    badge.style.color = '#991B1B';
  } else {
    badge.textContent = 'Belum Diaktifkan';
    badge.style.background = '#FEF3C7';
    badge.style.color = '#92400E';
  }
}

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================
export function formatIDR(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

export function showToast(message) {
  const toaster = document.getElementById('toast-notification');
  const text = document.getElementById('toast-text');
  if (!toaster || !text) return;

  text.textContent = message;
  toaster.classList.add('show');
  setTimeout(() => {
    toaster.classList.remove('show');
  }, 3200);
}

// ==========================================================================
// CATALOG RENDERING & FILTERING
// ==========================================================================
export function renderCatalog() {
  const grid = document.getElementById('product-grid');
  const countEl = document.getElementById('results-count');
  if (!grid) return;

  const allActive = getActiveProducts();
  let filtered = allActive.filter(p => {
    const matchesCategory = (state.activeCategory === 'semua' || p.category === state.activeCategory);
    const matchesQuery = p.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      p.desc.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(state.searchQuery.toLowerCase())));
    return matchesCategory && matchesQuery;
  });

  if (state.sortBy === 'price-low') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (state.sortBy === 'price-high') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (state.sortBy === 'popular') {
    filtered.sort((a, b) => ((b.tags && b.tags.includes('Best Seller')) ? 1 : 0) - ((a.tags && a.tags.includes('Best Seller')) ? 1 : 0));
  }

  if (countEl) {
    countEl.textContent = `Menampilkan ${filtered.length} produk & karya pilihan`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <h3>Pencarian Tidak Ditemukan</h3>
        <p>Coba gunakan kata kunci lain seperti "tenun", "numpad", "voucher", "kopi", atau "matcha".</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const cartItem = state.cart.find(c => c.product.id === item.id);
    const qty = cartItem ? cartItem.quantity : 0;
    const isAvailable = item.isAvailable !== false;
    const cardClass = isAvailable ? 'product-card' : 'product-card is-sold-out';

    return `
      <article class="${cardClass}" data-id="${item.id}" id="card-${item.id}">
        <div class="card-media" role="button" tabindex="0" onclick="window.openQuickView('${item.id}')" onkeydown="if(event.key==='Enter'||event.key===' ') window.openQuickView('${item.id}')" aria-label="Lihat detail dan varian ${item.name}" title="Klik untuk lihat detail & varian">
          ${!isAvailable ? '<span class="badge-sold-out">Habis</span>' : ''}
          <img src="${item.image}" alt="${item.name}" width="380" height="240" loading="lazy" style="aspect-ratio: 16/10; object-fit: cover;" />
          <div class="card-badge-wrap">
            <span class="badge-pill badge-category" data-cat="${item.category}">${getCategoryLabel(item.category)}</span>
            ${item.tags && item.tags[0] ? `<span class="badge-pill badge-tag">${item.tags[0]}</span>` : ''}
          </div>
        </div>
        <div class="card-body">
          <h3 class="card-title" role="button" tabindex="0" onclick="window.openQuickView('${item.id}')" onkeydown="if(event.key==='Enter'||event.key===' ') window.openQuickView('${item.id}')" aria-label="Lihat detail ${item.name}">${item.name}</h3>
          <p class="card-desc">${item.desc}</p>
          <div class="card-footer">
            <div class="card-price">
              <span class="price-label">Harga</span>
              <span class="price-value">${formatIDR(item.price)}</span>
            </div>
            <div class="card-action-slot">
              ${!isAvailable ? `
                <button class="btn-add" disabled style="background:#E5E7EB !important; color:#9CA3AF !important; cursor:not-allowed !important;" title="Stok sedang habis">
                  Habis
                </button>
              ` : qty > 0 ? `
                <div class="qty-stepper">
                  <button class="stepper-btn" onclick="window.updateQuantity('${item.id}', ${qty - 1})" aria-label="Kurangi kuantitas">−</button>
                  <span class="stepper-val">${qty}</span>
                  <button class="stepper-btn" onclick="window.updateQuantity('${item.id}', ${qty + 1})" aria-label="Tambah kuantitas">+</button>
                </div>
              ` : `
                <button class="btn-add" onclick="window.openQuickView('${item.id}')" aria-label="Pilih varian ${item.name}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Pilih Varian
                </button>
              `}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => {
      if (window.ScrollTrigger) {
        window.ScrollTrigger.refresh();
      }
      if (window.gsap) {
        initGSAPAnimations();
      }
    });
  }
}

// ==========================================================================
// QUICK VIEW & PRODUCT VARIANT SELECTOR MODAL
// ==========================================================================
export function openQuickView(productId) {
  const product = getActiveProducts().find(p => p.id === productId);
  if (!product) return;

  state.activeQuickViewProduct = product;
  state.selectedVariant = (product.variants && product.variants.options) ? product.variants.options[0] : '';
  sfx.playClick();

  const modal = document.getElementById('quick-view-modal-backdrop');
  const imgEl = document.getElementById('qv-img');
  const titleEl = document.getElementById('qv-title');
  const priceEl = document.getElementById('qv-price');
  const storyEl = document.getElementById('qv-story');
  const factsEl = document.getElementById('qv-facts');
  const variantTitleEl = document.getElementById('qv-variant-title');
  const variantGridEl = document.getElementById('qv-variant-grid');

  if (imgEl) imgEl.src = product.image;
  if (titleEl) titleEl.textContent = product.name;
  if (priceEl) priceEl.textContent = formatIDR(product.price);
  if (storyEl) storyEl.textContent = product.story || product.desc;
  if (factsEl) {
    factsEl.innerHTML = `
      <span>📍 Asal: <strong>${product.origin || 'Nusantara'}</strong></span>
      <span>⚡ Energi: <strong>${product.calories || 'Alami'}</strong></span>
    `;
  }

  if (product.variants && product.variants.options && variantTitleEl && variantGridEl) {
    variantTitleEl.textContent = product.variants.title;
    variantGridEl.innerHTML = product.variants.options.map((opt, idx) => `
      <button type="button" class="variant-pill-label ${idx === 0 ? 'active' : ''}" data-val="${opt}" onclick="window.selectVariantOption('${opt}', this)" aria-label="Pilih varian ${opt}">
        ${opt}
      </button>
    `).join('');
  }

  if (modal) modal.classList.add('open');
}

export function closeQuickView() {
  const modal = document.getElementById('quick-view-modal-backdrop');
  if (modal) modal.classList.remove('open');
  state.activeQuickViewProduct = null;
}

export function selectVariantOption(optionVal, element) {
  state.selectedVariant = optionVal;
  sfx.playClick();
  document.querySelectorAll('.variant-pill-label').forEach(el => el.classList.remove('active'));
  if (element) element.classList.add('active');
}

export function addQuickViewToCart() {
  if (!state.activeQuickViewProduct) return;
  const p = state.activeQuickViewProduct;
  if (p.isAvailable === false) {
    showToast('Maaf, stok produk ini sedang habis.');
    return;
  }

  const variantNote = state.selectedVariant ? `Varian: ${state.selectedVariant}` : '';

  const existing = state.cart.find(c => c.product.id === p.id && c.note === variantNote);
  if (existing) {
    existing.quantity++;
  } else {
    state.cart.push({ product: p, quantity: 1, note: variantNote });
  }

  sfx.playClick();
  saveStateToStorage();
  updateCartUI();
  renderCatalog();
  closeQuickView();
  showToast(`Ditambahkan: ${p.name} (${state.selectedVariant || 'Standar'})`);
}

// ==========================================================================
// CART OPERATIONS
// ==========================================================================
export function addToCart(productId) {
  const product = getActiveProducts().find(p => p.id === productId);
  if (!product) return;
  if (product.isAvailable === false) {
    showToast('Maaf, stok produk ini sedang habis.');
    return;
  }

  const defaultNote = (product.variants && product.variants.options) ? `Varian: ${product.variants.options[0]}` : '';
  const existing = state.cart.find(c => c.product.id === productId && c.note === defaultNote);
  if (existing) {
    existing.quantity++;
  } else {
    state.cart.push({ product, quantity: 1, note: defaultNote });
  }

  sfx.playClick();
  saveStateToStorage();
  updateCartUI();
  renderCatalog();
  showToast(`Ditambahkan: ${product.name}`);
}

export function updateQuantity(productId, newQty) {
  sfx.playClick();
  if (newQty <= 0) {
    state.cart = state.cart.filter(c => c.product.id !== productId);
  } else {
    const item = state.cart.find(c => c.product.id === productId);
    if (item) item.quantity = newQty;
  }

  saveStateToStorage();
  updateCartUI();
  renderCatalog();
}

export function updateCartUI() {
  const countBadge = document.getElementById('cart-badge');
  const drawerCount = document.getElementById('drawer-count');
  const drawerItems = document.getElementById('drawer-items');
  const subtotalEl = document.getElementById('summary-subtotal');
  const discountRow = document.getElementById('summary-discount-row');
  const discountEl = document.getElementById('summary-discount');
  const shippingEl = document.getElementById('summary-shipping');
  const totalEl = document.getElementById('summary-total');
  const btnCheckout = document.getElementById('btn-checkout');

  // Customer Form Elements Sync
  const nameInput = document.getElementById('customer-name');
  const phoneInput = document.getElementById('customer-phone');
  const addrInput = document.getElementById('customer-address');

  if (nameInput && !nameInput.value && state.customer.name) nameInput.value = state.customer.name;
  if (phoneInput && !phoneInput.value && state.customer.phone) phoneInput.value = state.customer.phone;
  if (addrInput && !addrInput.value && state.customer.address) addrInput.value = state.customer.address;

  // Active Shipping Pill UI Sync
  document.querySelectorAll('.shipping-method-card').forEach(card => card.classList.remove('active'));
  const activeShipCard = document.getElementById(`ship-${state.shippingMethod}`);
  if (activeShipCard) activeShipCard.classList.add('active');

  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const ecoPackaging = subtotal > 0 ? 2000 : 0;
  const discountAmount = Math.round(subtotal * state.voucherDiscount);
  const currentRate = SHIPPING_RATES[state.shippingMethod] || SHIPPING_RATES.instant;
  const shippingCost = subtotal > 0 ? currentRate.price : 0;
  const total = Math.max(0, subtotal - discountAmount + ecoPackaging + shippingCost);

  if (countBadge) countBadge.textContent = totalItems;
  const mobBadge = document.getElementById('mob-cart-badge');
  if (mobBadge) mobBadge.textContent = totalItems;
  if (drawerCount) drawerCount.textContent = `(${totalItems} pesanan)`;

  if (subtotalEl) subtotalEl.textContent = formatIDR(subtotal);
  if (shippingEl) shippingEl.textContent = formatIDR(shippingCost);
  if (totalEl) totalEl.textContent = formatIDR(total);
  if (discountRow && discountEl) {
    if (discountAmount > 0) {
      discountRow.style.display = 'flex';
      discountEl.textContent = `- ${formatIDR(discountAmount)}`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  if (btnCheckout) {
    btnCheckout.disabled = (totalItems === 0);
    btnCheckout.style.opacity = totalItems === 0 ? '0.6' : '1';
  }

  if (!drawerItems) return;

  if (state.cart.length === 0) {
    drawerItems.innerHTML = `
      <div class="cart-empty-view">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        <p>Keranjang pesanan masih kosong.<br>Silakan pilih menu atau kriya yang Anda inginkan.</p>
      </div>
    `;
    return;
  }

  drawerItems.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-thumb">
        <img src="${item.product.image}" alt="${item.product.name}" width="64" height="64" style="aspect-ratio: 1/1; object-fit: cover;" />
      </div>
      <div class="cart-item-info">
        <h4>${item.product.name}</h4>
        <span class="cart-item-price">${formatIDR(item.product.price)}</span>
        <button type="button" class="cart-item-note" onclick="window.promptNote('${item.product.id}')" aria-label="Tambah catatan khusus">
          ${item.note ? `${item.note}` : '+ Tambah catatan khusus'}
        </button>
      </div>
      <div class="qty-stepper">
        <button class="stepper-btn" onclick="window.updateQuantity('${item.product.id}', ${item.quantity - 1})">−</button>
        <span class="stepper-val">${item.quantity}</span>
        <button class="stepper-btn" onclick="window.updateQuantity('${item.product.id}', ${item.quantity + 1})">+</button>
      </div>
    </div>
  `).join('');
}

export function selectShippingMethod(method) {
  if (!SHIPPING_RATES[method]) return;
  state.shippingMethod = method;
  sfx.playClick();
  document.querySelectorAll('.shipping-method-card').forEach(el => el.classList.remove('active'));
  const card = document.getElementById(`ship-${method}`);
  if (card) card.classList.add('active');
  saveStateToStorage();
  updateCartUI();
}

export function updateCustomerInfo() {
  const nameEl = document.getElementById('customer-name');
  const phoneEl = document.getElementById('customer-phone');
  const addrEl = document.getElementById('customer-address');

  state.customer = {
    name: nameEl ? nameEl.value.trim() : '',
    phone: phoneEl ? phoneEl.value.trim() : '',
    address: addrEl ? addrEl.value.trim() : ''
  };
  saveStateToStorage();
}

export function promptNote(productId) {
  const item = state.cart.find(c => c.product.id === productId);
  if (!item) return;

  const note = prompt(`Catatan khusus untuk ${item.product.name}:`, item.note || '');
  if (note !== null) {
    item.note = note.trim();
    saveStateToStorage();
    updateCartUI();
  }
}

// ==========================================================================
// VOUCHER LOGIC
// ==========================================================================
export function applyVoucher() {
  const input = document.getElementById('voucher-input');
  if (!input) return;

  const code = input.value.trim().toUpperCase();
  if (code === 'RASAHEMAT' || code === 'ANTISLOP') {
    state.voucherDiscount = 0.15;
    state.activeVoucherCode = code;
    sfx.playSuccess();
    showToast(`Voucher ${code} berhasil dipasang! Diskon 15%.`);
    updateCartUI();
  } else if (code === '') {
    state.voucherDiscount = 0;
    updateCartUI();
  } else {
    showToast('Kode voucher tidak valid. Gunakan kode: RASAHEMAT');
  }
}

// ==========================================================================
// DYNAMIC QRIS & PAYMENT CHECKOUT
// ==========================================================================
export function openCheckoutModal() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  if (totalItems === 0) {
    showToast('Keranjang Anda masih kosong.');
    return;
  }

  updateCustomerInfo();
  closeCartDrawer();
  sfx.playClick();

  const subtotal = state.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const discountAmount = Math.round(subtotal * state.voucherDiscount);
  const currentRate = SHIPPING_RATES[state.shippingMethod] || SHIPPING_RATES.instant;
  const shippingCost = subtotal > 0 ? currentRate.price : 0;
  const totalAmount = Math.max(0, subtotal - discountAmount + 2000 + shippingCost);
  const invoiceNum = 'INV-RASA-' + Date.now().toString().slice(-6);

  state.currentOrder = {
    invoice: invoiceNum,
    amount: totalAmount,
    items: [...state.cart],
    shipping: currentRate,
    customer: { ...state.customer },
    date: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
  };

  let merchantDisplay = 'Toko Terpusat Belanja, Di';
  let nmidDisplay = 'ID1026533086801 · JAKARTA BARAT';

  try {
    const parsed = parseEMVCoQRIS(state.customStaticQRIS || REAL_USER_STATIC_QRIS);
    if (parsed['59']) merchantDisplay = parsed['59'];
    if (parsed['51']) {
      const nmidMatch = parsed['51'].match(/ID\d+/);
      if (nmidMatch) nmidDisplay = nmidMatch[0];
    }
    if (parsed['60']) {
      nmidDisplay += ` · ${parsed['60']}`;
    }
  } catch (e) {
    // keep default
  }

  const amountEl = document.getElementById('qris-amount-number');
  const invoiceEl = document.getElementById('payment-invoice-number');
  const merchantEl = document.getElementById('qris-merchant-display');
  const nmidEl = document.getElementById('qris-nmid-display');
  const modal = document.getElementById('payment-modal-backdrop');

  if (amountEl) amountEl.textContent = formatIDR(totalAmount);
  if (invoiceEl) invoiceEl.textContent = invoiceNum;
  if (merchantEl) merchantEl.textContent = merchantDisplay;
  if (nmidEl) nmidEl.textContent = `NMID: ${nmidDisplay}`;

  const vaEl = document.getElementById('va-code-number');
  if (vaEl) vaEl.textContent = '88019' + Date.now().toString().slice(-8);

  // Render QR Code via switchQRISDisplayMode
  switchQRISDisplayMode(state.currentQRISMode || 'dynamic');

  startPaymentCountdown(300);

  if (modal) modal.classList.add('open');
}

export function switchQRISDisplayMode(mode = 'dynamic') {
  state.currentQRISMode = mode;

  const btnDynamic = document.getElementById('btn-qris-mode-dynamic');
  const btnStatic = document.getElementById('btn-qris-mode-static');
  const helperText = document.getElementById('qris-mode-helper');
  const amountLabelEl = document.getElementById('qris-amount-label');
  const amountEl = document.getElementById('qris-amount-number');
  const qrContainer = document.getElementById('qris-svg-container');

  if (btnDynamic) {
    btnDynamic.style.background = mode === 'dynamic' ? 'var(--accent-terracotta)' : 'transparent';
    btnDynamic.style.color = mode === 'dynamic' ? '#FFFFFF' : 'var(--ink-secondary)';
  }
  if (btnStatic) {
    btnStatic.style.background = mode === 'static' ? 'var(--accent-terracotta)' : 'transparent';
    btnStatic.style.color = mode === 'static' ? '#FFFFFF' : 'var(--ink-secondary)';
  }

  const totalAmount = state.currentOrder ? state.currentOrder.amount : 0;
  const invoiceNum = state.currentOrder ? state.currentOrder.invoice : 'INV01';
  let payload = '';

  if (mode === 'static') {
    payload = state.customStaticQRIS || REAL_USER_STATIC_QRIS;
    if (amountLabelEl) amountLabelEl.textContent = 'Nominal Bayar (Ketik di HP):';
    if (helperText) helperText.textContent = 'Mode Statis Asli: Scan QR poster lalu ketik nominal pesanan Anda di aplikasi bank.';
  } else {
    try {
      payload = convertStaticToDynamicQRIS(state.customStaticQRIS || REAL_USER_STATIC_QRIS, totalAmount, invoiceNum);
    } catch (err) {
      console.warn('Konversi QRIS Dinamis error:', err);
      payload = state.customStaticQRIS || REAL_USER_STATIC_QRIS;
    }
    if (amountLabelEl) amountLabelEl.textContent = 'Total Tagihan Otomatis (Terkunci di HP):';
    if (helperText) helperText.textContent = 'Mode Dinamis: Tagihan terkunci otomatis di scanner aplikasi perbankan Anda.';
  }

  state.activeQRISPayload = payload;

  if (qrContainer) {
    qrContainer.innerHTML = renderQRCodeSVG(payload, 250);
  }
}

export function copyQRISPayload() {
  const payload = state.activeQRISPayload || state.customStaticQRIS || REAL_USER_STATIC_QRIS;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(payload).then(() => {
      showToast('Payload string QRIS EMVCo berhasil disalin ke clipboard.');
    }).catch(() => {
      prompt('Salin data string QRIS berikut:', payload);
    });
  } else {
    prompt('Salin data string QRIS berikut:', payload);
  }
}

export function downloadQRISImage() {
  sfx.playClick();
  const payload = state.activeQRISPayload || state.customStaticQRIS || REAL_USER_STATIC_QRIS;
  const order = state.currentOrder || { invoice: 'INV-RASA-' + Date.now().toString().slice(-6), amount: 0 };
  const totalAmount = order.amount || 0;
  const invoiceNum = order.invoice || 'INV-RASA-001';

  let merchantName = 'Toko Terpusat Belanja, Di';
  let nmid = 'ID1026533086801';
  let city = 'JAKARTA BARAT';

  try {
    const parsed = parseEMVCoQRIS(payload);
    if (parsed.merchantName) merchantName = parsed.merchantName;
    if (parsed.merchantCity) city = parsed.merchantCity;
    if (parsed.nmid) nmid = parsed.nmid;
  } catch (e) {
    // fallback to defaults
  }

  // Create High-Res Offscreen Canvas (800 x 1040)
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1040;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    showToast('Browser tidak mendukung ekspor canvas.');
    return;
  }

  // 1. Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 800, 1040);

  // 2. Top Header - Red QRIS Brand Stripe
  ctx.fillStyle = '#C8102E';
  ctx.fillRect(0, 0, 800, 16);

  // 3. Header Logos & Badges
  ctx.fillStyle = '#C8102E';
  ctx.font = 'bold 44px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QRIS', 400, 75);

  ctx.fillStyle = '#4B5563';
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('STANDAR PEMBAYARAN DIGITAL NASIONAL', 400, 102);

  // Hairline Divider
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 122);
  ctx.lineTo(740, 122);
  ctx.stroke();

  // 4. Merchant Information Box
  ctx.fillStyle = '#1B2B1E';
  ctx.font = 'bold 26px "Playfair Display", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(merchantName, 400, 165);

  ctx.fillStyle = '#6B7280';
  ctx.font = '600 16px "SF Mono", monospace, monospace';
  ctx.fillText(`NMID: ${nmid} · ${city}`, 400, 195);

  // 5. Draw QR Code Matrix
  const qrSize = 500;
  const qrX = 150;
  const qrY = 225;

  // Background box for QR code with border
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 2;
  ctx.strokeRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);

  let qrDrawn = false;
  if (typeof window !== 'undefined' && window.qrcode) {
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(payload);
      qr.make();
      const count = qr.getModuleCount();
      const modSize = qrSize / count;

      ctx.fillStyle = '#000000';
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(qrX + c * modSize, qrY + r * modSize, modSize + 0.3, modSize + 0.3);
          }
        }
      }
      qrDrawn = true;
    } catch (e) {
      console.warn('Canvas QR matrix generator error:', e);
    }
  }

  const proceedDownload = () => {
    // 6. Amount Display Box (Below QR)
    const boxY = 790;
    ctx.fillStyle = '#F9FAFB';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(100, boxY, 600, 130, 14);
      ctx.fill();
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(100, boxY, 600, 130, 14);
      ctx.stroke();
    } else {
      ctx.fillRect(100, boxY, 600, 130);
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(100, boxY, 600, 130);
    }

    ctx.fillStyle = '#6B7280';
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TOTAL TAGIHAN TERKUNCI (SCAN DARI GALERI HP):', 400, boxY + 36);

    ctx.fillStyle = '#C8102E';
    ctx.font = '800 38px "Plus Jakarta Sans", monospace';
    ctx.fillText(formatIDR(totalAmount), 400, boxY + 82);

    ctx.fillStyle = '#4B5563';
    ctx.font = '600 14px "SF Mono", monospace';
    ctx.fillText(`No. Invoice: ${invoiceNum}`, 400, boxY + 112);

    // 7. Footer Instructions
    ctx.fillStyle = '#1B2B1E';
    ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('GOPAY · BCA · DANA · LIVIN · SHOPEEPAY · OVO · LINKAJA', 400, 960);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Buka aplikasi m-Banking/E-Wallet Anda > Buka menu QRIS > Pilih icon Gambar/Galeri', 400, 985);

    // Bottom subtle bar
    ctx.fillStyle = '#1B2B1E';
    ctx.fillRect(0, 1028, 800, 12);

    // 8. Trigger PNG Download
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          showToast('Gagal memproses gambar QRIS.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QRIS_${invoiceNum}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        sfx.playSuccess();
        showToast('📥 Gambar QRIS berhasil disimpan ke Galeri HP! Buka e-wallet Anda & pilih Scan dari Galeri.');
      }, 'image/png');
    } catch (err) {
      console.warn('Canvas toBlob failed:', err);
      showToast('Gagal mengunduh gambar QRIS.');
    }
  };

  if (qrDrawn) {
    proceedDownload();
  } else {
    const svgEl = document.querySelector('#qris-svg-container svg');
    if (svgEl) {
      const xml = new XMLSerializer().serializeToString(svgEl);
      const svg64 = btoa(unescape(encodeURIComponent(xml)));
      const b64Start = 'data:image/svg+xml;base64,';
      const image64 = b64Start + svg64;
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
        proceedDownload();
      };
      img.onerror = () => {
        proceedDownload();
      };
      img.src = image64;
    } else {
      proceedDownload();
    }
  }
}

export function closeCheckoutModal() {
  const modal = document.getElementById('payment-modal-backdrop');
  if (modal) modal.classList.remove('open');
  if (state.paymentTimerInterval) clearInterval(state.paymentTimerInterval);
}

export function focusMobileSearch() {
  const catalogEl = document.getElementById('katalog');
  if (catalogEl) {
    catalogEl.scrollIntoView({ behavior: 'smooth' });
  }
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    setTimeout(() => {
      searchInput.focus();
    }, 350);
  }
}

export function switchMobileTab(target) {
  const catalogEl = document.getElementById('katalog');
  if (catalogEl) {
    catalogEl.scrollIntoView({ behavior: 'smooth' });
  }
}

function startPaymentCountdown(durationSeconds) {
  if (state.paymentTimerInterval) clearInterval(state.paymentTimerInterval);

  let remaining = durationSeconds;
  const timerEl = document.getElementById('payment-countdown-clock');

  const update = () => {
    const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
    const secs = (remaining % 60).toString().padStart(2, '0');
    if (timerEl) timerEl.textContent = `${mins}:${secs}`;

    if (remaining <= 0) {
      clearInterval(state.paymentTimerInterval);
      if (timerEl) timerEl.textContent = 'Kedaluwarsa';
      showToast('Waktu pembayaran QRIS habis. Silakan buka ulang pembayaran.');
    }
    remaining--;
  };

  update();
  state.paymentTimerInterval = setInterval(update, 1000);
}

export function simulatePaymentSuccess() {
  const btn = document.getElementById('btn-simulate-pay');
  if (btn) {
    btn.innerHTML = `<span class="radar-spinner"></span> Memverifikasi Pembayaran...`;
    btn.disabled = true;
  }

  setTimeout(() => {
    closeCheckoutModal();

    // Populate active order for Live Tracker
    state.activeOrder = {
      invoice: state.currentOrder.invoice,
      amount: state.currentOrder.amount,
      items: state.currentOrder.items,
      customer: { ...state.customer },
      shipping: state.currentOrder.shipping || (SHIPPING_RATES[state.shippingMethod] || SHIPPING_RATES.instant),
      date: state.currentOrder.date,
      statusStep: 0,
      steps: [
        { label: 'Pesanan Diterima Dapur', desc: 'Bahan & resep sedang dipersiapkan', time: 'Baru saja' },
        { label: 'Sedang Dimasak / Diracik', desc: 'Metode slow-cook & garnish presisi', time: 'Estimasi 15 menit' },
        { label: 'Dalam Pengantaran Kurir', desc: 'Driver GoSend Instan menuju alamat Anda', time: 'Estimasi 30 menit' },
        { label: 'Pesanan Selesai Diterima', desc: 'Selamat menikmati sajian Atelier Rasa', time: 'Selesai' }
      ]
    };

    // Save to allOrders for Store Admin Dashboard
    const completedRecord = {
      invoice: state.currentOrder.invoice,
      amount: state.currentOrder.amount,
      items: [...state.currentOrder.items],
      customer: { ...state.customer },
      shipping: state.currentOrder.shipping || (SHIPPING_RATES[state.shippingMethod] || SHIPPING_RATES.instant),
      date: state.currentOrder.date,
      paymentMethod: 'QRIS Dinamis (GoPay Verified)',
      statusStep: 0
    };
    state.allOrders.unshift(completedRecord);

    // Real-time sound chime, haptic vibration, and OS notification
    triggerPaymentAlert(completedRecord);

    // Broadcast to other open tabs / devices
    if (orderBroadcastChannel) {
      try {
        orderBroadcastChannel.postMessage({ type: 'NEW_PAYMENT', order: completedRecord });
      } catch (err) {
        // ignore
      }
    }

    saveStateToStorage();
    updateOrderTrackerDockUI();

    // Populate receipt modal
    const receiptModal = document.getElementById('receipt-modal-backdrop');
    const receiptInvoice = document.getElementById('receipt-invoice');
    const receiptTime = document.getElementById('receipt-time');
    const receiptTotal = document.getElementById('receipt-total');
    const receiptItemsList = document.getElementById('receipt-items-list');
    const receiptCustomerName = document.getElementById('receipt-customer-name');
    const receiptShippingName = document.getElementById('receipt-shipping-name');

    if (state.currentOrder) {
      if (receiptInvoice) receiptInvoice.textContent = state.currentOrder.invoice;
      if (receiptTime) receiptTime.textContent = state.currentOrder.date;
      if (receiptTotal) receiptTotal.textContent = formatIDR(state.currentOrder.amount);
      if (receiptCustomerName) receiptCustomerName.textContent = state.customer.name || 'Pelanggan Umum';
      if (receiptShippingName) {
        const ship = state.currentOrder.shipping || SHIPPING_RATES[state.shippingMethod];
        receiptShippingName.textContent = ship ? ship.name : 'GoSend Instan';
      }
      if (receiptItemsList) {
        receiptItemsList.innerHTML = state.currentOrder.items.map(i => `
          <div class="receipt-slip-row">
            <span>${i.product.name} ${i.note ? `(${i.note})` : ''} (x${i.quantity})</span>
            <span>${formatIDR(i.product.price * i.quantity)}</span>
          </div>
        `).join('');
      }
    }

    if (receiptModal) receiptModal.classList.add('open');

    // Reset Cart
    state.cart = [];
    state.voucherDiscount = 0;
    saveStateToStorage();
    updateCartUI();
    renderCatalog();

    if (btn) {
      btn.innerHTML = `Simulasi Bayar Sekarang (GoPay / QRIS)`;
      btn.disabled = false;
    }
  }, 1400);
}

export function closeReceiptModal() {
  const receiptModal = document.getElementById('receipt-modal-backdrop');
  if (receiptModal) receiptModal.classList.remove('open');
  showToast('Pesanan aktif! Anda dapat melacak progresnya melalui dock bawah.');
}

// ==========================================================================
// WHATSAPP ORDER & RECEIPT SYNC (Feature A)
// ==========================================================================
export function checkoutViaWhatsApp() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  if (totalItems === 0) {
    showToast('Keranjang Anda masih kosong.');
    return;
  }
  sfx.playSuccess();
  updateCustomerInfo();

  const subtotal = state.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const discountAmount = Math.round(subtotal * state.voucherDiscount);
  const ecoPackaging = 2000;
  const currentRate = SHIPPING_RATES[state.shippingMethod] || SHIPPING_RATES.instant;
  const shippingCost = currentRate.price;
  const total = Math.max(0, subtotal - discountAmount + ecoPackaging + shippingCost);
  const invoiceNum = 'INV-WA-' + Date.now().toString().slice(-6);

  let msg = `*PESANAN BARU: ATELIER NUSANTARA*\n`;
  msg += `----------------------------------------\n`;
  msg += `No. Invoice: ${invoiceNum}\n`;
  msg += `Waktu: ${new Date().toLocaleString('id-ID')}\n\n`;
  msg += `*Data Pemesan:*\n`;
  msg += `• Nama: ${state.customer.name || 'Pelanggan Butik'}\n`;
  msg += `• WhatsApp: ${state.customer.phone || '-'}\n`;
  msg += `• Pengiriman: ${currentRate.name} (${currentRate.eta})\n`;
  msg += `• Alamat/Lokasi: ${state.customer.address || 'Ambil di Tempat'}\n\n`;
  msg += `*Rincian Pesanan:*\n`;
  state.cart.forEach(i => {
    msg += `• ${i.product.name} (x${i.quantity}) ${i.note ? `[${i.note}]` : ''}: ${formatIDR(i.product.price * i.quantity)}\n`;
  });
  msg += `\nSubtotal: ${formatIDR(subtotal)}\n`;
  if (discountAmount > 0) msg += `Diskon (${state.activeVoucherCode}): -${formatIDR(discountAmount)}\n`;
  msg += `Kemasan Ramah Lingkungan: ${formatIDR(ecoPackaging)}\n`;
  msg += `Ongkos Kirim: ${formatIDR(shippingCost)}\n`;
  msg += `*TOTAL PEMBAYARAN: ${formatIDR(total)}*\n`;
  msg += `Metode Pembayaran: QRIS Dinamis (GoPay / Semua Bank)\n`;
  msg += `----------------------------------------\n`;
  msg += `Mohon konfirmasi ketersediaan pesanan ini. Terima kasih!`;

  const waNum = state.merchantWhatsApp || '6281234567890';
  const waUrl = `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
  showToast('Menghubungkan ke WhatsApp Toko...');
}

export function sendOrderToWhatsApp() {
  if (!state.currentOrder) return;
  const order = state.currentOrder;
  const currentRate = SHIPPING_RATES[state.shippingMethod] || SHIPPING_RATES.instant;

  let msg = `*SALINAN TAGIHAN QRIS: ATELIER NUSANTARA*\n`;
  msg += `----------------------------------------\n`;
  msg += `No. Invoice: ${order.invoice}\n`;
  msg += `Waktu: ${order.date}\n`;
  msg += `Pemesan: ${state.customer.name || 'Pelanggan Butik'}\n`;
  msg += `Pengiriman: ${currentRate.name}\n\n`;
  msg += `*Item Pesanan:*\n`;
  order.items.forEach(i => {
    msg += `• ${i.product.name} (x${i.quantity}): ${formatIDR(i.product.price * i.quantity)}\n`;
  });
  msg += `\n*TOTAL TAGIHAN: ${formatIDR(order.amount)}*\n`;
  msg += `Status: Menunggu Pembayaran QRIS Dinamis\n`;
  msg += `Data String QRIS EMVCo: ${state.activeQRISPayload || '-'}\n`;

  const waNum = state.merchantWhatsApp || '6281234567890';
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
}

export function shareReceiptWhatsApp() {
  if (!state.activeOrder) return;
  const order = state.activeOrder;
  const currentRate = SHIPPING_RATES[state.shippingMethod] || SHIPPING_RATES.instant;

  let msg = `*STRUK RESMI PEMBAYARAN LUNAS: ATELIER NUSANTARA*\n`;
  msg += `----------------------------------------\n`;
  msg += `No. Invoice: ${order.invoice}\n`;
  msg += `Waktu Bayar: ${order.date}\n`;
  msg += `Status: LUNAS (QRIS Verified)\n`;
  msg += `Pemesan: ${state.customer.name || 'Pelanggan Butik'}\n`;
  msg += `Metode Pengiriman: ${currentRate.name}\n`;
  msg += `Alamat: ${state.customer.address || 'Ambil di Tempat'}\n\n`;
  msg += `*Rincian Pembelian:*\n`;
  order.items.forEach(i => {
    msg += `• ${i.product.name} (x${i.quantity}): ${formatIDR(i.product.price * i.quantity)}\n`;
  });
  msg += `\n*TOTAL DIBAYAR: ${formatIDR(order.amount)}*\n`;
  msg += `----------------------------------------\n`;
  msg += `Terima kasih telah berbelanja di Atelier Nusantara!`;

  const waNum = state.merchantWhatsApp || '6281234567890';
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ==========================================================================
// THERMAL POS RECEIPT PRINTING (Feature C)
// ==========================================================================
export function printThermalReceipt() {
  sfx.playClick();
  window.print();
}

function refreshAdminLiveSyncStamp() {
  const syncEl = document.getElementById('admin-live-sync');
  if (!syncEl) return;

  const now = new Date();
  syncEl.textContent = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function setupSecretAdminAccess() {
  const shouldOpenAdmin = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === '1' || params.get('mode') === 'admin' || window.location.hash === '#admin' || window.location.hash === '#secure-admin';
  };

  const handleAdminShortcut = (event) => {
    const isShortcut = (event.shiftKey && (event.altKey || event.ctrlKey || event.metaKey)) && typeof event.key === 'string' && event.key.toLowerCase() === 'a';

    if (!isShortcut) return;

    event.preventDefault();
    if (state.adminAuthenticated) {
      openAdminDashboardModal();
    } else {
      openAdminLoginModal();
    }
  };

  document.addEventListener('keydown', handleAdminShortcut);
  if (shouldOpenAdmin()) {
    openAdminLoginModal();
  }
}

export function openAdminLoginModal() {
  const modal = document.getElementById('admin-login-modal-backdrop');
  const username = document.getElementById('admin-login-username');
  const password = document.getElementById('admin-login-password');

  if (username) username.value = '';
  if (password) password.value = '';

  if (modal) modal.classList.add('open');
}

export function closeAdminLoginModal() {
  const modal = document.getElementById('admin-login-modal-backdrop');
  if (modal) modal.classList.remove('open');
}

export function submitAdminLogin(event) {
  if (event && event.preventDefault) event.preventDefault();

  const usernameEl = document.getElementById('admin-login-username');
  const passwordEl = document.getElementById('admin-login-password');
  const username = (usernameEl && usernameEl.value || '').trim();
  const password = (passwordEl && passwordEl.value || '').trim();

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    state.adminAuthenticated = true;
    saveStateToStorage();
    closeAdminLoginModal();
    openAdminDashboardModal();
    showToast('Akses admin aktif. Dashboard toko terbuka.');
    return;
  }

  showToast('Username atau password admin tidak valid.');
}

export function logoutAdminSession() {
  state.adminAuthenticated = false;
  saveStateToStorage();
  closeAdminDashboardModal();
  openAdminLoginModal();
  showToast('Sesi admin ditutup.');
}

// ==========================================================================
// STORE ADMIN DASHBOARD (Feature E)
// ==========================================================================
function renderAdminOrderTable() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;
  if (state.allOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color: var(--ink-tertiary);">Belum ada riwayat pesanan tercatat.</td></tr>`;
    return;
  }

  const statusClasses = ['step-0', 'step-1', 'step-2', 'step-3'];
  const statusLabels = ['Diterima Dapur', 'Sedang Dimasak', 'Dalam Kurir', 'Selesai'];
  tbody.innerHTML = state.allOrders.map(order => {
    const step = order.statusStep || 0;
    const itemsSummary = (order.items || []).map(i => `${i.product ? i.product.name : 'Produk'} (x${i.quantity})`).join(', ');
    return `
      <tr class="admin-order-row" data-admin-row="${order.invoice}">
        <td><strong style="font-family: var(--font-mono);">${order.invoice}</strong></td>
        <td style="white-space: nowrap; font-size: 0.74rem;">${order.date}</td>
        <td><strong>${(order.customer && order.customer.name) || 'Pelanggan'}</strong><br><span style="font-size:0.7rem; color:var(--ink-tertiary);">${(order.customer && order.customer.phone) || '-'}</span></td>
        <td style="max-width: 220px; font-size: 0.76rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsSummary}">${itemsSummary}</td>
        <td style="font-size: 0.74rem;">${order.paymentMethod || 'QRIS Dinamis'}</td>
        <td style="font-weight: 700; font-family: var(--font-mono); color: var(--brand-forest);">${formatIDR(order.amount)}</td>
        <td><span class="status-badge-step ${statusClasses[step] || 'step-0'}">${statusLabels[step] || 'Diterima'}</span></td>
        <td><button class="btn-admin-action" onclick="window.adminAdvanceOrderStatus('${order.invoice}')" title="Majukan ke tahap selanjutnya">${step < 3 ? 'Majukan ➡️' : 'Arsipkan'}</button></td>
      </tr>
    `;
  }).join('');
}

export function openAdminDashboardModal() {
  if (!state.adminAuthenticated) {
    openAdminLoginModal();
    return;
  }

  sfx.playClick();
  ensureAdminRealtimeChannel();
  const modal = document.getElementById('admin-dashboard-modal-backdrop');
  const omzetEl = document.getElementById('admin-metric-omzet');
  const ordersEl = document.getElementById('admin-metric-orders');
  const aovEl = document.getElementById('admin-metric-aov');
  const settledEl = document.getElementById('admin-metric-settled');
  const tbody = document.getElementById('admin-orders-tbody');
  const countEl = document.getElementById('admin-orders-count');
  const phoneInput = document.getElementById('admin-merchant-phone');

  if (phoneInput) phoneInput.value = state.merchantWhatsApp;

  const totalOmzet = state.allOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const totalOrders = state.allOrders.length;
  const aov = totalOrders > 0 ? Math.round(totalOmzet / totalOrders) : 0;

  if (omzetEl) omzetEl.textContent = formatIDR(totalOmzet);
  if (ordersEl) ordersEl.textContent = totalOrders;
  if (aovEl) aovEl.textContent = formatIDR(aov);
  if (settledEl) settledEl.textContent = totalOrders;
  if (countEl) countEl.textContent = `${totalOrders} pesanan tercatat`;

  renderAdminOrderTable();

  if (modal) {
    updateNotificationPermissionStatus();
    refreshAdminLiveSyncStamp();
    renderAdminProductsTable();
    modal.classList.add('open');
    switchAdminSection('overview');
    refreshAdminWorkspace({ reason: 'open' });
    animateAdminWorkspaceEntrance();
  }

}

export function closeAdminDashboardModal() {
  const modal = document.getElementById('admin-dashboard-modal-backdrop');
  if (modal) modal.classList.remove('open');
}

export function saveAdminMerchantPhone() {
  const input = document.getElementById('admin-merchant-phone');
  if (input) {
    state.merchantWhatsApp = input.value.trim().replace(/[^0-9]/g, '');
    saveStateToStorage();
    publishAdminChange('store');
    showToast(`Nomor WA Toko berhasil diperbarui ke: ${state.merchantWhatsApp}`);
  }
}

export function saveAdminStorefrontSetting(key) {
  if (key !== 'merchantWhatsApp') return;
  const input = document.getElementById('admin-storefront-whatsapp');
  const value = input ? input.value.trim().replace(/[^0-9]/g, '') : '';
  if (!/^62\d{8,15}$/.test(value)) {
    showToast('Nomor WhatsApp harus memakai format 62812...');
    return;
  }

  state.merchantWhatsApp = value;
  saveStateToStorage();
  publishAdminChange('store');
  showToast('Kontak WhatsApp storefront berhasil diperbarui.');
}

export function adminAdvanceOrderStatus(invoice) {
  const target = state.allOrders.find(o => o.invoice === invoice);
  if (!target) return;
  sfx.playClick();

  if (typeof target.statusStep === 'undefined') target.statusStep = 0;
  if (target.statusStep < 3) {
    target.statusStep++;
  } else {
    state.allOrders = state.allOrders.filter(o => o.invoice !== invoice);
  }

  saveStateToStorage();
  publishAdminChange('orders', { invoice });
  openAdminDashboardModal();
  showToast(`Status pesanan ${invoice} diperbarui.`);
}

export function exportOrdersCSV() {
  if (state.allOrders.length === 0) {
    showToast('Belum ada data pesanan untuk diekspor.');
    return;
  }
  sfx.playSuccess();

  let csv = 'Invoice,Tanggal,Nama Pemesan,Nomor WA,Alamat,Pengiriman,Total Tagihan,Metode Bayar,Status\n';
  state.allOrders.forEach(o => {
    const custName = (o.customer && o.customer.name) || 'Pelanggan Umum';
    const custPhone = (o.customer && o.customer.phone) || '-';
    const custAddr = (o.customer && o.customer.address) || '-';
    const shipName = (o.shipping && o.shipping.name) || 'GoSend';
    const statusLabels = ['Diterima Dapur', 'Sedang Dimasak', 'Dalam Kurir', 'Selesai'];
    const status = statusLabels[o.statusStep || 0] || 'Diterima';

    csv += `"${o.invoice}","${o.date}","${custName}","${custPhone}","${custAddr}","${shipName}",${o.amount},"${o.paymentMethod || 'QRIS Dinamis'}","${status}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `pesanan_atelier_rasa_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('File CSV berhasil diunduh.');
}

// ==========================================================================
// FEATURE 2: STORE ADMIN PRODUCT CATALOG MANAGEMENT (CRUD)
// ==========================================================================
const ADMIN_SECTIONS = ['overview', 'orders', 'catalog', 'storefront', 'payments', 'tools'];

export function switchAdminSection(sectionName) {
  const section = ADMIN_SECTIONS.includes(sectionName) ? sectionName : 'overview';
  const sections = document.querySelectorAll('.admin-section-view');
  const navItems = document.querySelectorAll('[data-admin-section]');

  sections.forEach((view) => {
    view.hidden = view.id !== `admin-section-${section}`;
  });
  navItems.forEach((item) => {
    const isActive = item.dataset.adminSection === section;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  if (section === 'orders') {
    switchAdminTab('orders');
  } else if (section === 'catalog') {
    switchAdminTab('products');
  }

  refreshAdminWorkspace({ reason: 'section' });
}

export function switchAdminTab(tabName) {
  sfx.playClick();
  const btnOrders = document.getElementById('btn-admin-tab-orders');
  const btnProducts = document.getElementById('btn-admin-tab-products');
  const viewOrders = document.getElementById('admin-view-orders');
  const viewProducts = document.getElementById('admin-view-products');

  if (tabName === 'products') {
    if (btnOrders) btnOrders.classList.remove('active');
    if (btnProducts) btnProducts.classList.add('active');
    if (viewOrders) viewOrders.style.display = 'none';
    if (viewProducts) viewProducts.style.display = 'block';
    renderAdminProductsTable();
  } else {
    if (btnProducts) btnProducts.classList.remove('active');
    if (btnOrders) btnOrders.classList.add('active');
    if (viewProducts) viewProducts.style.display = 'none';
    if (viewOrders) viewOrders.style.display = 'block';
  }
  refreshAdminWorkspace({ reason: 'tab' });
}

export function toggleAddProductForm(forceOpen) {
  sfx.playClick();
  const formBox = document.getElementById('admin-product-form-box');
  if (!formBox) return;
  if (typeof forceOpen === 'boolean') {
    formBox.style.display = forceOpen ? 'flex' : 'none';
    if (!forceOpen) {
      state.activeProductEditId = '';
      const submitLabel = document.getElementById('admin-product-submit-label');
      if (submitLabel) submitLabel.textContent = 'Simpan Produk';
    }
  } else {
    formBox.style.display = formBox.style.display === 'none' ? 'flex' : 'none';
  }
}

export function openProductEditForm(productId) {
  const product = getActiveProducts().find((item) => item.id === productId);
  if (!product) return;

  state.activeProductEditId = productId;
  toggleAddProductForm(true);
  const fields = {
    'new-prod-name': product.name,
    'new-prod-category': product.category,
    'new-prod-price': product.price,
    'new-prod-tag': product.tags && product.tags[0] ? product.tags[0] : '',
    'new-prod-image': product.image,
    'new-prod-desc': product.desc
  };
  Object.entries(fields).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value || '';
  });
  const submitLabel = document.getElementById('admin-product-submit-label');
  if (submitLabel) submitLabel.textContent = 'Simpan Perubahan';
}

export function submitNewProduct(e) {
  if (e && e.preventDefault) e.preventDefault();
  sfx.playClick();

  const nameInput = document.getElementById('new-prod-name');
  const catSelect = document.getElementById('new-prod-category');
  const priceInput = document.getElementById('new-prod-price');
  const tagInput = document.getElementById('new-prod-tag');
  const imgInput = document.getElementById('new-prod-image');
  const descInput = document.getElementById('new-prod-desc');

  const name = nameInput ? nameInput.value.trim() : '';
  const category = catSelect ? catSelect.value : 'makanan';
  const price = priceInput ? Number(priceInput.value) : 0;
  const tag = tagInput ? tagInput.value.trim() : 'Menu Baru';
  let image = imgInput ? imgInput.value.trim() : '';
  const desc = descInput ? descInput.value.trim() : 'Produk berkualitas dari toko kami.';

  if (!name || price <= 0) {
    showToast('Mohon lengkapi nama produk dan harga yang sah.');
    return;
  }

  if (!image) {
    const fallbackImages = {
      makanan: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=700&q=80',
      minuman: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=700&q=80',
      barang: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=700&q=80',
      fashion: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=700&q=80',
      gadget: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80',
      digital: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=700&q=80'
    };
    image = fallbackImages[category] || fallbackImages.makanan;
  }

  if (!state.productsList || state.productsList.length === 0) {
    state.productsList = PRODUCTS.map(p => ({ ...p, isAvailable: true }));
  }

  const editingProduct = state.activeProductEditId
    ? state.productsList.find((product) => product.id === state.activeProductEditId)
    : null;
  if (editingProduct) {
    Object.assign(editingProduct, { name, category, price, tags: tag ? [tag] : ['Baru'], desc, image });
  } else {
    state.productsList.unshift({
      id: `prod-custom-${Date.now()}`,
      name,
      category,
      price,
      tags: tag ? [tag] : ['Baru'],
      desc,
      story: desc,
      image,
      origin: 'Koleksi Toko',
      calories: 'Pilihan Spesial',
      isAvailable: true,
      variants: {
        title: 'Pilihan Pesanan',
        options: ['Standar Pilihan']
      }
    });
  }
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_PRODUCTS, JSON.stringify(state.productsList));
  } catch (err) {
    console.warn('Gagal simpan produk:', err);
  }

  // Reset form
  if (nameInput) nameInput.value = '';
  if (priceInput) priceInput.value = '';
  if (tagInput) tagInput.value = '';
  if (imgInput) imgInput.value = '';
  if (descInput) descInput.value = '';
  toggleAddProductForm(false);

  sfx.playSuccess();
  publishAdminChange('products');
  renderAdminProductsTable();
  renderCatalog();
  showToast(editingProduct ? `Produk "${name}" berhasil diperbarui.` : `Produk "${name}" berhasil ditambahkan ke katalog!`);
}

export function toggleProductAvailability(productId) {
  sfx.playClick();
  const product = (state.productsList || []).find(p => p.id === productId);
  if (!product) return;

  product.isAvailable = product.isAvailable === false ? true : false;
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_PRODUCTS, JSON.stringify(state.productsList));
  } catch (err) {
    console.warn('Gagal simpan stok produk:', err);
  }

  renderAdminProductsTable();
  publishAdminChange('products');
  renderCatalog();
  showToast(`Status "${product.name}": ${product.isAvailable ? 'Tersedia' : 'Habis (Sold Out)'}`);
}

export function deleteProduct(productId) {
  sfx.playClick();
  const product = (state.productsList || []).find(p => p.id === productId);
  if (!product) return;

  if (!window.confirm(`Hapus produk "${product.name}" dari katalog?`)) return;

  state.productsList = state.productsList.filter(p => p.id !== productId);
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_PRODUCTS, JSON.stringify(state.productsList));
  } catch (err) {
    console.warn('Gagal hapus produk:', err);
  }

  renderAdminProductsTable();
  publishAdminChange('products');
  renderCatalog();
  showToast(`Produk "${product.name}" telah dihapus.`);
}

export function resetProductsToDefault() {
  sfx.playClick();
  if (!window.confirm('Pulihkan seluruh katalog ke daftar produk default awal?')) return;

  state.productsList = PRODUCTS.map(p => ({ ...p, isAvailable: true }));
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_PRODUCTS, JSON.stringify(state.productsList));
  } catch (err) {
    console.warn('Gagal reset produk:', err);
  }

  renderAdminProductsTable();
  publishAdminChange('products');
  renderCatalog();
  showToast('Katalog produk berhasil di-reset ke default.');
}

export function renderAdminProductsTable() {
  const tbody = document.getElementById('admin-products-tbody');
  const countBadge = document.getElementById('admin-product-count-badge');
  const products = getActiveProducts();

  if (countBadge) countBadge.textContent = products.length;
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--ink-tertiary);">Belum ada produk di katalog. Klik "+ Tambah Produk Baru" di atas.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const isAvailable = p.isAvailable !== false;
    const statusClass = isAvailable ? 'available' : 'soldout';
    const statusText = isAvailable ? '✓ Tersedia (Ready)' : '✕ Habis (Sold Out)';

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${p.image}" alt="${p.name}" style="width: 42px; height: 42px; border-radius: 6px; object-fit: cover; flex-shrink: 0;" />
            <div>
              <strong style="font-size: 0.85rem; color: var(--ink-primary); display: block;">${p.name}</strong>
              <span style="font-size: 0.72rem; color: var(--ink-tertiary);">${p.tags && p.tags[0] ? p.tags[0] : 'Standar'}</span>
            </div>
          </div>
        </td>
        <td><span class="badge-pill badge-category" data-cat="${p.category}" style="font-size: 0.72rem;">${getCategoryLabel(p.category)}</span></td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: var(--brand-forest);">${formatIDR(p.price)}</td>
        <td>
          <button type="button" class="product-status-pill ${statusClass}" onclick="window.toggleProductAvailability('${p.id}')" title="Klik untuk mengubah status ketersediaan">
            ${statusText}
          </button>
        </td>
        <td>
          <div class="admin-row-actions">
            <button type="button" class="btn-admin-action" onclick="window.openProductEditForm('${p.id}')" title="Edit produk ini">Edit</button>
            <button type="button" class="btn-admin-action" onclick="window.deleteProduct('${p.id}')" style="color: #DC2626; border-color: #FECACA;" title="Hapus produk ini">
              Hapus
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================================================
// LIVE ORDER TRACKER
// ==========================================================================
function updateOrderTrackerDockUI() {
  const dock = document.getElementById('order-tracker-dock');
  const textEl = document.getElementById('tracker-dock-text');
  const statusEl = document.getElementById('tracker-dock-status');

  if (!dock) return;

  if (state.activeOrder) {
    dock.style.display = 'flex';
    const currentStep = state.activeOrder.steps[state.activeOrder.statusStep];
    if (textEl) textEl.textContent = `Pesanan Aktif: ${state.activeOrder.invoice}`;
    if (statusEl) statusEl.textContent = `• ${currentStep.label}`;
  } else {
    dock.style.display = 'none';
  }
}

export function openOrderTrackerModal() {
  if (!state.activeOrder) return;
  sfx.playClick();

  const modal = document.getElementById('order-tracker-modal-backdrop');
  const invoiceEl = document.getElementById('tracker-invoice');
  const timelineEl = document.getElementById('tracker-timeline');

  if (invoiceEl) invoiceEl.textContent = state.activeOrder.invoice;

  if (timelineEl) {
    timelineEl.innerHTML = state.activeOrder.steps.map((st, idx) => {
      let statusClass = '';
      if (idx < state.activeOrder.statusStep) statusClass = 'done';
      else if (idx === state.activeOrder.statusStep) statusClass = 'active';

      return `
        <div class="timeline-step ${statusClass}">
          <div class="timeline-dot"></div>
          <div class="timeline-info">
            <h4>${st.label}</h4>
            <p>${st.desc} · <em>${st.time}</em></p>
          </div>
        </div>
      `;
    }).join('');
  }

  if (modal) modal.classList.add('open');
}

export function closeOrderTrackerModal() {
  const modal = document.getElementById('order-tracker-modal-backdrop');
  if (modal) modal.classList.remove('open');
}

export function advanceOrderStatus() {
  if (!state.activeOrder) return;
  sfx.playClick();
  if (state.activeOrder.statusStep < state.activeOrder.steps.length - 1) {
    state.activeOrder.statusStep++;
    saveStateToStorage();
    openOrderTrackerModal();
    updateOrderTrackerDockUI();
    showToast(`Status diperbarui: ${state.activeOrder.steps[state.activeOrder.statusStep].label}`);
  } else {
    showToast('Pesanan telah selesai diantar!');
  }
}

export function clearActiveOrder() {
  state.activeOrder = null;
  saveStateToStorage();
  closeOrderTrackerModal();
  updateOrderTrackerDockUI();
  showToast('Pesanan selesai diarsipkan.');
}

// ==========================================================================
// MERCHANT QRIS CONFIGURATION MODAL
// ==========================================================================
export function openMerchantConfigModal() {
  sfx.playClick();
  const modal = document.getElementById('merchant-config-modal-backdrop');
  const textarea = document.getElementById('merchant-raw-qris-input');
  const radioDefault = document.getElementById('mode-qris-default');
  const radioCustom = document.getElementById('mode-qris-custom');

  if (textarea) textarea.value = state.customStaticQRIS;
  if (state.merchantQRISMode === 'custom' && radioCustom) {
    radioCustom.checked = true;
  } else if (radioDefault) {
    radioDefault.checked = true;
  }

  if (modal) modal.classList.add('open');
}

export function closeMerchantConfigModal() {
  const modal = document.getElementById('merchant-config-modal-backdrop');
  if (modal) modal.classList.remove('open');
}

export function saveMerchantQRISConfig() {
  const textarea = document.getElementById('merchant-raw-qris-input');
  const radioCustom = document.getElementById('mode-qris-custom');

  const mode = radioCustom && radioCustom.checked ? 'custom' : 'default';
  const rawString = textarea ? textarea.value.trim() : '';

  if (mode === 'custom') {
    if (!rawString || rawString.length < 30) {
      showToast('String QRIS statis terlalu pendek atau tidak valid.');
      return;
    }
    try {
      const parsed = parseEMVCoQRIS(rawString);
      if (!parsed['00'] || !parsed['58']) {
        throw new Error('Header EMVCo tidak lengkap.');
      }
      showToast(`QRIS Merchant ${parsed['59'] || 'Aktif'} berhasil disimpan!`);
    } catch (e) {
      showToast('Gagal memvalidasi QRIS: ' + e.message);
      return;
    }
  } else {
    showToast('Mode QRIS Demo Default diaktifkan.');
  }

  state.merchantQRISMode = mode;
  state.customStaticQRIS = rawString;
  saveStateToStorage();
  publishAdminChange('store');
  closeMerchantConfigModal();
}

// ==========================================================================
// CART DRAWER TOGGLE
// ==========================================================================
export function openCartDrawer() {
  sfx.playClick();
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if (drawer) drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
}

export function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

// ==========================================================================
// EVENT LISTENERS & INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromStorage();
  renderCatalog();
  updateCartUI();

  // Expose global window hooks
  window.addToCart = addToCart;
  window.updateQuantity = updateQuantity;
  window.promptNote = promptNote;
  window.openCartDrawer = openCartDrawer;
  window.closeCartDrawer = closeCartDrawer;
  window.openCheckoutModal = openCheckoutModal;
  window.closeCheckoutModal = closeCheckoutModal;
  window.applyVoucher = applyVoucher;
  window.simulatePaymentSuccess = simulatePaymentSuccess;
  window.closeReceiptModal = closeReceiptModal;
  window.openQuickView = openQuickView;
  window.closeQuickView = closeQuickView;
  window.selectVariantOption = selectVariantOption;
  window.addQuickViewToCart = addQuickViewToCart;
  window.openOrderTrackerModal = openOrderTrackerModal;
  window.closeOrderTrackerModal = closeOrderTrackerModal;
  window.advanceOrderStatus = advanceOrderStatus;
  window.clearActiveOrder = clearActiveOrder;
  window.openMerchantConfigModal = openMerchantConfigModal;
  window.closeMerchantConfigModal = closeMerchantConfigModal;
  window.saveMerchantQRISConfig = saveMerchantQRISConfig;
  window.switchQRISDisplayMode = switchQRISDisplayMode;
  window.copyQRISPayload = copyQRISPayload;
  window.downloadQRISImage = downloadQRISImage;
  window.focusMobileSearch = focusMobileSearch;
  window.switchMobileTab = switchMobileTab;
  window.selectShippingMethod = selectShippingMethod;
  window.updateCustomerInfo = updateCustomerInfo;
  window.checkoutViaWhatsApp = checkoutViaWhatsApp;
  window.sendOrderToWhatsApp = sendOrderToWhatsApp;
  window.shareReceiptWhatsApp = shareReceiptWhatsApp;
  window.printThermalReceipt = printThermalReceipt;
  window.openAdminDashboardModal = openAdminDashboardModal;
  window.closeAdminDashboardModal = closeAdminDashboardModal;
  window.saveAdminMerchantPhone = saveAdminMerchantPhone;
  window.adminAdvanceOrderStatus = adminAdvanceOrderStatus;
  window.exportOrdersCSV = exportOrdersCSV;
  window.switchAdminSection = switchAdminSection;
  window.openAdminLoginModal = openAdminLoginModal;
  window.closeAdminLoginModal = closeAdminLoginModal;
  window.submitAdminLogin = submitAdminLogin;
  window.logoutAdminSession = logoutAdminSession;
  window.saveAdminStorefrontSetting = saveAdminStorefrontSetting;
  window.requestNotificationPermission = requestNotificationPermission;
  window.testNotificationSound = testNotificationSound;
  window.updateNotificationPermissionStatus = updateNotificationPermissionStatus;
  window.switchAdminTab = switchAdminTab;
  window.toggleAddProductForm = toggleAddProductForm;
  window.openProductEditForm = openProductEditForm;
  window.submitNewProduct = submitNewProduct;
  window.toggleProductAvailability = toggleProductAvailability;
  window.deleteProduct = deleteProduct;
  window.resetProductsToDefault = resetProductsToDefault;
  window.renderAdminProductsTable = renderAdminProductsTable;
  window.createAdminRealtimeChannel = createAdminRealtimeChannel;
  window.publishAdminChange = publishAdminChange;
  window.refreshAdminWorkspace = refreshAdminWorkspace;

  setupSecretAdminAccess();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('PWA ServiceWorker registration error:', err);
      });
    });
  }

  // Category Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeCategory = btn.dataset.category;
      sfx.playClick();
      renderCatalog();
    });
  });

  // Search Input
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      if (searchClear) searchClear.style.display = state.searchQuery ? 'block' : 'none';
      renderCatalog();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      state.searchQuery = '';
      searchClear.style.display = 'none';
      renderCatalog();
    });
  }

  // Sort Dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderCatalog();
    });
  }

  // Audio Toggle Button
  const audioBtn = document.getElementById('audio-toggle-btn');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      state.audioEnabled = !state.audioEnabled;
      audioBtn.innerHTML = state.audioEnabled
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
      showToast(state.audioEnabled ? 'Efek audio diaktifkan' : 'Efek audio dinonaktifkan');
    });
  }

  // Payment Tabs inside checkout modal
  document.querySelectorAll('.pay-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.target;
      sfx.playClick();

      document.querySelectorAll('.payment-view').forEach(view => {
        view.style.display = (view.id === target) ? 'block' : 'none';
      });
    });
  });

  // Copy buttons
  document.querySelectorAll('.btn-copy-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const textToCopy = btn.dataset.copy;
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast('Teks berhasil disalin ke clipboard');
        });
      }
    });
  });

  // Keyboard accessibility
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCartDrawer();
      closeCheckoutModal();
      closeReceiptModal();
      closeQuickView();
      closeOrderTrackerModal();
      closeMerchantConfigModal();
      closeAdminLoginModal();
      closeAdminDashboardModal();
    }
  });
});

// ==========================================================================
// GSAP ANIMATIONS & INTERACTIVE CHOREOGRAPHY (UI UX Pro Max & Scroll-Craft)
// ==========================================================================
export function initGSAPAnimations() {
  if (typeof window.gsap === 'undefined') return;

  const gsap = window.gsap;
  if (typeof window.ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(window.ScrollTrigger);
  }

  if (window.__atelierMotionContext) {
    window.__atelierMotionContext.revert();
    window.__atelierMotionContext = null;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const ctx = gsap.context(() => {
    gsap.from('.site-header', { y: -24, opacity: 0, duration: 0.9, ease: 'power2.out' });
    gsap.from('.nav-links .nav-link', { y: -10, opacity: 0, duration: 0.5, stagger: 0.08, delay: 0.18, ease: 'power2.out' });

    const heroTL = gsap.timeline({ defaults: { ease: 'power3.out' } });
    heroTL.from('.hero-headline', { y: 32, duration: 0.9 })
      .from('.hero-description', { y: 20, duration: 0.7 }, '-=0.2')
      .from('.hero-actions .btn-primary, .hero-actions .btn-secondary', { y: 12, stagger: 0.12, duration: 0.6 }, '-=0.24')
      .from('.showcase-card', { y: 52, duration: 1.1, ease: 'back.out(1.3)' }, '-=0.28');

    gsap.timeline({
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 1.2,
        invalidateOnRefresh: true
      }
    })
      .to('.hero-editorial', { y: -20, ease: 'none' }, 0)
      .to('.showcase-card', { y: -34, rotateX: 5, rotateY: 4, ease: 'none' }, 0);

    const revealTargets = gsap.utils.toArray('.reveal-section, .story-copy, .story-visual, .story-metrics > div, .floating-card, .ritual-badge, .toolbar-wrapper, .product-card, .order-tracker-dock');
    revealTargets.forEach((el, index) => {
      gsap.fromTo(el, {
        y: 40,
        opacity: 0,
        filter: 'blur(8px)',
        scale: el.classList.contains('product-card') ? 0.97 : 1
      }, {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        scale: 1,
        duration: 0.9,
        delay: index * 0.03,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 84%',
          end: 'bottom 20%',
          once: true,
          toggleActions: 'play none none none'
        }
      });
    });

    gsap.from('.story-metrics > div', { y: 22, opacity: 0, duration: 0.7, stagger: 0.12, ease: 'power2.out', scrollTrigger: { trigger: '.story-metrics', start: 'top 78%', once: false, toggleActions: 'play none reverse none' } });
    gsap.from('.floating-card.card-main', { y: 28, opacity: 0, rotate: -8, duration: 1.1, ease: 'power2.out', scrollTrigger: { trigger: '.luxury-story', start: 'top 70%', once: false, toggleActions: 'play none reverse none' } });
    gsap.from('.floating-card.card-accent', { y: 30, opacity: 0, rotate: 8, duration: 1.1, delay: 0.12, ease: 'power2.out', scrollTrigger: { trigger: '.luxury-story', start: 'top 70%', once: false, toggleActions: 'play none reverse none' } });

    gsap.from('.final-cta .cta-shell', { y: 40, opacity: 0, duration: 1.0, ease: 'power2.out', scrollTrigger: { trigger: '.final-cta', start: 'top 82%', once: true, toggleActions: 'play none none none' } });

    const hoverButtons = document.querySelectorAll('.btn-primary, .btn-secondary, .showcase-btn, .btn-add, .btn-checkout, .btn-add-cart, .btn-quick-view');
    hoverButtons.forEach((btn) => {
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.22, ease: 'power2.out' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.22, ease: 'power2.out' });
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.18;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.18;
        xTo(x);
        yTo(y);
      });
      btn.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
    });

    const heroVisual = document.querySelector('.hero-visual');
    const showcaseCard = document.querySelector('.showcase-card');
    if (heroVisual && showcaseCard) {
      heroVisual.style.perspective = '1200px';
      const rotX = gsap.quickTo(showcaseCard, 'rotationX', { duration: 0.35, ease: 'power2.out' });
      const rotY = gsap.quickTo(showcaseCard, 'rotationY', { duration: 0.35, ease: 'power2.out' });
      const moveY = gsap.quickTo(showcaseCard, 'y', { duration: 0.35, ease: 'power2.out' });
      heroVisual.addEventListener('mousemove', (e) => {
        const rect = heroVisual.getBoundingClientRect();
        const xRatio = (e.clientX - rect.left) / rect.width - 0.5;
        const yRatio = (e.clientY - rect.top) / rect.height - 0.5;
        rotX(-yRatio * 14);
        rotY(xRatio * 16);
        moveY(-10 + yRatio * 8);
      });
      heroVisual.addEventListener('mouseleave', () => { rotX(0); rotY(0); moveY(0); });
    }

    gsap.utils.toArray('.tab-btn').forEach((tab) => {
      tab.addEventListener('mouseenter', () => gsap.to(tab, { y: -2, duration: 0.18, ease: 'power2.out' }));
      tab.addEventListener('mouseleave', () => gsap.to(tab, { y: 0, duration: 0.18, ease: 'power2.out' }));
    });
  }, document.body);

  window.__atelierMotionContext = ctx;
  if (typeof window.ScrollTrigger !== 'undefined') {
    window.ScrollTrigger.refresh();
  }
}
