"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import styles from "./page.module.css";

export default function SettingsPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [greeting, setGreeting] = useState<string | null>(null);
    const [customEmail, setCustomEmail] = useState("");
    const [customTitle, setCustomTitle] = useState("");
    const [customBody, setCustomBody] = useState("");

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/");
        }
    }, [user, isLoading, router]);

    const handleSendMessage = async () => {
        if (!customEmail || !customTitle || !customBody) {
            setGreeting('⚠️ Por favor completa todos los campos');
            setTimeout(() => setGreeting(null), 3000);
            return;
        }

        setGreeting(`📤 Enviando mensaje a ${customEmail}...`);

        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: customEmail,
                    title: customTitle,
                    body: customBody
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Message sent:', result);

                if (result.pushSent) {
                    setGreeting(`✅ Mensaje enviado y notificación push entregada`);
                } else {
                    setGreeting(`✅ Mensaje guardado (push no enviado: ${result.pushError || 'sin token FCM'})`);
                }

                // Limpiar campos después de enviar
                setCustomTitle("");
                setCustomBody("");
            } else {
                const error = await response.json();
                console.error('Error sending message:', error);
                setGreeting(`❌ Error enviando mensaje: ${error.error}`);
            }
        } catch (error) {
            console.error('Error:', error);
            setGreeting(`❌ Error de conexión`);
        }

        setTimeout(() => setGreeting(null), 5000);
    };

    const handleSaludar = async (userId: number) => {
        console.log(`handleSaludar clicked for user ${userId} - starting...`);
        console.log('Current user:', user);

        let targetEmail = '';
        if (userId === 0) targetEmail = 'francaballe@gmail.com';
        else if (userId === 1) targetEmail = 'test@gmail.com';
        else if (userId === -1) targetEmail = customEmail;

        if (!targetEmail) {
            setGreeting('⚠️ Por favor ingresa un email válido');
            setTimeout(() => setGreeting(null), 3000);
            return;
        }

        setGreeting(`¡Hola, ${user?.firstName}! 👋 Enviando a ${targetEmail}...`);

        try {
            console.log(`Making request to /api/send-push for ${targetEmail}...`);

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

            if (response.ok) {
                const result = await response.json();
                console.log('Push notification result:', result);
                setGreeting(`✅ ¡Saludo enviado a ${targetEmail}!`);
            } else {
                let errorMessage = 'Error desconocido';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.details || `HTTP ${response.status}`;
                    
                    // Solo loggear como error si no es un problema esperado
                    if (response.status === 404 && errorMessage.includes('No push token found')) {
                        console.log(`Info: ${errorMessage} para ${targetEmail}`);
                        setGreeting(`ℹ️ ${targetEmail} no tiene notificaciones push configuradas`);
                    } else if (response.status === 410 && errorMessage.includes('invalid')) {
                        console.log(`Info: Token expirado para ${targetEmail}, fue eliminado`);
                        setGreeting(`ℹ️ Token de ${targetEmail} expirado, fue actualizado`);
                    } else {
                        console.error('Error sending push:', errorData);
                        setGreeting(`❌ Error enviando saludo: ${errorMessage}`);
                    }
                } catch (parseError) {
                    console.warn('Could not parse error response:', parseError);
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    setGreeting(`❌ Error enviando saludo: ${errorMessage}`);
                }
            }
        } catch (error) {
            console.warn('Network or connection error:', error);
            setGreeting(`❌ Error de conexión`);
        }

        setTimeout(() => setGreeting(null), 4000);
    };

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className={styles.container}>
            <Navbar />
            <main className={styles.main}>
                <div className={styles.header}>
                    <h1>Configuración y Pruebas</h1>
                    <p>Herramientas de administración y testing</p>
                </div>

                <div className={styles.content}>
                    {/* Sección de Tests de Mensajería */}
                    <div className={styles.section}>
                        <h2>🧪 Tests de Mensajería</h2>
                        <p className={styles.sectionDescription}>
                            Herramientas para probar el sistema de mensajes y notificaciones push
                        </p>

                        {greeting && (
                            <div className={styles.greeting}>
                                {greeting}
                            </div>
                        )}

                        {/* Botones de saludo rápido */}
                        <div className={styles.quickTests}>
                            <h3>Pruebas Rápidas</h3>
                            <div className={styles.buttonGrid}>
                                <button 
                                    className={styles.testButton}
                                    onClick={() => handleSaludar(0)}
                                >
                                    👋 Saludar a Francisco
                                </button>
                                <button 
                                    className={styles.testButton}
                                    onClick={() => handleSaludar(1)}
                                >
                                    👋 Saludar a Usuario Test
                                </button>
                            </div>
                        </div>

                        {/* Formulario personalizado */}
                        <div className={styles.customMessage}>
                            <h3>Mensaje Personalizado</h3>
                            <div className={styles.formGroup}>
                                <label>Email destinatario:</label>
                                <input
                                    type="email"
                                    value={customEmail}
                                    onChange={(e) => setCustomEmail(e.target.value)}
                                    placeholder="ejemplo@gmail.com"
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Título del mensaje:</label>
                                <input
                                    type="text"
                                    value={customTitle}
                                    onChange={(e) => setCustomTitle(e.target.value)}
                                    placeholder="Título del mensaje"
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Contenido:</label>
                                <textarea
                                    value={customBody}
                                    onChange={(e) => setCustomBody(e.target.value)}
                                    placeholder="Escribe tu mensaje aquí..."
                                    className={styles.textarea}
                                    rows={4}
                                />
                            </div>

                            <div className={styles.actionButtons}>
                                <button 
                                    className={styles.sendButton}
                                    onClick={handleSendMessage}
                                >
                                    📤 Enviar Mensaje
                                </button>
                                <button 
                                    className={styles.testButton}
                                    onClick={() => handleSaludar(-1)}
                                >
                                    👋 Enviar Saludo
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Futura sección de configuración general */}
                    <div className={styles.section}>
                        <h2>⚙️ Configuración General</h2>
                        <p className={styles.sectionDescription}>
                            Configuración de la aplicación (próximamente)
                        </p>
                        <div className={styles.placeholder}>
                            <p>Esta sección contendrá configuraciones generales de la aplicación:</p>
                            <ul>
                                <li>Preferencias de usuario</li>
                                <li>Configuración de notificaciones</li>
                                <li>Configuración de horarios</li>
                                <li>Gestión de permisos</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}