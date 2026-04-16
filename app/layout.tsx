import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ThemeProvider } from "./theme-provider";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
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
      className={`${poppins.variable} h-full`}
      suppressHydrationWarning
    >
      <body className='min-h-full flex flex-col font-[family-name:var(--font-poppins)] antialiased'>
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
