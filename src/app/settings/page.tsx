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

interface Log {
    id: number;
    createddate: string;
    userId: number;
    action: string;
    user: {
        id: number;
        firstname: string | null;
        lastname: string | null;
        email: string | null;
    };
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

interface ManagedSite {
    id: number;
    name: string | null;
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

    // Logs state
    const [logs, setLogs] = useState<Log[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsPage, setLogsPage] = useState(1);
    const [logsTotalPages, setLogsTotalPages] = useState(1);

    // Sites management state
    const [sites, setSites] = useState<ManagedSite[]>([]);
    const [sitesLoading, setSitesLoading] = useState(false);
    const [showSiteModal, setShowSiteModal] = useState(false);
    const [editingSite, setEditingSite] = useState<ManagedSite | null>(null);
    const [siteName, setSiteName] = useState("");
    const [siteError, setSiteError] = useState<string | null>(null);
    const [siteSaving, setSiteSaving] = useState(false);
    const [confirmDeleteSite, setConfirmDeleteSite] = useState<ManagedSite | null>(null);

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

    // Fetch sites for management
    const fetchSites = useCallback(async () => {
        setSitesLoading(true);
        try {
            const response = await fetch('/api/sites', { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                setSites(data);
            }
        } catch (error) {
            console.error('Error fetching sites:', error);
        } finally {
            setSitesLoading(false);
        }
    }, []);

    // Fetch logs
    const fetchLogs = useCallback(async (page = 1) => {
        setLogsLoading(true);
        try {
            const response = await fetch(`/api/logs?page=${page}&limit=50`, { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                setLogs(data.logs);
                setLogsPage(data.page);
                setLogsTotalPages(data.totalPages);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLogsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
            if (roles.length === 0) fetchRoles();
        } else if (activeTab === 'sites') {
            fetchSites();
        } else if (activeTab === 'logs') {
            fetchLogs(1);
        }
    }, [activeTab, fetchUsers, fetchRoles, roles.length, fetchSites, fetchLogs]);

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
                callerUserId: user?.id,
            };

            if (isEdit) {
                payload.id = editingUser!.id;
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
                body: JSON.stringify({ id: targetUser.id, isBlocked: newBlocked, callerUserId: user?.id }),
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

    // Open create site modal
    const handleCreateSite = () => {
        setEditingSite(null);
        setSiteName("");
        setSiteError(null);
        setShowSiteModal(true);
    };

    // Open edit site modal
    const handleEditSite = (s: ManagedSite) => {
        setEditingSite(s);
        setSiteName(s.name || "");
        setSiteError(null);
        setShowSiteModal(true);
    };

    // Save site (create or update)
    const handleSaveSite = async () => {
        if (!siteName.trim()) {
            setSiteError("El nombre del sitio es requerido");
            return;
        }

        setSiteSaving(true);
        setSiteError(null);

        try {
            const isEdit = !!editingSite;
            const payload: any = { name: siteName.trim() };

            if (isEdit) {
                payload.id = editingSite!.id;
            }

            const response = await fetch('/api/sites', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                setShowSiteModal(false);
                await fetchSites();
                showFeedback('success', isEdit ? '✅ Sitio actualizado correctamente' : '✅ Sitio creado correctamente');
            } else {
                const err = await response.json();
                setSiteError(err.error || 'Error al guardar el sitio');
            }
        } catch (error) {
            setSiteError('Error de conexión');
        } finally {
            setSiteSaving(false);
        }
    };

    // Delete site
    const handleDeleteSite = async () => {
        if (!confirmDeleteSite) return;

        try {
            const response = await fetch(`/api/sites?id=${confirmDeleteSite.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                await fetchSites();
                showFeedback('success', `✅ Sitio eliminado correctamente`);
            } else {
                const err = await response.json();
                showFeedback('error', err.error || 'Error al eliminar el sitio');
            }
        } catch (error) {
            showFeedback('error', 'Error de conexión');
        } finally {
            setConfirmDeleteSite(null);
        }
    };

    const handleNextLogsPage = () => {
        if (logsPage < logsTotalPages) fetchLogs(logsPage + 1);
    };

    const handlePrevLogsPage = () => {
        if (logsPage > 1) fetchLogs(logsPage - 1);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return language === 'es' ? 'Nunca' : 'Never';
        const d = new Date(dateStr);
        return d.toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + d.toLocaleTimeString(language === 'es' ? 'es-AR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
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
                            ⚙️ {language === 'es' ? 'Configuración General' : 'General Settings'}
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
                            onClick={() => setActiveTab('users')}
                        >
                            👥 {language === 'es' ? 'Administración de Usuarios' : 'User Management'}
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'sites' ? styles.active : ''}`}
                            onClick={() => setActiveTab('sites')}
                        >
                            🏢 {language === 'es' ? 'Admin. de Sitios' : 'Site Management'}
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'logs' ? styles.active : ''}`}
                            onClick={() => setActiveTab('logs')}
                        >
                            📜 {language === 'es' ? 'Logs del Sistema' : 'System Logs'}
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'messaging' ? styles.active : ''}`}
                            onClick={() => setActiveTab('messaging')}
                        >
                            🧪 {language === 'es' ? 'Tests de Mensajería' : 'Messaging Tests'}
                        </button>
                    </div>
                </div>

                <div className={styles.content}>
                    {/* Configuración General Tab */}
                    {activeTab === 'general' && (
                        <div className={styles.section}>
                            <h2>⚙️ {language === 'es' ? 'Configuración General' : 'General Settings'}</h2>
                            <p className={styles.sectionDescription}>
                                {language === 'es' ? 'Personaliza la apariencia y preferencias de la aplicación' : 'Customize the appearance and preferences of the application'}
                            </p>

                            <div className={styles.settingsList}>
                                {/* Modo Oscuro/Claro */}
                                <div className={styles.settingItem}>
                                    <div className={styles.settingInfo}>
                                        <span className={styles.settingLabel}>🌓 {language === 'es' ? 'Modo de Apariencia' : 'Appearance Mode'}</span>
                                        <span className={styles.settingDescription}>
                                            {language === 'es' ? 'Elige entre modo claro u oscuro' : 'Choose between light or dark mode'}
                                        </span>
                                    </div>
                                    <div className={styles.settingControl}>
                                        <div className={styles.toggleGroup}>
                                            <button
                                                className={`${styles.toggleOption} ${theme === 'light' ? styles.toggleActive : ''}`}
                                                onClick={() => setTheme('light')}
                                            >
                                                ☀️ {language === 'es' ? 'Claro' : 'Light'}
                                            </button>
                                            <button
                                                className={`${styles.toggleOption} ${theme === 'dark' ? styles.toggleActive : ''}`}
                                                onClick={() => setTheme('dark')}
                                            >
                                                🌙 {language === 'es' ? 'Oscuro' : 'Dark'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Selector de Idioma */}
                                <div className={styles.settingItem}>
                                    <div className={styles.settingInfo}>
                                        <span className={styles.settingLabel}>🌐 {language === 'es' ? 'Idioma' : 'Language'}</span>
                                        <span className={styles.settingDescription}>
                                            {language === 'es' ? 'Selecciona el idioma de la aplicación' : 'Select the application language'}
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
                                        <span className={styles.settingLabel}>👁️ {language === 'es' ? 'Filtros de Visualización' : 'Display Filters'}</span>
                                        <span className={styles.settingDescription}>
                                            {language === 'es' ? 'Controla qué usuarios se muestran en el calendario' : 'Control which users are shown in the calendar'}
                                        </span>
                                    </div>
                                    <div className={styles.settingControl}>
                                        <div className={styles.toggleGroup}>
                                            <button
                                                className={`${styles.toggleOption} ${showOnlyActiveUsers ? styles.toggleActive : ''}`}
                                                onClick={() => setShowOnlyActiveUsers(true)}
                                            >
                                                👤 {language === 'es' ? 'Solo usuarios no bloqueados' : 'Only unblocked users'}
                                            </button>
                                            <button
                                                className={`${styles.toggleOption} ${!showOnlyActiveUsers ? styles.toggleActive : ''}`}
                                                onClick={() => setShowOnlyActiveUsers(false)}
                                            >
                                                👥 {language === 'es' ? 'Todos los usuarios' : 'All users'}
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
                            <h2>👥 {language === 'es' ? 'Administración de Usuarios' : 'User Management'}</h2>
                            <p className={styles.sectionDescription}>
                                {language === 'es' ? 'Gestión de usuarios del sistema' : 'System user management'}
                            </p>

                            {feedback && (
                                <div className={`${styles.feedbackMessage} ${feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}`}>
                                    {feedback.message}
                                </div>
                            )}

                            {/* User Counter */}
                            <div className={styles.userCounterCard}>
                                <span className={styles.userCounterLabel}>{language === 'es' ? 'Usuarios registrados' : 'Registered users'}</span>
                                <div className={styles.userCounterBadge}>
                                    {usersLoading ? '…' : users.length}
                                </div>
                            </div>

                            {/* Toolbar */}
                            <div className={styles.toolbar}>
                                <input
                                    type="text"
                                    placeholder={language === 'es' ? "🔍 Buscar por nombre, email o teléfono..." : "🔍 Search by name, email or phone..."}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={styles.searchInput}
                                />
                                <button
                                    className={styles.createButton}
                                    onClick={handleCreateUser}
                                >
                                    ➕ {language === 'es' ? 'Crear Usuario' : 'Create User'}
                                </button>
                            </div>

                            {/* Search results count */}
                            {!usersLoading && searchQuery.trim() && (
                                <div className={styles.userCount}>
                                    {filteredUsers.length} {language === 'es' ? 'resultado' : 'result'}{filteredUsers.length !== 1 ? 's' : ''} {language === 'es' ? 'para' : 'for'} &quot;{searchQuery}&quot;
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
                                        {searchQuery ? (language === 'es' ? 'Sin resultados' : 'No results') : (language === 'es' ? 'No hay usuarios' : 'No users')}
                                    </div>
                                    <div className={styles.emptyDescription}>
                                        {searchQuery
                                            ? (language === 'es' ? `No se encontraron usuarios para "${searchQuery}"` : `No users found for "${searchQuery}"`)
                                            : (language === 'es' ? 'Crea el primer usuario con el botón de arriba' : 'Create the first user with the button above')
                                        }
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.usersTableWrapper}>
                                    <table className={styles.usersTable}>
                                        <thead>
                                            <tr>
                                                <th>{language === 'es' ? 'Nombre' : 'Name'}</th>
                                                <th>Email</th>
                                                <th>{language === 'es' ? 'Teléfono' : 'Phone'}</th>
                                                <th>{language === 'es' ? 'Rol' : 'Role'}</th>
                                                <th>{language === 'es' ? 'Estado' : 'Status'}</th>
                                                <th>{language === 'es' ? 'Último Login' : 'Last Login'}</th>
                                                <th>{language === 'es' ? 'Acciones' : 'Actions'}</th>
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
                                                            {u.roleName || (language === 'es' ? `Rol ${u.roleId}` : `Role ${u.roleId}`)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`${styles.badge} ${u.isBlocked ? styles.badgeBlocked : styles.badgeActive}`}>
                                                            {u.isBlocked ? (language === 'es' ? '🚫 Bloqueado' : '🚫 Blocked') : (language === 'es' ? '✅ Activo' : '✅ Active')}
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
                                                                    title={language === 'es' ? 'Editar usuario' : 'Edit user'}
                                                                >
                                                                    ✏️ {language === 'es' ? 'Editar' : 'Edit'}
                                                                </button>
                                                            ) : (
                                                                <button className={styles.editButton} disabled style={{ opacity: 0.3, cursor: 'not-allowed' }} title={language === 'es' ? 'Sin permisos' : 'No permissions'}>
                                                                    ✏️ {language === 'es' ? 'Editar' : 'Edit'}
                                                                </button>
                                                            )}
                                                            {canBlockUser(u) && (
                                                                u.isBlocked ? (
                                                                    <button
                                                                        className={styles.unblockButton}
                                                                        onClick={() => setConfirmAction({ user: u, action: 'unblock' })}
                                                                        title={language === 'es' ? 'Desbloquear usuario' : 'Unblock user'}
                                                                    >
                                                                        🔓 {language === 'es' ? 'Activar' : 'Activate'}
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        className={styles.blockButton}
                                                                        onClick={() => setConfirmAction({ user: u, action: 'block' })}
                                                                        title={language === 'es' ? 'Bloquear usuario' : 'Block user'}
                                                                    >
                                                                        🔒 {language === 'es' ? 'Bloquear' : 'Block'}
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
                            <h2>📜 {language === 'es' ? 'Logs del Sistema' : 'System Logs'}</h2>
                            <p className={styles.sectionDescription}>
                                {language === 'es' ? 'Seguimiento de eventos y auditoría de la plataforma' : 'Event tracking and platform auditing'}
                            </p>
                            <div className={styles.placeholder} style={{ marginTop: '20px', padding: '0', background: 'transparent', textAlign: 'left', border: 'none' }}>
                                {logsLoading ? (
                                    <div className={styles.loadingTable}>
                                        <div className={styles.spinner}></div>
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <div className={styles.emptyIcon}>📜</div>
                                        <div className={styles.emptyTitle}>
                                            {language === 'es' ? 'No hay logs registrados' : 'No logs recorded'}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className={styles.usersTableWrapper}>
                                            <table className={styles.usersTable}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '200px' }}>{language === 'es' ? 'Fecha y Hora' : 'Date & Time'}</th>
                                                        <th style={{ width: '250px' }}>{language === 'es' ? 'Usuario' : 'User'}</th>
                                                        <th>{language === 'es' ? 'Acción' : 'Action'}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {logs.map((log) => (
                                                        <tr key={log.id}>
                                                            <td>
                                                                <span className={styles.lastLoginText} style={{ whiteSpace: 'nowrap' }}>
                                                                    {formatDateTime(log.createddate)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={styles.userName}>
                                                                    {log.user.firstname} {log.user.lastname}
                                                                </span>
                                                                <div className={styles.userEmail} style={{ fontSize: '12px' }}>
                                                                    {log.user.email}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className={styles.logActionCell}>
                                                                    {log.action}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Logs Pagination */}
                                        <div className={styles.toolbar} style={{ justifyContent: 'space-between', marginTop: '16px', borderTop: 'none', padding: '0' }}>
                                            <div style={{ fontSize: '14px', color: '#64748b' }}>
                                                {language === 'es' ? 'Página' : 'Page'} {logsPage} {language === 'es' ? 'de' : 'of'} {logsTotalPages}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    className={styles.modalCancelButton}
                                                    onClick={handlePrevLogsPage}
                                                    disabled={logsPage <= 1 || logsLoading}
                                                    style={{ padding: '6px 12px' }}
                                                >
                                                    {language === 'es' ? 'Anterior' : 'Previous'}
                                                </button>
                                                <button
                                                    className={styles.modalCancelButton}
                                                    onClick={handleNextLogsPage}
                                                    disabled={logsPage >= logsTotalPages || logsLoading}
                                                    style={{ padding: '6px 12px' }}
                                                >
                                                    {language === 'es' ? 'Siguiente' : 'Next'}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tests de Mensajería Tab */}
                    {activeTab === 'messaging' && (
                        <div className={styles.section}>
                            <h2>🧪 {language === 'es' ? 'Tests de Mensajería' : 'Messaging Tests'}</h2>
                            <p className={styles.sectionDescription}>
                                {language === 'es' ? 'Herramientas para probar el sistema de mensajes y notificaciones push' : 'Tools to test the messaging system and push notifications'}
                            </p>

                            {greeting && (
                                <div className={styles.greeting}>
                                    {greeting}
                                </div>
                            )}

                            {/* Botones de saludo rápido */}
                            <div className={styles.quickTests}>
                                <h3>{language === 'es' ? 'Pruebas Rápidas' : 'Quick Tests'}</h3>
                                <div className={styles.buttonGrid}>
                                    <button
                                        className={styles.testButton}
                                        onClick={() => handleSaludar(0)}
                                    >
                                        👋 {language === 'es' ? 'Saludar a Francisco' : 'Greet Francisco'}
                                    </button>
                                    <button
                                        className={styles.testButton}
                                        onClick={() => handleSaludar(1)}
                                    >
                                        👋 {language === 'es' ? 'Saludar a Usuario Test' : 'Greet Test User'}
                                    </button>
                                </div>
                            </div>

                            {/* Formulario personalizado */}
                            <div className={styles.customMessage}>
                                <h3>{language === 'es' ? 'Mensaje Personalizado' : 'Custom Message'}</h3>
                                <div className={styles.formGroup}>
                                    <label>{language === 'es' ? 'Email destinatario:' : 'Recipient email:'}</label>
                                    <input
                                        type="email"
                                        value={customEmail}
                                        onChange={(e) => setCustomEmail(e.target.value)}
                                        placeholder="ejemplo@gmail.com"
                                        className={styles.input}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>{language === 'es' ? 'Título del mensaje:' : 'Message title:'}</label>
                                    <input
                                        type="text"
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        placeholder={language === 'es' ? "Título del mensaje" : "Message title"}
                                        className={styles.input}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>{language === 'es' ? 'Contenido:' : 'Content:'}</label>
                                    <textarea
                                        value={customBody}
                                        onChange={(e) => setCustomBody(e.target.value)}
                                        placeholder={language === 'es' ? "Escribe tu mensaje aquí..." : "Write your message here..."}
                                        className={styles.textarea}
                                        rows={4}
                                    />
                                </div>

                                <div className={styles.actionButtons}>
                                    <button
                                        className={styles.sendButton}
                                        onClick={handleSendMessage}
                                    >
                                        📤 {language === 'es' ? 'Enviar Mensaje' : 'Send Message'}
                                    </button>
                                    <button
                                        className={styles.testButton}
                                        onClick={() => handleSaludar(-1)}
                                    >
                                        👋 {language === 'es' ? 'Enviar Saludo' : 'Send Greeting'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Administración de Sitios Tab */}
                    {activeTab === 'sites' && (
                        <div className={styles.section}>
                            <h2>🏢 {language === 'es' ? 'Administración de Sitios' : 'Site Management'}</h2>
                            <p className={styles.sectionDescription}>
                                {language === 'es' ? 'Gestión de los sitios / locations del sistema' : 'Management of system sites / locations'}
                            </p>

                            {feedback && (
                                <div className={`${styles.feedbackMessage} ${feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}`}>
                                    {feedback.message}
                                </div>
                            )}

                            {/* Toolbar */}
                            <div className={styles.toolbar}>
                                <div style={{ flex: 1 }}></div>
                                <button
                                    className={styles.createButton}
                                    onClick={handleCreateSite}
                                >
                                    ➕ {language === 'es' ? 'Crear Sitio' : 'Create Site'}
                                </button>
                            </div>

                            {/* Sites table */}
                            {sitesLoading ? (
                                <div className={styles.loadingTable}>
                                    <div className={styles.spinner}></div>
                                </div>
                            ) : sites.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyIcon}>🏢</div>
                                    <div className={styles.emptyTitle}>
                                        {language === 'es' ? 'No hay sitios' : 'No sites'}
                                    </div>
                                    <div className={styles.emptyDescription}>
                                        {language === 'es' ? 'Crea el primer sitio con el botón de arriba' : 'Create the first site using the button above'}
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.usersTableWrapper}>
                                    <table className={styles.usersTable}>
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>{language === 'es' ? 'Nombre' : 'Name'}</th>
                                                <th>{language === 'es' ? 'Acciones' : 'Actions'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sites.map((s) => (
                                                <tr key={s.id}>
                                                    <td>
                                                        <span className={styles.userEmail}>#{s.id}</span>
                                                    </td>
                                                    <td>
                                                        <span className={styles.userName}>
                                                            {s.name}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className={styles.actionsCell}>
                                                            <button
                                                                className={styles.editButton}
                                                                onClick={() => handleEditSite(s)}
                                                                title={language === 'es' ? 'Editar sitio' : 'Edit site'}
                                                            >
                                                                ✏️ {language === 'es' ? 'Editar' : 'Edit'}
                                                            </button>
                                                            <button
                                                                className={styles.blockButton}
                                                                onClick={() => setConfirmDeleteSite(s)}
                                                                title={language === 'es' ? 'Eliminar sitio' : 'Delete site'}
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ marginRight: '4px', verticalAlign: 'text-bottom' }}>
                                                                    <path d="M3 6h18" />
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                    <line x1="10" y1="11" x2="10" y2="17" />
                                                                    <line x1="14" y1="11" x2="14" y2="17" />
                                                                </svg>
                                                                {language === 'es' ? 'Eliminar' : 'Delete'}
                                                            </button>
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
                </div>
            </main>

            {/* Create/Edit User Modal */}
            {showUserModal && (
                <div className={styles.modalOverlay} onClick={() => setShowUserModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalTitle}>
                            {editingUser ? (language === 'es' ? '✏️ Editar Usuario' : '✏️ Edit User') : (language === 'es' ? '➕ Crear Usuario' : '➕ Create User')}
                        </div>
                        <div className={styles.modalForm}>
                            <div className={styles.modalFormRow}>
                                <div className={styles.modalField}>
                                    <label>{language === 'es' ? 'Nombre *' : 'First Name *'}</label>
                                    <input
                                        type="text"
                                        value={formData.firstName}
                                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                        placeholder={language === 'es' ? "Nombre" : "First Name"}
                                    />
                                </div>
                                <div className={styles.modalField}>
                                    <label>{language === 'es' ? 'Apellido *' : 'Last Name *'}</label>
                                    <input
                                        type="text"
                                        value={formData.lastName}
                                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                        placeholder={language === 'es' ? "Apellido" : "Last Name"}
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
                                    <label>{language === 'es' ? 'Teléfono' : 'Phone'}</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+54 11 1234-5678"
                                    />
                                </div>
                                <div className={styles.modalField}>
                                    <label>{language === 'es' ? 'Rol' : 'Role'}</label>
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
                                                {editingUser.roleName ?? (language === 'es' ? `Rol ${editingUser.roleId}` : `Role ${editingUser.roleId}`)}
                                                <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.7 }}>({language === 'es' ? 'no editable' : 'not editable'})</span>
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
                                            {editingUser?.roleName ?? roles.find(r => r.id === formData.roleId)?.name ?? (language === 'es' ? `Rol ${formData.roleId}` : `Role ${formData.roleId}`)}
                                            <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.7 }}>({language === 'es' ? 'no editable' : 'not editable'})</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.modalField}>
                                <label>{editingUser ? (language === 'es' ? 'Contraseña (dejar vacío para no cambiar)' : 'Password (leave blank to keep current)') : (language === 'es' ? 'Contraseña *' : 'Password *')}</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder={editingUser ? '••••••••' : (language === 'es' ? 'Ingresa una contraseña' : 'Enter a password')}
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
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    className={styles.modalSaveButton}
                                    onClick={handleSaveUser}
                                    disabled={formSaving}
                                >
                                    {formSaving ? (language === 'es' ? 'Guardando...' : 'Saving...') : (editingUser ? (language === 'es' ? 'Guardar Cambios' : 'Save Changes') : (language === 'es' ? 'Crear Usuario' : 'Create User'))}
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
                            {confirmAction.action === 'block' ? (language === 'es' ? '¿Bloquear usuario?' : 'Block user?') : (language === 'es' ? '¿Desbloquear usuario?' : 'Unblock user?')}
                        </div>
                        <div className={styles.confirmMessage}>
                            {confirmAction.action === 'block'
                                ? (language === 'es' ? `${confirmAction.user.firstName} ${confirmAction.user.lastName} no podrá iniciar sesión mientras esté bloqueado.` : `${confirmAction.user.firstName} ${confirmAction.user.lastName} will not be able to log in while blocked.`)
                                : (language === 'es' ? `${confirmAction.user.firstName} ${confirmAction.user.lastName} volverá a poder iniciar sesión.` : `${confirmAction.user.firstName} ${confirmAction.user.lastName} will be able to log in again.`)
                            }
                        </div>
                        <div className={styles.confirmActions}>
                            <button
                                className={styles.modalCancelButton}
                                onClick={() => setConfirmAction(null)}
                            >
                                {language === 'es' ? 'Cancelar' : 'Cancel'}
                            </button>
                            {confirmAction.action === 'block' ? (
                                <button
                                    className={styles.confirmDangerButton}
                                    onClick={handleToggleBlock}
                                >
                                    {language === 'es' ? 'Bloquear' : 'Block'}
                                </button>
                            ) : (
                                <button
                                    className={styles.confirmSuccessButton}
                                    onClick={handleToggleBlock}
                                >
                                    {language === 'es' ? 'Desbloquear' : 'Unblock'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit Site Modal */}
            {showSiteModal && (
                <div className={styles.modalOverlay} onClick={() => setShowSiteModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalTitle}>
                            {editingSite ? (language === 'es' ? '✏️ Editar Sitio' : '✏️ Edit Site') : (language === 'es' ? '➕ Crear Sitio' : '➕ Create Site')}
                        </div>
                        <div className={styles.modalForm}>
                            <div className={styles.modalField}>
                                <label>{language === 'es' ? 'Nombre del Sitio *' : 'Site Name *'}</label>
                                <input
                                    type="text"
                                    value={siteName}
                                    onChange={(e) => setSiteName(e.target.value)}
                                    placeholder={language === 'es' ? "Ej: Sede Central" : "Ex: Main Office"}
                                />
                            </div>

                            {siteError && (
                                <div className={styles.modalError}>{siteError}</div>
                            )}

                            <div className={styles.modalActions}>
                                <button
                                    className={styles.modalCancelButton}
                                    onClick={() => setShowSiteModal(false)}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    className={styles.modalSaveButton}
                                    onClick={handleSaveSite}
                                    disabled={siteSaving}
                                >
                                    {siteSaving ? (language === 'es' ? 'Guardando...' : 'Saving...') : (editingSite ? (language === 'es' ? 'Guardar Cambios' : 'Save Changes') : (language === 'es' ? 'Crear Sitio' : 'Create Site'))}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Site Modal */}
            {confirmDeleteSite && (
                <div className={styles.modalOverlay} onClick={() => setConfirmDeleteSite(null)}>
                    <div className={`${styles.modalContent} ${styles.confirmModal}`} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.confirmIcon}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32" style={{ color: 'var(--danger)' }}>
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                        </div>
                        <div className={styles.confirmTitle}>
                            {language === 'es' ? '¿Eliminar sitio?' : 'Delete site?'}
                        </div>
                        <div className={styles.confirmMessage}>
                            {language === 'es' ? '¿Estás seguro de que deseas eliminar el sitio' : 'Are you sure you want to delete the site'} <strong>{confirmDeleteSite.name}</strong>?
                            <br />
                            {language === 'es' ? 'Esta acción fallará si el sitio tiene turnos o posiciones asociados.' : 'This action will fail if the site has associated shifts or positions.'}
                        </div>
                        <div className={styles.confirmActions}>
                            <button
                                className={styles.modalCancelButton}
                                onClick={() => setConfirmDeleteSite(null)}
                            >
                                {language === 'es' ? 'Cancelar' : 'Cancel'}
                            </button>
                            <button
                                className={styles.confirmDangerButton}
                                onClick={handleDeleteSite}
                            >
                                {language === 'es' ? 'Eliminar' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}