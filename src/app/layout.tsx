import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CodeRoom — Code together, in real time",
    template: "%s · CodeRoom",
  },
  description:
    "A real-time collaborative coding and mock-interview platform: shared rooms, live code sync, cursors, chat, and session history.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-50 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
