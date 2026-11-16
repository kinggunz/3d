# Petualangan Santay — by Gunz Developer

Game survival 3D (Three.js) -> APK via Capacitor + GitHub Actions.

## Build APK
1. Upload semua isi folder ini ke repo GitHub (branch `main`).
2. Tab **Actions** -> "Build APK Petualangan Santay" (jalan otomatis saat push / *Run workflow*).
3. Unduh `PetualanganSantay.apk` dari **Artifacts** atau **Releases**.

## Fitur
- Offline: dunia tersimpan otomatis. Online: Open World (ketemu pemain lain otomatis), daftar room global (klik langsung masuk), room private (nama+password).
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
