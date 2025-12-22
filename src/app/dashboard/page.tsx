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

    const handleSaludar = async (userId: number) => {
        console.log(`handleSaludar clicked for user ${userId} - starting...`);
        console.log('Current user:', user);
        
        setGreeting(`¡Hola, ${user?.firstName}! 👋 Enviando a usuario ${userId}...`);
        
        try {
            console.log(`Making request to /api/send-push for user ${userId}...`);
            
            // Determinar email basado en userId - DATOS REALES DE LA BD
            const targetEmail = userId === 0 ? 'francaballe@gmail.com' : 'test@gmail.com';
            
            // Enviar notificación push al usuario específico
            const response = await fetch('/api/send-push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: targetEmail,
                    title: `¡Saludo desde el Dashboard!`,
                    body: `${user?.firstName} te ha enviado un saludo desde la aplicación web 👋 (Usuario ${userId})`
                })
            });

            console.log('Response received:', response.status, response.statusText);

            if (response.ok) {
                const result = await response.json();
                console.log('Push notification sent:', result);
                setGreeting(`¡Hola, ${user?.firstName}! 👋 (Notificación enviada a usuario ${userId})`);
            } else {
                const error = await response.json();
                console.error('Error sending push:', error);
                setGreeting(`¡Hola, ${user?.firstName}! 👋 (Error enviando a usuario ${userId})`);
            }
        } catch (error) {
            console.error('Error:', error);
            setGreeting(`¡Hola, ${user?.firstName}! 👋 (Error de conexión)`);
        }

        setTimeout(() => setGreeting(null), 5000);
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
                            <button className={styles.saludarBtn} onClick={() => handleSaludar(0)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M7 11v-1a5 5 0 0 1 10 0v1" />
                                    <path d="M5 11h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" />
                                    <circle cx="12" cy="16" r="1" />
                                </svg>
                                Saludar a francaballe@gmail.com
                            </button>

                            <button className={styles.saludarBtn} onClick={() => handleSaludar(1)} style={{marginTop: '10px'}}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M7 11v-1a5 5 0 0 1 10 0v1" />
                                    <path d="M5 11h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" />
                                    <circle cx="12" cy="16" r="1" />
                                </svg>
                                Saludar a test@gmail.com
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
