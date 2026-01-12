"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/");
        } else if (!isLoading && user) {
            // Redirigir automáticamente al calendario
            router.push("/calendar");
        }
    }, [user, isLoading, router]);

    // Mostrar loading mientras redirige
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: '#f8fafc'
        }}>
            <div style={{
                textAlign: 'center',
                color: '#64748b'
            }}>
                <div style={{
                    border: '3px solid #f3f4f6',
                    borderTop: '3px solid #3b82f6',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px'
                }}></div>
                <p>Redirigiendo al calendario...</p>
            </div>
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

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
                            <h3>Enviar Mensaje</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                                        Email destino
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="test@gmail.com"
                                        value={customEmail}
                                        onChange={(e) => setCustomEmail(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'white',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                                        Título
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Título del mensaje"
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'white',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                                        Mensaje
                                    </label>
                                    <textarea
                                        placeholder="Escribe tu mensaje aquí..."
                                        value={customBody}
                                        onChange={(e) => setCustomBody(e.target.value)}
                                        rows={4}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'white',
                                            fontSize: '14px',
                                            resize: 'vertical',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                </div>

                                <button
                                    className={styles.saludarBtn}
                                    onClick={handleSendMessage}
                                    disabled={!customEmail || !customTitle || !customBody}
                                    style={{ marginTop: '10px' }}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                    Enviar Mensaje
                                </button>
                            </div>

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
