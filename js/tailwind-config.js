'use strict';

// ════════════════════════════════════════════════════════════
// SHARED TAILWIND CONFIG — single source of truth
// index.html, terms.html, privacy.html — তিন জায়গাতেই এই একই ফাইল
// লোড হয় (Tailwind CDN script ট্যাগের ঠিক পরে)। আগে প্রতিটা HTML
// ফাইলে আলাদা ইনলাইন <script>tailwind.config=...</script> ছিল —
// ব্র্যান্ড কালার বদলাতে চাইলে ৩ জায়গায় বদলাতে হতো, একটা মিস হয়ে
// যাওয়ার ঝুঁকি ছিল।
//
// ✅ colors.brand এখন hex-hardcode না, styles.css-এর CSS variable
// (--brand/--brand-dark) রেফারেন্স করে — তাই ব্র্যান্ড কালার বদলাতে
// এখন থেকে শুধু styles.css-এর একটা লাইন বদলালেই Tailwind ক্লাস
// (bg-brand, text-brand ইত্যাদি) ও plain CSS বাটন ক্লাস দুটোতেই
// এক সাথে প্রতিফলিত হবে।
// ════════════════════════════════════════════════════════════
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: { DEFAULT: 'var(--brand)', dark: 'var(--brand-dark)' },
      },
    },
  },
};
