import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CalendarProvider } from "@/context/CalendarContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "RosterLoop",
  description: "Sistema de gestión de horarios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <CalendarProvider>
              {children}
            </CalendarProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
