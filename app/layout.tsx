import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const SITE = "https://cektag.web.id";

const TITLE = "CekTag: Cek Tag GetContact Nomer HP Tidak Dikenal";
const DESC =
  "Cek tag GetContact nomer HP tidak dikenal, Rp 2.000 per cek via QRIS, tanpa daftar dan tanpa install. Cari tahu identitas nomer: spam, penipu, atau kenalan. Sekali cek langsung tahu.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: TITLE,
    template: "%s | CekTag",
  },
  description: DESC,
  keywords: [
    "cek tag getcontact",
    "cek nomer hp tidak dikenal",
    "cara cek nomer tidak dikenal",
    "cek nomer hp penipu atau bukan",
    "cara mengetahui identitas nomer hp",
    "cek tag nomer",
    "deteksi nomer spam",
    "lacak nomer hp tidak dikenal",
    "getcontact web",
    "cek nomer telepon",
    "cara cek tag getcontact",
    "nomer tak dikenal",
    "cektag",
  ],
  authors: [{ name: "CekTag" }],
  creator: "CekTag",
  publisher: "CekTag",
  alternates: { canonical: SITE },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: SITE,
    siteName: "CekTag",
    type: "website",
    locale: "id_ID",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "CekTag - Cek Tag GetContact Nomer HP Tidak Dikenal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description:
      "Nomer tak dikenal ganggu atau bikin penasaran? Lihat tag GetContact-nya: ditandai spam/penipu atau justru kenalan.",
    images: ["/og-image.jpg"],
  },
  robots: { index: true, follow: true },
  verification: {
    google: "Yxz04MHDIDvb43D8r-QQt-98HelqMcn3Wede0HhSokw",
  },
};

// Structured data: WebSite + FAQPage (bantu Google nampilin rich result)
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "CekTag",
      url: SITE,
      description: DESC,
      inLanguage: "id-ID",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Apa itu tag GetContact?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Tag adalah nama/julukan yang diberikan orang lain saat menyimpan sebuah nomer di kontak HP mereka. GetContact mengumpulkan data ini dari jutaan penggunanya, jadi kamu bisa lihat gimana orang-orang menamai sebuah nomer.",
          },
        },
        {
          "@type": "Question",
          name: "Datanya dari mana? Akurat nggak?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Dari database publik GetContact. Akurasinya tergantung data crowdsource. Bisa tepat banget, bisa juga ngaco kalau yang menyimpan kontaknya iseng. Buat gambaran aja, jangan dijadikan patokan.",
          },
        },
        {
          "@type": "Question",
          name: "Berapa harganya?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Rp 2.000 per cek, bayar via QRIS. Tanpa daftar, tanpa langganan.",
          },
        },
        {
          "@type": "Question",
          name: "Apakah nomer yang saya cek disimpan?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Setiap pengecekan langsung ke GetContact secara real-time. Di log kami, nomer HP dan IP hanya disimpan dalam bentuk hash yang tidak bisa dibaca balik. Detailnya ada di halaman Privasi.",
          },
        },
      ],
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "#07070f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className={`${jakarta.variable} ${grotesk.variable} font-sans`}>{children}</body>
    </html>
  );
}
