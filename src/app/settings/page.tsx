"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Navbar from "@/components/Navbar";
import styles from "./page.module.css";

export default function SettingsPage() {
    const { user, isLoading } = useAuth();
    const { theme, setTheme, language, setLanguage } = useTheme();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('general'); // 'general' o 'messaging'
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
                {/* Tabs Navigation */}
                <div className={styles.tabsContainer}>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'general' ? styles.active : ''}`}
                            onClick={() => setActiveTab('general')}
                        >
                            ⚙️ Configuración General
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
                            onClick={() => setActiveTab('users')}
                        >
                            👥 Administración de Usuarios
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'sites' ? styles.active : ''}`}
                            onClick={() => setActiveTab('sites')}
                        >
                            🏢 Admin. de Sitios
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'logs' ? styles.active : ''}`}
                            onClick={() => setActiveTab('logs')}
                        >
                            📜 Logs del Sistema
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'messaging' ? styles.active : ''}`}
                            onClick={() => setActiveTab('messaging')}
                        >
                            🧪 Tests de Mensajería
                        </button>
                    </div>
                </div>

                <div className={styles.content}>
                    {/* Configuración General Tab */}
                    {activeTab === 'general' && (
                        <div className={styles.section}>
                            <h2>⚙️ Configuración General</h2>
                            <p className={styles.sectionDescription}>
                                Personaliza la apariencia y preferencias de la aplicación
                            </p>

                            <div className={styles.settingsList}>
                                {/* Modo Oscuro/Claro */}
                                <div className={styles.settingItem}>
                                    <div className={styles.settingInfo}>
                                        <span className={styles.settingLabel}>🌓 Modo de Apariencia</span>
                                        <span className={styles.settingDescription}>
                                            Elige entre modo claro u oscuro
                                        </span>
                                    </div>
                                    <div className={styles.settingControl}>
                                        <div className={styles.toggleGroup}>
                                            <button
                                                className={`${styles.toggleOption} ${theme === 'light' ? styles.toggleActive : ''}`}
                                                onClick={() => setTheme('light')}
                                            >
                                                ☀️ Claro
                                            </button>
                                            <button
                                                className={`${styles.toggleOption} ${theme === 'dark' ? styles.toggleActive : ''}`}
                                                onClick={() => setTheme('dark')}
                                            >
                                                🌙 Oscuro
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Selector de Idioma */}
                                <div className={styles.settingItem}>
                                    <div className={styles.settingInfo}>
                                        <span className={styles.settingLabel}>🌐 Idioma</span>
                                        <span className={styles.settingDescription}>
                                            Selecciona el idioma de la aplicación
                                        </span>
                                    </div>
                                    <div className={styles.settingControl}>
                                        <div className={styles.toggleGroup}>
                                            <button
                                                className={`${styles.toggleOption} ${language === 'es' ? styles.toggleActive : ''}`}
                                                onClick={() => setLanguage('es')}
                                            >
                                                🇪🇸 Español
                                            </button>
                                            <button
                                                className={`${styles.toggleOption} ${language === 'en' ? styles.toggleActive : ''}`}
                                                onClick={() => setLanguage('en')}
                                            >
                                                🇺🇸 English
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Administración de Usuarios Tab */}
                    {activeTab === 'users' && (
                        <div className={styles.section}>
                            <h2>👥 Administración de Usuarios</h2>
                            <p className={styles.sectionDescription}>
                                Gestión de usuarios del sistema
                            </p>
                            <div className={styles.placeholder}>
                                <p>Esta sección contendrá herramientas para administrar usuarios:</p>
                                <ul>
                                    <li>Lista de usuarios registrados</li>
                                    <li>Crear nuevos usuarios</li>
                                    <li>Editar perfiles de usuario</li>
                                    <li>Gestión de roles y permisos</li>
                                    <li>Activar/desactivar cuentas</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Logs del Sistema Tab */}
                    {activeTab === 'logs' && (
                        <div className={styles.section}>
                            <h2>📜 Logs del Sistema</h2>
                            <p className={styles.sectionDescription}>
                                Seguimiento de eventos y auditoría de la plataforma
                            </p>
                            <div className={styles.placeholder}>
                                <p>Esta sección mostrará logs detallados de la plataforma:</p>
                                <ul>
                                    <li>Historial de inicios de sesión</li>
                                    <li>Cambios en la programación (turnos publicados/editados)</li>
                                    <li>Altas y bajas de usuarios</li>
                                    <li>Errores críticos del servidor</li>
                                    <li>Notificaciones push enviadas</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Tests de Mensajería Tab */}
                    {activeTab === 'messaging' && (
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
                    )}

                    {/* Administración de Sitios Tab */}
                    {activeTab === 'sites' && (
                        <div className={styles.section}>
                            <h2>🏢 Administración de Sitios</h2>
                            <p className={styles.sectionDescription}>
                                Gestión de los sitios / locations del sistema
                            </p>
                            <div className={styles.placeholder}>
                                <p>Herramientas para crear o editar sitios, asignar usuarios a sitios y configurar detalles específicos por ubicación.</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}