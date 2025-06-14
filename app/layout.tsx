import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";

import { TRPCProvider } from "@/lib/trpc/provider";
import { Toaster } from "sonner";
import Script from "next/script";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Invisible AI Evaluation Platform",
  description:
    "Professional AI model evaluation system with structured rubric workflows, human-AI alignment validation, and comprehensive analytics across multiple industry sectors.",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${ibmPlexMono.variable} ${ibmPlexSans.variable} ${ibmPlexSans.className}  antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCProvider>
            {children}{" "}
            <Toaster
              position="bottom-right"
              expand={false}
              toastOptions={{
                style: {
                  border: "1px solid hsl(var(--border))",
                },
              }}
            />
          </TRPCProvider>
        </ThemeProvider>
      </body>
      {process.env.NODE_ENV === "development" ? (
        <head>
          <Script
            crossOrigin="anonymous"
            src="//unpkg.com/react-scan/dist/auto.global.js"
          />
        </head>
      ) : null}
    </html>
  );
}
