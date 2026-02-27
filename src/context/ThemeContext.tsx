"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "light" | "dark";
type Language = "es" | "en";

interface ThemeContextType {
    theme: Theme;
    language: Language;
    showOnlyActiveUsers: boolean;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    setLanguage: (lang: Language) => void;
    setShowOnlyActiveUsers: (show: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("dark");
    const [language, setLanguageState] = useState<Language>("en");
    const [showOnlyActiveUsers, setShowOnlyActiveUsersState] = useState<boolean>(true);
    const [mounted, setMounted] = useState(false);

    // Cargar preferencias del localStorage al montar
    useEffect(() => {
        const savedTheme = localStorage.getItem("theme") as Theme | null;
        const savedLanguage = localStorage.getItem("language") as Language | null;
        const savedUserFilter = localStorage.getItem("showOnlyActiveUsers");

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

        if (savedUserFilter !== null) {
            setShowOnlyActiveUsersState(JSON.parse(savedUserFilter));
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

    // Guardar filtro de usuarios en localStorage cuando cambia
    useEffect(() => {
        if (mounted) {
            localStorage.setItem("showOnlyActiveUsers", JSON.stringify(showOnlyActiveUsers));
            // Notify other components about the change
            window.dispatchEvent(new CustomEvent('userFilterChanged', { detail: showOnlyActiveUsers }));
        }
    }, [showOnlyActiveUsers, mounted]);

    const toggleTheme = () => {
        setThemeState((prev) => (prev === "light" ? "dark" : "light"));
    };

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
    };

    const setShowOnlyActiveUsers = (show: boolean) => {
        setShowOnlyActiveUsersState(show);
    };

    // Evitar hydration mismatch
    if (!mounted) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, language, showOnlyActiveUsers, toggleTheme, setTheme, setLanguage, setShowOnlyActiveUsers }}>
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
