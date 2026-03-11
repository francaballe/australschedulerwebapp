"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface User {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    roleId: number;
    companyId: number;
    companyName?: string;
}

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    updateUser: (data: Partial<User>) => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check for existing session in localStorage (only client-side)
        if (typeof window !== "undefined") {
            const storedUser = localStorage.getItem("user");
            if (storedUser) {
                try {
                    setUser(JSON.parse(storedUser));
                } catch {
                    localStorage.removeItem("user");
                }
            }
        }
        setIsLoading(false);
    }, []);

    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, error: data.error || "Error de autenticación" };
            }

            setUser(data.user);
            localStorage.setItem("user", JSON.stringify(data.user));
            return { success: true };
        } catch (error) {
            console.error("Login error:", error);
            return { success: false, error: "Error de conexión" };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("user");
        router.push("/");
    };

    const updateUser = (data: Partial<User>) => {
        setUser(prev => {
            if (!prev) return null;
            const updated = { ...prev, ...data };
            localStorage.setItem("user", JSON.stringify(updated));
            return updated;
        });
    };

    // Background synchronization
    useEffect(() => {
        if (!user?.id) return;

        const syncUser = async () => {
            try {
                const response = await fetch(`/api/auth/me?id=${user.id}`);
                if (response.status === 403 || response.status === 404) {
                    console.log("Session invalid or user blocked. Logging out...");
                    logout();
                    return;
                }

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.user) {
                        const newUser = data.user;
                        // Only update if data changed to avoid unnecessary re-renders
                        if (
                            newUser.firstName !== user.firstName ||
                            newUser.lastName !== user.lastName ||
                            newUser.email !== user.email ||
                            newUser.roleId !== user.roleId ||
                            newUser.companyId !== user.companyId ||
                            newUser.companyName !== user.companyName
                        ) {
                            console.log("Profile changes detected. Syncing...");
                            updateUser(newUser);
                        }
                    }
                }
            } catch (error) {
                console.error("Sync user error:", error);
            }
        };

        // Run on mount or when window gains focus
        const handleFocus = () => syncUser();
        window.addEventListener("focus", handleFocus);

        // Polling every 5 minutes
        const interval = setInterval(syncUser, 300000);

        return () => {
            window.removeEventListener("focus", handleFocus);
            clearInterval(interval);
        };
    }, [user?.id, user?.firstName, user?.lastName, user?.email, user?.roleId, user?.companyId, user?.companyName]);

    return (
        <AuthContext.Provider value={{ user, login, logout, updateUser, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
