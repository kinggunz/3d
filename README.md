# Petualangan Santay — by Gunz Developer

Game survival 3D (Three.js) -> APK via Capacitor + GitHub Actions.

## Build APK
1. Upload semua isi folder ini ke repo GitHub (branch `main`).
2. Tab **Actions** -> "Build APK Petualangan Santay" (jalan otomatis saat push / *Run workflow*).
3. Unduh `PetualanganSantay.apk` dari **Artifacts** atau **Releases**.

## Fitur
- **Buat Dunia**: buat banyak dunia sendiri (beri nama → Play), tersimpan otomatis per dunia. Dunia yang dimainkan otomatis terbuka di daftar Room Global (ikon 🌍) sehingga pemain lain bisa masuk (bisa dimatikan di layar Dunia Saya). Online: Open World (ketemu pemain lain otomatis), daftar room global (klik langsung masuk), room private (nama+password).
- Online memakai broker MQTT publik (butuh internet), tanpa server sendiri.
- Musik & efek suara dibuat prosedural (tanpa file audio). Atur di Pengaturan.

## Kontrol
Joystick kiri = jalan, geser layar = lihat, ✊ = tebang/serang (tahan), ⤴ = lompat, 🏗️ = bangun, 🍖 = makan, 🎒 = tas (buat kapak/tombak).
PC: WASD, spasi, klik, B bangun, R putar, E aksi, F makan, I tas.

## Pembaruan v2

- **Mabar**: tombol 🎤 (voice chat WebRTC) & 💬 (chat teks); tidur bersama di 🛏️ (malam dilewati bila semua pemain tidur), pemain tidak saling menembus.
- **Costume HUD**: Jeda → 🎛️ Atur HUD. Seret tombol, atur ukuran & transparansi (tersimpan).
- **Grafik**: Smooth (resolusi dinamis, geometri ringan, culling) / Standar / Ultra.
- **Gerak**: jongkok 🧎, lompat dengan coyote-time & buffer, tabrakan kepala (tidak tembus langit-langit).
- **Alat**: Kapak, Beliung, Sekop, Pedang (batu/besi), Pancing, Ember, Panci, Obor, Lampu; hotbar alat.
- **Dunia**: goa/tambang (bijih besi, batu bara), Tungku (lebur besi), Kompor (sup), Gerobak (bawa barang), Pintu buka-tutup.
- **Laut**: Dermaga, Kapal rakitan sendiri (lantai/dinding di air) + Mesin + Setir.
- **Buku Panduan** (menu utama & menu jeda), panah goa selalu tampil, ±10 goa, ikon tombol digambar dengan canvas.

## Map berupa file (update lewat ZArchiver)
Semua map ada di `public/maps/` (di APK: `assets/public/maps/`).
- `index.json` : daftar file map yang tampil di Room Global.
- `war.json` : PETUALANGAN WAR (jumlah bot, damage, hadiah, nama & kalimat chat bot).
- `drig.json`, `drig-pelabuhan.json` : kota balap motor (seed kota, tinggi gedung, jarak pohon, warna, gaya fasad, jam siang, kecepatan).
Tambah map baru: salin salah satu file `.json`, ubah `id`, `name`, `shard`, `seed`, isi parameter, lalu tulis namanya di `index.json`.
Lewat ZArchiver: buka APK, masuk `assets/public/maps/`, ganti/tambah file, simpan, lalu tanda tangani ulang & pasang APK.

## v15 — perubahan
- **Animasi karakter baru** (`chars.js → poseChar`): diam, jalan, lari, **jongkok sungguhan** (pinggul turun, lutut menekuk, badan condong — tidak lagi mengecil), lompat/jatuh/mendarat, renang, **serang berbeda tiap alat** (tinju, kapak/beliung, pedang, tombak, sekop, pancing, ember), **mati** (terhuyung lalu jatuh), duduk, panik. Dipakai untuk pemain sendiri (orang ketiga) dan semua pemain lain (data `rn/j/sw/d/eq` + pesan `at`). Alat yang dipegang tampak di tangan karakter (`held.js`).
- **Goa tanpa portal** (`mine.js → makeCave`): mulut goa berupa lubang batu di lereng, terowongan masuk ke bukit (mesh daratan benar-benar dilubangi), lalu tersambung mulus ke tambang bawah tanah. Tidak ada pintu/teleport/layar loading; hanya kedipan singkat di kegelapan terowongan.
- **Gali tanah berlubang** (`world.js → digTerrain`): sekop menurunkan tinggi daratan membentuk lubang (maks ±3,4 m), warna tanah berubah cokelat, tersimpan di save dan disinkronkan ke pemain lain (`dg`).
- **Adegan pembuka pesawat** (`intro.js`, `plane.js`, `introsound.js`): semua dunia (solo & Mabar) kecuali War dan Drig di Room Global. Pesawat detail realistis, kabin dengan penumpang sesuai jumlah pemain + kopilot & kapten, dialog bersubtitle, suara mesin/hujan/petir/ledakan/alarm, petir menyambar mesin kiri → "BAM!!!" → jatuh ke pulau → layar gelap → bangun di rumput → bangkai pesawat terbakar lalu meredup. Tombol "Lewati" tersedia.
