"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import styles from "./page.module.css";

export default function Dashboard() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [greeting, setGreeting] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/");
        }
    }, [user, isLoading, router]);

    const handleSaludar = () => {
        setGreeting(`¡Hola, ${user?.firstName}! 👋`);
        setTimeout(() => setGreeting(null), 3000);
    };

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className={styles.container}>
            <Navbar />

            <main className={styles.main}>
                <div className={styles.content}>
                    <h1 className={styles.title}>Dashboard</h1>
                    <p className={styles.subtitle}>Bienvenido al panel de control</p>

                    <div className={styles.cardContainer}>
                        <div className={styles.card}>
                            <button className={styles.saludarBtn} onClick={handleSaludar}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M7 11v-1a5 5 0 0 1 10 0v1" />
                                    <path d="M5 11h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" />
                                    <circle cx="12" cy="16" r="1" />
                                </svg>
                                Saludar
                            </button>

                            {greeting && (
                                <div className={styles.greeting}>
                                    {greeting}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
