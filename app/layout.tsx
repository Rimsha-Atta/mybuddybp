import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "./theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hypertension Buddy",
  description: "Blood pressure tracking and insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang='en'
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <body className='min-h-full flex flex-col font-sans antialiased'>
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem={true}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
