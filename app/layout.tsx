import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const socialImage = `${protocol}://${host}/og.png`;

  return {
    title: "HealthNet — Prepare for better care",
    description: "Turn your health story into an organized, clinician-ready visit summary.",
    openGraph: {
      title: "HealthNet — Prepare for better care",
      description: "Turn your health story into an organized, clinician-ready visit summary.",
      images: [{ url: socialImage, width: 1536, height: 1024, alt: "HealthNet turns a health story into a visit summary" }],
    },
    twitter: { card: "summary_large_image", images: [socialImage] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
