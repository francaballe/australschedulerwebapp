"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Navbar from "@/components/Navbar";
import styles from "./page.module.css";

interface Role {
    id: number;
    name: string | null;
}

interface ManagedUser {
    id: number;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    roleId: number | null;
    phone: string | null;
    isBlocked: boolean | null;
    lastLogin: string | null;
    createdDate: string | null;
    roleName: string | null;
}

interface UserFormData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    roleId: number;
}

const emptyForm: UserFormData = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    roleId: 0,
};

export default function SettingsPage() {
    const { user, isLoading } = useAuth();
    const { theme, setTheme, language, setLanguage, showOnlyActiveUsers, setShowOnlyActiveUsers } = useTheme();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('general');
    const [greeting, setGreeting] = useState<string | null>(null);
    const [customEmail, setCustomEmail] = useState("");
    const [customTitle, setCustomTitle] = useState("");
    const [customBody, setCustomBody] = useState("");

    // User management state
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
    const [formData, setFormData] = useState<UserFormData>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSaving, setFormSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ user: ManagedUser; action: 'block' | 'unblock' } | null>(null);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/");
        }
    }, [user, isLoading, router]);

    // Load user filter preference from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('showOnlyActiveUsers');
        if (saved !== null) {
            setShowOnlyActiveUsers(JSON.parse(saved));
        }
    }, []);

    // Save user filter preference to localStorage
    useEffect(() => {
        localStorage.setItem('showOnlyActiveUsers', JSON.stringify(showOnlyActiveUsers));
        window.dispatchEvent(new CustomEvent('userFilterChanged', { detail: showOnlyActiveUsers }));
    }, [showOnlyActiveUsers]);

    // Fetch roles
    const fetchRoles = useCallback(async () => {
        try {
            const response = await fetch('/api/roles');
            if (response.ok) {
                const data = await response.json();
                setRoles(data);
                // Set default roleId to first available role
                if (data.length > 0) {
                    setFormData(prev => ({ ...prev, roleId: data[0].id }));
                }
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    }, []);

    // Fetch users for management
    const fetchUsers = useCallback(async () => {
        setUsersLoading(true);
        try {
            const response = await fetch('/api/users?includeBlocked=true', { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setUsersLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
            if (roles.length === 0) fetchRoles();
        }
    }, [activeTab, fetchUsers, fetchRoles, roles.length]);

    const showFeedback = (type: 'success' | 'error', message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    // Filtered users based on search (Blocked status filter only applies to the calendar grid)
    const filteredUsers = users.filter(u => {
        if (!searchQuery.trim()) return true;
        const term = searchQuery.toLowerCase();
        return (
            (u.firstName?.toLowerCase().includes(term)) ||
            (u.lastName?.toLowerCase().includes(term)) ||
            (u.email?.toLowerCase().includes(term)) ||
            (u.phone?.toLowerCase().includes(term))
        );
    });

    // Roles available in dropdown based on who's logged in:
    // - Owner (0): can assign Admin and Regular (never Owner)
    // - Admin (1): can only assign Regular (not Admin, not Owner)
    const availableRoles = roles.filter((r: Role) => {
        if (r.id === 0) return false;
        if (user?.roleId === 1 && r.id === 1) return false;
        return true;
    });

    // Open create modal
    const handleCreateUser = () => {
        setEditingUser(null);
        setFormData({ ...emptyForm, roleId: availableRoles[0]?.id ?? 2 });
        setFormError(null);
        setShowUserModal(true);
    };

    // Who can the current user edit/block?
    // - Owner: anyone
    // - Admin: only regulars (roleId=2) OR themselves (role stays locked)
    const canEditUser = (target: ManagedUser): boolean => {
        if (target.id === user?.id) return true;          // anyone can edit themselves
        if (user?.roleId === 0) return true;              // owner can edit anyone
        if (user?.roleId === 1) return target.roleId === 2; // admin can only edit regulars
        return false;
    };
    const canBlockUser = (target: ManagedUser): boolean => {
        if (target.id === user?.id) return false;          // never block yourself
        if (user?.roleId === 0) return true;
        if (user?.roleId === 1) return target.roleId === 2;
        return false;
    };

    // Open edit modal
    const handleEditUser = (u: ManagedUser) => {
        setEditingUser(u);
        setFormData({
            firstName: u.firstName || "",
            lastName: u.lastName || "",
            email: u.email || "",
            phone: u.phone || "",
            password: "",
            roleId: u.roleId || 2,
        });
        setFormError(null);
        setShowUserModal(true);
    };

    // Save user (create or update)
    const handleSaveUser = async () => {
        if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
            setFormError("Nombre, apellido y email son requeridos");
            return;
        }
        if (!editingUser && !formData.password.trim()) {
            setFormError("La contraseña es requerida para nuevos usuarios");
            return;
        }

        setFormSaving(true);
        setFormError(null);

        try {
            const isEdit = !!editingUser;
            const payload: any = {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim() || null,
            };

            if (isEdit) {
                payload.id = editingUser!.id;
                payload.callerUserId = user?.id; // Server will verify caller's role from DB
            }
            // Only send roleId if the logged-in user is the owner (admins can't change roles)
            if (user?.roleId === 0 && editingUser?.id !== user?.id) {
                payload.roleId = formData.roleId;
            }
            if (formData.password.trim()) {
                payload.password = formData.password;
            }

            const response = await fetch('/api/users', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                setShowUserModal(false);
                await fetchUsers();
                showFeedback('success', isEdit ? '✅ Usuario actualizado correctamente' : '✅ Usuario creado correctamente');
            } else {
                const err = await response.json();
                setFormError(err.error || 'Error al guardar');
            }
        } catch (error) {
            setFormError('Error de conexión');
        } finally {
            setFormSaving(false);
        }
    };

    // Toggle block/unblock
    const handleToggleBlock = async () => {
        if (!confirmAction) return;
        const { user: targetUser, action } = confirmAction;
        const newBlocked = action === 'block';

        try {
            const response = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: targetUser.id, isBlocked: newBlocked }),
            });

            if (response.ok) {
                await fetchUsers();
                showFeedback('success', newBlocked
                    ? `🚫 ${targetUser.firstName} ${targetUser.lastName} ha sido bloqueado`
                    : `✅ ${targetUser.firstName} ${targetUser.lastName} ha sido desbloqueado`
                );
            } else {
                showFeedback('error', 'Error al cambiar el estado del usuario');
            }
        } catch (error) {
            showFeedback('error', 'Error de conexión');
        } finally {
            setConfirmAction(null);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return 'Nunca';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

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

                if (result.pushSent) {
                    setGreeting(`✅ Mensaje enviado y notificación push entregada`);
                } else {
                    setGreeting(`✅ Mensaje guardado (push no enviado: ${result.pushError || 'sin token FCM'})`);
                }

                setCustomTitle("");
                setCustomBody("");
            } else {
                const error = await response.json();
                setGreeting(`❌ Error enviando mensaje: ${error.error}`);
            }
        } catch (error) {
            setGreeting(`❌ Error de conexión`);
        }

        setTimeout(() => setGreeting(null), 5000);
    };

    const handleSaludar = async (userId: number) => {
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
                setGreeting(`✅ ¡Saludo enviado a ${targetEmail}!`);
            } else {
                let errorMessage = 'Error desconocido';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.details || `HTTP ${response.status}`;

                    if (response.status === 404 && errorMessage.includes('No push token found')) {
                        setGreeting(`ℹ️ ${targetEmail} no tiene notificaciones push configuradas`);
                    } else if (response.status === 410 && errorMessage.includes('invalid')) {
                        setGreeting(`ℹ️ Token de ${targetEmail} expirado, fue actualizado`);
                    } else {
                        setGreeting(`❌ Error enviando saludo: ${errorMessage}`);
                    }
                } catch (parseError) {
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    setGreeting(`❌ Error enviando saludo: ${errorMessage}`);
                }
            }
        } catch (error) {
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

                                {/* Filtros de Visualización */}
                                <div className={styles.settingItem}>
                                    <div className={styles.settingInfo}>
                                        <span className={styles.settingLabel}>👁️ Filtros de Visualización</span>
                                        <span className={styles.settingDescription}>
                                            Controla qué usuarios se muestran en el calendario
                                        </span>
                                    </div>
                                    <div className={styles.settingControl}>
                                        <div className={styles.toggleGroup}>
                                            <button
                                                className={`${styles.toggleOption} ${showOnlyActiveUsers ? styles.toggleActive : ''}`}
                                                onClick={() => setShowOnlyActiveUsers(true)}
                                            >
                                                👤 Solo usuarios no bloqueados
                                            </button>
                                            <button
                                                className={`${styles.toggleOption} ${!showOnlyActiveUsers ? styles.toggleActive : ''}`}
                                                onClick={() => setShowOnlyActiveUsers(false)}
                                            >
                                                👥 Todos los usuarios
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

                            {feedback && (
                                <div className={`${styles.feedbackMessage} ${feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}`}>
                                    {feedback.message}
                                </div>
                            )}

                            {/* User Counter */}
                            <div className={styles.userCounterCard}>
                                <span className={styles.userCounterLabel}>Usuarios registrados</span>
                                <div className={styles.userCounterBadge}>
                                    {usersLoading ? '…' : users.length}
                                </div>
                            </div>

                            {/* Toolbar */}
                            <div className={styles.toolbar}>
                                <input
                                    type="text"
                                    placeholder="🔍 Buscar por nombre, email o teléfono..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={styles.searchInput}
                                />
                                <button
                                    className={styles.createButton}
                                    onClick={handleCreateUser}
                                >
                                    ➕ Crear Usuario
                                </button>
                            </div>

                            {/* Search results count */}
                            {!usersLoading && searchQuery.trim() && (
                                <div className={styles.userCount}>
                                    {filteredUsers.length} resultado{filteredUsers.length !== 1 ? 's' : ''} para &quot;{searchQuery}&quot;
                                </div>
                            )}

                            {/* Users table */}
                            {usersLoading ? (
                                <div className={styles.loadingTable}>
                                    <div className={styles.spinner}></div>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyIcon}>👥</div>
                                    <div className={styles.emptyTitle}>
                                        {searchQuery ? 'Sin resultados' : 'No hay usuarios'}
                                    </div>
                                    <div className={styles.emptyDescription}>
                                        {searchQuery
                                            ? `No se encontraron usuarios para "${searchQuery}"`
                                            : 'Crea el primer usuario con el botón de arriba'
                                        }
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.usersTableWrapper}>
                                    <table className={styles.usersTable}>
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Email</th>
                                                <th>Teléfono</th>
                                                <th>Rol</th>
                                                <th>Estado</th>
                                                <th>Último Login</th>
                                                <th>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map((u) => (
                                                <tr key={u.id}>
                                                    <td>
                                                        <span className={styles.userName}>
                                                            {u.firstName} {u.lastName}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={styles.userEmail}>{u.email || '—'}</span>
                                                    </td>
                                                    <td>{u.phone || '—'}</td>
                                                    <td>
                                                        <span className={`${styles.badge} ${styles.badgeEmployee}`} style={{
                                                            background: u.roleId === 0 ? '#F3E8FF' : u.roleId === 1 ? '#FEF3C7' : '#DBEAFE',
                                                            color: u.roleId === 0 ? '#6B21A8' : u.roleId === 1 ? '#92400E' : '#1E40AF'
                                                        }}>
                                                            {u.roleName || `Rol ${u.roleId}`}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`${styles.badge} ${u.isBlocked ? styles.badgeBlocked : styles.badgeActive}`}>
                                                            {u.isBlocked ? '🚫 Bloqueado' : '✅ Activo'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={styles.lastLoginText}>
                                                            {formatDateTime(u.lastLogin)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className={styles.actionsCell}>
                                                            {canEditUser(u) ? (
                                                                <button
                                                                    className={styles.editButton}
                                                                    onClick={() => handleEditUser(u)}
                                                                    title="Editar usuario"
                                                                >
                                                                    ✏️ Editar
                                                                </button>
                                                            ) : (
                                                                <button className={styles.editButton} disabled style={{ opacity: 0.3, cursor: 'not-allowed' }} title="Sin permisos">
                                                                    ✏️ Editar
                                                                </button>
                                                            )}
                                                            {canBlockUser(u) && (
                                                                u.isBlocked ? (
                                                                    <button
                                                                        className={styles.unblockButton}
                                                                        onClick={() => setConfirmAction({ user: u, action: 'unblock' })}
                                                                        title="Desbloquear usuario"
                                                                    >
                                                                        🔓 Activar
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        className={styles.blockButton}
                                                                        onClick={() => setConfirmAction({ user: u, action: 'block' })}
                                                                        title="Bloquear usuario"
                                                                    >
                                                                        🔒 Bloquear
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
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

            {/* Create/Edit User Modal */}
            {showUserModal && (
                <div className={styles.modalOverlay} onClick={() => setShowUserModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalTitle}>
                            {editingUser ? '✏️ Editar Usuario' : '➕ Crear Usuario'}
                        </div>
                        <div className={styles.modalForm}>
                            <div className={styles.modalFormRow}>
                                <div className={styles.modalField}>
                                    <label>Nombre *</label>
                                    <input
                                        type="text"
                                        value={formData.firstName}
                                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                        placeholder="Nombre"
                                    />
                                </div>
                                <div className={styles.modalField}>
                                    <label>Apellido *</label>
                                    <input
                                        type="text"
                                        value={formData.lastName}
                                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                        placeholder="Apellido"
                                    />
                                </div>
                            </div>

                            <div className={styles.modalField}>
                                <label>Email *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="usuario@ejemplo.com"
                                />
                            </div>

                            <div className={styles.modalFormRow}>
                                <div className={styles.modalField}>
                                    <label>Teléfono</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+54 11 1234-5678"
                                    />
                                </div>
                                <div className={styles.modalField}>
                                    <label>Rol</label>
                                    {/* Admins never change roles — only owner can promote/demote */}
                                    {user?.roleId === 0 && (
                                        editingUser && editingUser.id === user?.id ? (
                                            // Owner self-edit: show role as read-only
                                            <div style={{
                                                padding: '10px 12px',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                background: 'var(--background)',
                                                color: 'var(--foreground-secondary)',
                                                cursor: 'not-allowed'
                                            }}>
                                                {editingUser.roleName ?? `Rol ${editingUser.roleId}`}
                                                <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.7 }}>(no editable)</span>
                                            </div>
                                        ) : (
                                            <select
                                                value={formData.roleId}
                                                onChange={(e) => setFormData({ ...formData, roleId: Number(e.target.value) })}
                                            >
                                                {availableRoles.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name ?? `Rol ${r.id}`}</option>
                                                ))}
                                            </select>
                                        )
                                    )}
                                    {user?.roleId !== 0 && (
                                        <div style={{
                                            padding: '10px 12px',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            background: 'var(--background)',
                                            color: 'var(--foreground-secondary)',
                                            cursor: 'not-allowed'
                                        }}>
                                            {editingUser?.roleName ?? roles.find(r => r.id === formData.roleId)?.name ?? `Rol ${formData.roleId}`}
                                            <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.7 }}>(no editable)</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.modalField}>
                                <label>{editingUser ? 'Contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder={editingUser ? '••••••••' : 'Ingresa una contraseña'}
                                />
                            </div>

                            {formError && (
                                <div className={styles.modalError}>{formError}</div>
                            )}

                            <div className={styles.modalActions}>
                                <button
                                    className={styles.modalCancelButton}
                                    onClick={() => setShowUserModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className={styles.modalSaveButton}
                                    onClick={handleSaveUser}
                                    disabled={formSaving}
                                >
                                    {formSaving ? 'Guardando...' : (editingUser ? 'Guardar Cambios' : 'Crear Usuario')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Block/Unblock Modal */}
            {confirmAction && (
                <div className={styles.modalOverlay} onClick={() => setConfirmAction(null)}>
                    <div className={`${styles.modalContent} ${styles.confirmModal}`} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.confirmIcon}>
                            {confirmAction.action === 'block' ? '🔒' : '🔓'}
                        </div>
                        <div className={styles.confirmTitle}>
                            {confirmAction.action === 'block' ? '¿Bloquear usuario?' : '¿Desbloquear usuario?'}
                        </div>
                        <div className={styles.confirmMessage}>
                            {confirmAction.action === 'block'
                                ? `${confirmAction.user.firstName} ${confirmAction.user.lastName} no podrá iniciar sesión mientras esté bloqueado.`
                                : `${confirmAction.user.firstName} ${confirmAction.user.lastName} volverá a poder iniciar sesión.`
                            }
                        </div>
                        <div className={styles.confirmActions}>
                            <button
                                className={styles.modalCancelButton}
                                onClick={() => setConfirmAction(null)}
                            >
                                Cancelar
                            </button>
                            {confirmAction.action === 'block' ? (
                                <button
                                    className={styles.confirmDangerButton}
                                    onClick={handleToggleBlock}
                                >
                                    Bloquear
                                </button>
                            ) : (
                                <button
                                    className={styles.confirmSuccessButton}
                                    onClick={handleToggleBlock}
                                >
                                    Desbloquear
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}