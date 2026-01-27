"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "light" | "dark";
type Language = "es" | "en";

interface ThemeContextType {
    theme: Theme;
    language: Language;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    setLanguage: (lang: Language) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("dark");
    const [language, setLanguageState] = useState<Language>("es");
    const [mounted, setMounted] = useState(false);

    // Cargar preferencias del localStorage al montar
    useEffect(() => {
        const savedTheme = localStorage.getItem("theme") as Theme | null;
        const savedLanguage = localStorage.getItem("language") as Language | null;

        if (savedTheme) {
            setThemeState(savedTheme);
        } else {
            // Detectar preferencia del sistema
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            setThemeState(prefersDark ? "dark" : "light");
        }

        if (savedLanguage) {
            setLanguageState(savedLanguage);
        }

        setMounted(true);
    }, []);

    // Aplicar clase al documento HTML cuando cambia el tema
    useEffect(() => {
        if (mounted) {
            document.documentElement.setAttribute("data-theme", theme);
            localStorage.setItem("theme", theme);
        }
    }, [theme, mounted]);

    // Guardar idioma en localStorage cuando cambia
    useEffect(() => {
        if (mounted) {
            localStorage.setItem("language", language);
        }
    }, [language, mounted]);

    const toggleTheme = () => {
        setThemeState((prev) => (prev === "light" ? "dark" : "light"));
    };

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
    };

    // Evitar hydration mismatch
    if (!mounted) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, language, toggleTheme, setTheme, setLanguage }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
