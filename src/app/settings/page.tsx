"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
    siteIds: number[];
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
    siteIds: number[];
}

const emptyForm: UserFormData = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    roleId: 2, // Default to Regular
    siteIds: [],
};

export default function SettingsPage() {
    const { user, isLoading, updateUser } = useAuth();
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
    const [userViewFilter, setUserViewFilter] = useState<'active' | 'blocked' | 'all'>('all');

    // Logs state
    const [logs, setLogs] = useState<Log[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsPage, setLogsPage] = useState(1);
    const [logsTotalPages, setLogsTotalPages] = useState(1);
    const [logsSearchQuery, setLogsSearchQuery] = useState("");

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
    const [showBulkMenu, setShowBulkMenu] = useState(false);
    const bulkMenuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [bulkUploadError, setBulkUploadError] = useState<string | null>(null);
    const [bulkUploadSuccess, setBulkUploadSuccess] = useState<string | null>(null);
    const [isUploadingBulk, setIsUploadingBulk] = useState(false);

    // Support Contact Modal State
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactFormData, setContactFormData] = useState({
        fullName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "",
        email: user?.email || "",
        phone: (user as any)?.phone || "",
        category: "General Inquiry",
        message: ""
    });
    const [captchaCode, setCaptchaCode] = useState("");
    const [captchaInput, setCaptchaInput] = useState("");
    const [isSendingContact, setIsSendingContact] = useState(false);
    const [contactError, setContactError] = useState<string | null>(null);

    // Generate Captcha
    const generateCaptcha = useCallback(() => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        let result = "";
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCaptchaCode(result);
        setCaptchaInput("");
    }, []);

    useEffect(() => {
        if (showContactModal) {
            generateCaptcha();
            setContactFormData({
                fullName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "",
                email: user?.email || "",
                phone: (user as any)?.phone || "",
                category: language === 'es' ? "Consulta General" : "General Inquiry",
                message: ""
            });
            setContactError(null);
        }
    }, [showContactModal, user, language, generateCaptcha]);

    // Close bulk menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (bulkMenuRef.current && !bulkMenuRef.current.contains(event.target as Node)) {
                setShowBulkMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset inputs and state
        setBulkUploadError(null);
        setBulkUploadSuccess(null);
        setIsUploadingBulk(true);
        setShowBulkMenu(false);

        const formData = new FormData();
        formData.append('file', file);
        if (user?.id) {
            formData.append('callerUserId', user.id.toString());
        }
        if (user?.companyId) {
            formData.append('companyId', user.companyId.toString());
        }

        try {
            const response = await fetch('/api/users/bulk', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                setBulkUploadSuccess(result.message);
                await fetchUsers(); // Refresh the list
            } else {
                setBulkUploadError(result.error || (language === 'es' ? 'Error desconocido al procesar el archivo' : 'Unknown error processing file'));
            }
        } catch (error) {
            console.error('Upload error:', error);
            setBulkUploadError(language === 'es' ? 'Error de conexión al servidor' : 'Server connection error');
        } finally {
            setIsUploadingBulk(false);
            // Clear the input so the same file can be selected again if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const validatePassword = (pass: string) => {
        return {
            length: pass.length >= 8,
            upper: /[A-Z]/.test(pass),
            lower: /[a-z]/.test(pass),
            number: /[0-9]/.test(pass),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(pass)
        };
    };

    const isPasswordValid = (pass: string) => {
        const v = validatePassword(pass);
        return v.length && v.upper && v.lower && v.number && v.special;
    };

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
            const response = await fetch(`/api/roles?companyId=${user?.companyId || ''}`);
            if (response.ok) {
                const data = await response.json();
                setRoles(data);
                // Set default roleId to first available role
                if (data.length > 0) {
                    setFormData(prev => ({ ...prev, roleId: 2 }));
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
            const response = await fetch(`/api/users?includeBlocked=true&companyId=${user?.companyId || ''}`, { cache: 'no-store' });
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
        if (!user) return;
        setSitesLoading(true);
        try {
            const response = await fetch(`/api/sites?userId=${user.id}&roleId=${user.roleId}&companyId=${user.companyId || ''}`, { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                setSites(data);
            }
        } catch (error) {
            console.error('Error fetching sites:', error);
        } finally {
            setSitesLoading(false);
        }
    }, [user]);

    // Fetch logs
    const fetchLogs = useCallback(async (page = 1, search = "") => {
        setLogsLoading(true);
        try {
            const url = `/api/logs?page=${page}&limit=50&companyId=${user?.companyId || ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
            const response = await fetch(url, { cache: 'no-store' });
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
            fetchSites(); // Fetch sites so they are available in the User Modal
            if (roles.length === 0) fetchRoles();
        } else if (activeTab === 'sites') {
            fetchSites();
        } else if (activeTab === 'logs') {
            // Delay fetching when typing log search query
            const delayDebounceFn = setTimeout(() => {
                fetchLogs(1, logsSearchQuery);
            }, 400);
            return () => clearTimeout(delayDebounceFn);
        }
    }, [activeTab, fetchUsers, fetchRoles, roles.length, fetchSites, fetchLogs, logsSearchQuery]);

    const showFeedback = (type: 'success' | 'error', message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    // Filtered users based on view filter + search
    const filteredUsers = users.filter(u => {
        // Apply view filter first
        if (userViewFilter === 'active' && u.isBlocked) return false;
        if (userViewFilter === 'blocked' && !u.isBlocked) return false;

        // Then apply search
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;

        const words = query.split(/\s+/);
        const fullName = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
        const email = (u.email || "").toLowerCase();
        const phone = (u.phone || "").toLowerCase();

        // All words in the query must match at least one field
        return words.every(word =>
            fullName.includes(word) ||
            email.includes(word) ||
            phone.includes(word)
        );
    });

    const displayedUsersCount = userViewFilter === 'active'
        ? users.filter(u => !u.isBlocked).length
        : userViewFilter === 'blocked'
            ? users.filter(u => u.isBlocked).length
            : users.length;

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
        // Find if role 2 is available, otherwise default to first available
        const defaultRole = availableRoles.find(r => r.id === 2)?.id ?? (availableRoles[0]?.id ?? 2);
        setFormData({ ...emptyForm, roleId: defaultRole });
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
            siteIds: u.siteIds || [],
        });
        setFormError(null);
        setShowUserModal(true);
    };

    // Save user (create or update)
    const handleSaveUser = async () => {
        if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
            setFormError(language === 'es' ? "Nombre, apellido y email son requeridos" : "First name, last name and email are required");
            return;
        }

        if (!editingUser && !formData.password.trim()) {
            setFormError(language === 'es' ? "La contraseña es requerida para nuevos usuarios" : "Password is required for new users");
            return;
        }

        if (formData.password.trim() && !isPasswordValid(formData.password)) {
            setFormError(language === 'es' ? "La contraseña no cumple con los requisitos de seguridad" : "Password does not meet security requirements");
            return;
        }

        if (formData.roleId === 1 && formData.siteIds.length === 0) {
            setFormError(language === 'es' ? '⚠️ Debes seleccionar al menos un sitio para el Admin' : '⚠️ You must select at least one site for the Admin');
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
                companyId: user?.companyId
            };

            if (isEdit) {
                payload.id = editingUser!.id;
            }
            // Only send roleId if the logged-in user is the owner (admins can't change roles)
            if (user?.roleId === 0 && editingUser?.id !== user?.id) {
                payload.roleId = formData.roleId;
                // Only send siteIds if the role is Admin (1)
                if (formData.roleId === 1) {
                    payload.siteIds = formData.siteIds;
                }
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
                // If it's the current user being edited, update AuthContext
                if (isEdit && editingUser?.id === user?.id && updateUser) {
                    updateUser({
                        firstName: payload.firstName,
                        lastName: payload.lastName,
                        email: payload.email
                    });
                }

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

    const handleSendContact = async () => {
        if (!contactFormData.fullName.trim() || !contactFormData.email.trim() || !contactFormData.message.trim()) {
            setContactError(language === 'es' ? "Nombre, email y mensaje son requeridos" : "Name, email and message are required");
            return;
        }

        if (captchaInput !== captchaCode) {
            setContactError(language === 'es' ? "Código de verificación incorrecto" : "Incorrect verification code");
            return;
        }

        setIsSendingContact(true);
        setContactError(null);

        try {
            const response = await fetch('/api/support/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contactFormData),
            });

            if (response.ok) {
                showFeedback('success', language === 'es' ? "¡Mensaje enviado!" : "Message sent!");
                setShowContactModal(false);
            } else {
                const data = await response.json();
                setContactError(data.error || (language === 'es' ? "Error al enviar el mensaje" : "Failed to send message"));
            }
        } catch (error) {
            console.error('Error sending contact form:', error);
            setContactError(language === 'es' ? "Error de conexión" : "Connection error");
        } finally {
            setIsSendingContact(false);
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
                body: JSON.stringify({ id: targetUser.id, isBlocked: newBlocked, callerUserId: user?.id, companyId: user?.companyId }),
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
            const payload: any = { name: siteName.trim(), callerUserId: user?.id, companyId: user?.companyId };

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
            const response = await fetch(`/api/sites?id=${confirmDeleteSite.id}&callerUserId=${user?.id}&companyId=${user?.companyId || ''}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                await fetchSites();
                showFeedback('success', language === 'es' ? `✅ Sitio eliminado correctamente` : `✅ Site deleted successfully`);
            } else {
                const err = await response.json();
                let errorMessage = err.error || (language === 'es' ? 'Error al eliminar el sitio' : 'Error deleting site');

                // Translate specific conflict error from API if it contains typical keywords
                if (errorMessage.includes('No se puede eliminar el sitio porque tiene')) {
                    const shiftsCount = errorMessage.match(/(\d+) turnos/) ? errorMessage.match(/(\d+) turnos/)![1] : '0';
                    const positionsCount = errorMessage.match(/(\d+) posiciones/) ? errorMessage.match(/(\d+) posiciones/)![1] : '0';
                    errorMessage = language === 'es'
                        ? `No se puede eliminar el sitio porque tiene ${shiftsCount} turnos y ${positionsCount} posiciones asociados.`
                        : `Cannot delete site because it has ${shiftsCount} shifts and ${positionsCount} positions associated.`;
                }

                showFeedback('error', errorMessage);
            }
        } catch (error) {
            showFeedback('error', language === 'es' ? 'Error de conexión' : 'Connection error');
        } finally {
            setConfirmDeleteSite(null);
        }
    };

    const handleNextLogsPage = () => {
        if (logsPage < logsTotalPages) fetchLogs(logsPage + 1, logsSearchQuery);
    };

    const handlePrevLogsPage = () => {
        if (logsPage > 1) fetchLogs(logsPage - 1, logsSearchQuery);
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
                    body: customBody,
                    companyId: user?.companyId
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
                    body: `${user?.firstName} te ha enviado un saludo desde la aplicación web 👋 (Usuario ${userId})`,
                    companyId: user?.companyId
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
                        {user?.roleId === 0 && (
                            <button
                                className={`${styles.tab} ${activeTab === 'sites' ? styles.active : ''}`}
                                onClick={() => setActiveTab('sites')}
                            >
                                🏢 {language === 'es' ? 'Admin. de Sitios' : 'Site Management'}
                            </button>
                        )}
                        {user?.roleId === 0 && (
                            <button
                                className={`${styles.tab} ${activeTab === 'logs' ? styles.active : ''}`}
                                onClick={() => setActiveTab('logs')}
                            >
                                📜 {language === 'es' ? 'Logs del Sistema' : 'System Logs'}
                            </button>
                        )}
                        {user?.roleId === 0 && (
                            <button
                                className={`${styles.tab} ${activeTab === 'messaging' ? styles.active : ''}`}
                                onClick={() => setActiveTab('messaging')}
                            >
                                🧪 {language === 'es' ? 'Tests de Mensajería' : 'Messaging Tests'}
                            </button>
                        )}
                        <button
                            className={`${styles.tab} ${activeTab === 'help' ? styles.active : ''}`}
                            onClick={() => setActiveTab('help')}
                        >
                            📩 {language === 'es' ? 'Ayuda y Soporte' : 'Help & Support'}
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
                                {/* Información de la Empresa */}
                                <div className={styles.settingItem}>
                                    <div className={styles.settingInfo}>
                                        <span className={styles.settingLabel}>🏢 {language === 'es' ? 'Empresa Actual' : 'Current Company'}</span>
                                        <span className={styles.settingDescription}>
                                            {language === 'es' ? 'Estás visualizando los datos de esta compañía' : 'You are currently viewing data for this company'}
                                        </span>
                                    </div>
                                    <div className={styles.settingControl}>
                                        <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                                            {user?.companyName || (language === 'es' ? 'Empresa Principal' : 'Default Company')}
                                        </span>
                                    </div>
                                </div>
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
                        <div className={styles.wideContainer}>
                            <div className={styles.section}>
                                <h2>👥 {language === 'es' ? 'Administración de Usuarios' : 'User Management'}</h2>
                                <p className={styles.sectionDescription}>
                                    {language === 'es' ? 'Gestión de usuarios del sistema' : 'System user management'}
                                </p>

                                {isUploadingBulk && (
                                    <div className={styles.feedbackMessage} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                        <div className={styles.spinner} style={{ width: '16px', height: '16px', borderTopColor: '#3b82f6', marginRight: '8px' }}></div>
                                        {language === 'es' ? 'Procesando carga masiva... Por favor espera.' : 'Processing bulk upload... Please wait.'}
                                    </div>
                                )}

                                {feedback && (
                                    <div className={`${styles.feedbackMessage} ${feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}`}>
                                        {feedback.message}
                                    </div>
                                )}

                                {bulkUploadSuccess && (
                                    <div className={`${styles.feedbackMessage} ${styles.feedbackSuccess}`}>
                                        {bulkUploadSuccess}
                                    </div>
                                )}

                                {bulkUploadError && (
                                    <div className={`${styles.feedbackMessage} ${styles.feedbackError}`}>
                                        {bulkUploadError}
                                    </div>
                                )}

                                {/* User Counter */}
                                <div className={styles.userCounterCard}>
                                    <span className={styles.userCounterLabel}>
                                        {userViewFilter === 'active'
                                            ? (language === 'es' ? 'Usuarios activos' : 'Active users')
                                            : userViewFilter === 'blocked'
                                                ? (language === 'es' ? 'Usuarios bloqueados' : 'Blocked users')
                                                : (language === 'es' ? 'Todos los usuarios' : 'All users')}
                                    </span>
                                    <div className={styles.userCounterActions}>
                                        <button
                                            className={styles.counterActionBtn}
                                            onClick={() => {
                                                setUserViewFilter(prev =>
                                                    prev === 'active' ? 'blocked' : prev === 'blocked' ? 'all' : 'active'
                                                );
                                            }}
                                            title={language === 'es' ? 'Cambiar filtro de usuarios' : 'Change user filter'}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                {userViewFilter === 'active' ? (
                                                    <>
                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                        <circle cx="12" cy="7" r="4" />
                                                    </>
                                                ) : userViewFilter === 'blocked' ? (
                                                    <>
                                                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                        <circle cx="8.5" cy="7" r="4" />
                                                        <line x1="18" y1="8" x2="23" y2="13" />
                                                        <line x1="23" y1="8" x2="18" y2="13" />
                                                    </>
                                                ) : (
                                                    <>
                                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                        <circle cx="9" cy="7" r="4" />
                                                        <path d="M23 21v-2a4 4 0 0-3-3.87" />
                                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                    </>
                                                )}
                                            </svg>
                                        </button>
                                        <div className={styles.dropdownContainer} ref={bulkMenuRef}>
                                            <button
                                                className={styles.counterActionBtn}
                                                onClick={() => setShowBulkMenu(!showBulkMenu)}
                                                title={language === 'es' ? 'Carga masiva de usuarios' : 'Bulk user upload'}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 15V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V15" />
                                                    <polyline points="17,8 12,3 7,8" />
                                                    <line x1="12" y1="3" x2="12" y2="15" />
                                                </svg>
                                            </button>

                                            <input
                                                type="file"
                                                accept=".csv"
                                                style={{ display: 'none' }}
                                                ref={fileInputRef}
                                                onChange={handleBulkUpload}
                                            />

                                            {showBulkMenu && (
                                                <div className={styles.dropdownMenu}>
                                                    <button
                                                        className={styles.dropdownItem}
                                                        onClick={async () => {
                                                            setShowBulkMenu(false);
                                                            try {
                                                                const XLSX = await import('xlsx');
                                                                const wsData = [
                                                                    [
                                                                        language === 'es' ? 'Nombre' : 'First Name',
                                                                        language === 'es' ? 'Apellido' : 'Last Name',
                                                                        'Email',
                                                                        language === 'es' ? 'Teléfono' : 'Phone',
                                                                        language === 'es' ? 'Contraseña' : 'Password'
                                                                    ]
                                                                ];
                                                                const ws = XLSX.utils.aoa_to_sheet(wsData);
                                                                const wb = XLSX.utils.book_new();
                                                                XLSX.utils.book_append_sheet(wb, ws, 'Template');
                                                                XLSX.writeFile(wb, `RosterLoop_Users_Template_${new Date().toISOString().split('T')[0]}.csv`);
                                                            } catch (err) {
                                                                console.error('Error exporting Template:', err);
                                                            }
                                                        }}
                                                    >
                                                        📄 {language === 'es' ? 'Descargar Plantilla' : 'Download Template'}
                                                    </button>
                                                    <button
                                                        className={styles.dropdownItem}
                                                        onClick={() => {
                                                            setShowBulkMenu(false);
                                                            fileInputRef.current?.click();
                                                        }}
                                                    >
                                                        ⬆️ {language === 'es' ? 'Subir Archivo CSV' : 'Upload CSV File'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            className={styles.counterActionBtn}
                                            onClick={async () => {
                                                try {
                                                    const XLSX = await import('xlsx');
                                                    const wsData = [
                                                        [language === 'es' ? 'Nombre' : 'Name', 'Email', language === 'es' ? 'Teléfono' : 'Phone', language === 'es' ? 'Rol' : 'Role', 'Status'],
                                                        ...filteredUsers.map(u => [
                                                            `${u.firstName || ''} ${u.lastName || ''}`.trim(),
                                                            u.email || '',
                                                            u.phone || '',
                                                            u.roleName || '',
                                                            u.isBlocked ? (language === 'es' ? 'Bloqueado' : 'Blocked') : (language === 'es' ? 'Activo' : 'Active')
                                                        ])
                                                    ];
                                                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                                                    // Auto-fit column widths
                                                    ws['!cols'] = wsData[0].map((_, i) => ({
                                                        wch: Math.max(...wsData.map(row => (row[i]?.toString() || '').length), 10)
                                                    }));
                                                    const wb = XLSX.utils.book_new();
                                                    XLSX.utils.book_append_sheet(wb, ws, 'Users');
                                                    XLSX.writeFile(wb, `RosterLoop_Users_${new Date().toISOString().split('T')[0]}.xlsx`);
                                                } catch (err) {
                                                    console.error('Error exporting Excel:', err);
                                                }
                                            }}
                                            title={language === 'es' ? 'Exportar usuarios' : 'Export users'}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 15V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V15" />
                                                <polyline points="7,10 12,15 17,10" />
                                                <line x1="12" y1="15" x2="12" y2="3" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className={styles.userCounterBadge}>
                                        {usersLoading ? '…' : displayedUsersCount}
                                    </div>
                                </div>

                                {/* Toolbar */}
                                <div className={styles.toolbar}>
                                    <div className={styles.searchWrapper}>
                                        <input
                                            type="text"
                                            placeholder={language === 'es' ? "🔍 Buscar por nombre, email o teléfono..." : "🔍 Search by name, email or phone..."}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className={styles.searchInput}
                                        />
                                        {searchQuery && (
                                            <button
                                                className={styles.clearButton}
                                                onClick={() => setSearchQuery('')}
                                                title={language === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
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
                        </div>
                    )}

                    {/* Logs del Sistema Tab */}
                    {activeTab === 'logs' && user?.roleId === 0 && (
                        <div className={styles.wideContainer}>
                            <div className={styles.section}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                                    <div>
                                        <h2 style={{ margin: 0 }}>📜 {language === 'es' ? 'Logs del Sistema' : 'System Logs'}</h2>
                                        <p className={styles.sectionDescription} style={{ margin: 0 }}>
                                            {language === 'es' ? 'Seguimiento de eventos y auditoría de la plataforma' : 'Event tracking and platform auditing'}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div className={styles.searchWrapper} style={{ margin: 0, minWidth: '400px' }}>
                                            <input
                                                type="text"
                                                placeholder={language === 'es' ? "🔍 Buscar por usuario, acción o fecha (DD/MM/AAAA)..." : "🔍 Search by user, action or date (YYYY-MM-DD)..."}
                                                value={logsSearchQuery}
                                                onChange={(e) => setLogsSearchQuery(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === '/') {
                                                        e.stopPropagation();
                                                    }
                                                }}
                                                className={styles.searchInput}
                                            />
                                            {logsSearchQuery && (
                                                <button
                                                    className={styles.clearButton}
                                                    onClick={() => setLogsSearchQuery('')}
                                                    title={language === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <line x1="18" y1="6" x2="6" y2="18" />
                                                        <line x1="6" y1="6" x2="18" y2="18" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            className={styles.counterActionBtn}
                                            onClick={async () => {
                                                try {
                                                    const XLSX = await import('xlsx');
                                                    const wsData = [
                                                        [language === 'es' ? 'Fecha y Hora' : 'Date & Time', language === 'es' ? 'Usuario' : 'User', 'Email', language === 'es' ? 'Acción' : 'Action'],
                                                        ...logs.map(l => [
                                                            formatDateTime(l.createddate),
                                                            `${l.user.firstname} ${l.user.lastname}`,
                                                            l.user.email,
                                                            l.action
                                                        ])
                                                    ];
                                                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                                                    // Auto-fit column widths
                                                    ws['!cols'] = wsData[0].map((_, i) => ({
                                                        wch: Math.max(...wsData.map(row => (row[i]?.toString() || '').length), 15)
                                                    }));
                                                    const wb = XLSX.utils.book_new();
                                                    XLSX.utils.book_append_sheet(wb, ws, 'Logs');
                                                    XLSX.writeFile(wb, `RosterLoop_Logs_Page${logsPage}_${new Date().toISOString().split('T')[0]}.xlsx`);
                                                } catch (err) {
                                                    console.error('Error exporting Logs:', err);
                                                }
                                            }}
                                            title={language === 'es' ? 'Exportar logs' : 'Export logs'}
                                            style={{ margin: 0 }}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 15V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V15" />
                                                <polyline points="7,10 12,15 17,10" />
                                                <line x1="12" y1="15" x2="12" y2="3" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

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
                                                                    <span className={styles.lastLoginText}>
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
                        </div>
                    )}

                    {/* Tests de Mensajería Tab */}
                    {activeTab === 'messaging' && user?.roleId === 0 && (
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
                    {activeTab === 'sites' && user?.roleId === 0 && (
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

                    {/* Ayuda y Soporte Tab */}
                    {activeTab === 'help' && (
                        <div className={styles.section}>
                            <h2>📩 {language === 'es' ? 'Ayuda y Soporte' : 'Help & Support'}</h2>
                            <p className={styles.sectionDescription}>
                                {language === 'es' ? 'Información de contacto y preguntas frecuentes' : 'Contact information and frequently asked questions'}
                            </p>

                            {feedback && (
                                <div className={`${styles.feedbackMessage} ${feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}`}>
                                    {feedback.message}
                                </div>
                            )}

                            <div className={styles.settingsList}>
                                <div className={styles.settingItem}>
                                    <div className={styles.settingInfo}>
                                        <span className={styles.settingLabel}>ℹ️ {language === 'es' ? 'Versión del Software' : 'Software Version'}</span>
                                        <span className={styles.settingDescription}>
                                            v1.11.0
                                        </span>
                                    </div>
                                </div>

                                <div className={styles.settingItem}>
                                    <div className={styles.settingInfo}>
                                        <span className={styles.settingLabel}>📧 {language === 'es' ? 'Soporte Técnico' : 'Technical Support'}</span>
                                        <span className={styles.settingDescription}>
                                            {language === 'es' ? '¿Tienes problemas o sugerencias? Escríbenos.' : 'Having issues or suggestions? Write to us.'}
                                        </span>
                                    </div>
                                    <div className={styles.settingControl}>
                                        <button
                                            onClick={() => setShowContactModal(true)}
                                            className={styles.createButton}
                                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                                <polyline points="22,6 12,13 2,6" />
                                            </svg>
                                            {language === 'es' ? 'Contactar Soporte' : 'Contact Support'}
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.settingItem} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                                    <div className={styles.settingInfo}>
                                        <span className={styles.settingLabel}>❓ {language === 'es' ? 'Información Útil' : 'Useful Information'}</span>
                                    </div>
                                    <div style={{ color: 'var(--foreground-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                                        {language === 'es' ? (
                                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                                <li><strong>Sincronización:</strong> Si los cambios no se ven reflejados, intenta refrescar la página.</li>
                                                <li><strong>Sesión:</strong> Por seguridad, la sesión caduca tras un periodo de inactividad.</li>
                                                <li><strong>Calendario:</strong> Puedes usar Control/Cmd + Click para copiar y pegar turnos rápidamente.</li>
                                            </ul>
                                        ) : (
                                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                                <li><strong>Synchronization:</strong> If changes are not reflected, try refreshing the page.</li>
                                                <li><strong>Session:</strong> For security, the session expires after a period of inactivity.</li>
                                                <li><strong>Calendar:</strong> You can use Control/Cmd + Click to quickly copy and paste shifts.</li>
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main >

            {/* Create/Edit User Modal */}
            {
                showUserModal && (
                    <div className={styles.modalOverlay} onKeyDown={(e) => { if (e.key === 'Enter' && !formSaving) handleSaveUser(); }} tabIndex={-1}>
                        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.modalTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {editingUser ? (language === 'es' ? '✏️ Editar Usuario' : '✏️ Edit User') : (language === 'es' ? '➕ Crear Usuario' : '➕ Create User')}
                                <button
                                    className={styles.modalCloseButton}
                                    onClick={() => setShowUserModal(false)}
                                >
                                    ×
                                </button>
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
                                    {formData.password && (
                                        <div className={styles.passwordRequirements}>
                                            <div className={styles.requirementItem} style={{ color: validatePassword(formData.password).length ? '#10b981' : '#ef4444' }}>
                                                {validatePassword(formData.password).length ? '✅' : '❌'} {language === 'es' ? 'Mínimo 8 caracteres' : 'Min 8 characters'}
                                            </div>
                                            <div className={styles.requirementItem} style={{ color: validatePassword(formData.password).upper ? '#10b981' : '#ef4444' }}>
                                                {validatePassword(formData.password).upper ? '✅' : '❌'} {language === 'es' ? 'Una mayúscula' : 'One uppercase'}
                                            </div>
                                            <div className={styles.requirementItem} style={{ color: validatePassword(formData.password).lower ? '#10b981' : '#ef4444' }}>
                                                {validatePassword(formData.password).lower ? '✅' : '❌'} {language === 'es' ? 'Una minúscula' : 'One lowercase'}
                                            </div>
                                            <div className={styles.requirementItem} style={{ color: validatePassword(formData.password).number ? '#10b981' : '#ef4444' }}>
                                                {validatePassword(formData.password).number ? '✅' : '❌'} {language === 'es' ? 'Un número' : 'One number'}
                                            </div>
                                            <div className={styles.requirementItem} style={{ color: validatePassword(formData.password).special ? '#10b981' : '#ef4444' }}>
                                                {validatePassword(formData.password).special ? '✅' : '❌'} {language === 'es' ? 'Un carácter especial' : 'One special char'}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Site Selection for Admins — Visible to Owners and the Admin themselves */}
                                {(user?.roleId === 0 || (user?.roleId === 1 && editingUser?.id === user?.id)) && formData.roleId === 1 && (
                                    <div className={styles.modalField} style={{ marginTop: '8px' }}>
                                        <label style={{ marginBottom: '12px', display: 'block' }}>
                                            🏢 {language === 'es' ? 'Acceso a Sitios (Admins) *' : 'Site Access (Admins) *'}
                                            {user?.roleId !== 0 && (
                                                <span style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.7, marginLeft: '8px' }}>
                                                    ({language === 'es' ? 'solo lectura' : 'read-only'})
                                                </span>
                                            )}
                                        </label>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                            gap: '10px',
                                            padding: '12px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            maxHeight: '150px',
                                            overflowY: 'auto',
                                            opacity: user?.roleId !== 0 ? 0.7 : 1
                                        }}>
                                            {sites.map(site => (
                                                <label key={site.id} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    color: 'var(--foreground)'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.siteIds.includes(site.id)}
                                                        disabled={user?.roleId !== 0}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                siteIds: checked
                                                                    ? [...prev.siteIds, site.id]
                                                                    : prev.siteIds.filter(id => id !== site.id)
                                                            }));
                                                        }}
                                                        style={{ width: '16px', height: '16px' }}
                                                    />
                                                    {site.name}
                                                </label>
                                            ))}
                                        </div>
                                        {formData.siteIds.length === 0 && user?.roleId === 0 && (
                                            <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>
                                                {language === 'es' ? '⚠️ Debes seleccionar al menos un sitio para el Admin' : '⚠️ You must select at least one site for the Admin'}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {formError && (
                                    <div className={styles.modalError}>{formError}</div>
                                )}

                                <div className={styles.modalActions} style={{ justifyContent: 'center' }}>
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
                )
            }

            {/* Confirm Block/Unblock Modal */}
            {
                confirmAction && (
                    <div className={styles.modalOverlay} onKeyDown={(e) => { if (e.key === 'Enter') handleToggleBlock(); }} tabIndex={-1} ref={(el) => el?.focus()}>
                        <div className={`${styles.modalContent} ${styles.confirmModal}`} onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                            <button
                                className={styles.modalCloseButton}
                                onClick={() => setConfirmAction(null)}
                                style={{ position: 'absolute', top: '16px', right: '16px' }}
                            >
                                ×
                            </button>
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
                            <div className={styles.confirmActions} style={{ justifyContent: 'center' }}>
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
                )
            }

            {/* Create/Edit Site Modal */}
            {
                showSiteModal && (
                    <div className={styles.modalOverlay} onKeyDown={(e) => { if (e.key === 'Enter' && !siteSaving && siteName.trim()) handleSaveSite(); }} tabIndex={-1}>
                        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.modalTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {editingSite ? (language === 'es' ? '✏️ Editar Sitio' : '✏️ Edit Site') : (language === 'es' ? '➕ Crear Sitio' : '➕ Create Site')}
                                <button
                                    className={styles.modalCloseButton}
                                    onClick={() => setShowSiteModal(false)}
                                >
                                    ×
                                </button>
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

                                <div className={styles.modalActions} style={{ justifyContent: 'center' }}>
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
                )
            }

            {/* Confirm Delete Site Modal */}
            {
                confirmDeleteSite && (
                    <div className={styles.modalOverlay} onKeyDown={(e) => { if (e.key === 'Enter') handleDeleteSite(); }} tabIndex={-1} ref={(el) => el?.focus()}>
                        <div className={`${styles.modalContent} ${styles.confirmModal}`} onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                            <button
                                className={styles.modalCloseButton}
                                onClick={() => setConfirmDeleteSite(null)}
                                style={{ position: 'absolute', top: '16px', right: '16px' }}
                            >
                                ×
                            </button>
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
                            <div className={styles.confirmActions} style={{ justifyContent: 'center' }}>
                                <button
                                    className={styles.confirmDangerButton}
                                    onClick={handleDeleteSite}
                                >
                                    {language === 'es' ? 'Eliminar' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Support Contact Modal */}
            {
                showContactModal && (
                    <div className={styles.modalOverlay} onKeyDown={(e) => { if (e.key === 'Enter' && !isSendingContact) handleSendContact(); }} tabIndex={-1}>
                        <div className={`${styles.modalContent} ${styles.contactModal}`} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.modalTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>📩 {language === 'es' ? 'Contactar Soporte' : 'Contact Support'}</span>
                                <button
                                    className={styles.modalCloseButton}
                                    onClick={() => setShowContactModal(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <div className={styles.modalForm}>
                                <div className={styles.modalField}>
                                    <label>👤 {language === 'es' ? 'Nombre completo *' : 'Full Name *'}</label>
                                    <input
                                        type="text"
                                        value={contactFormData.fullName}
                                        onChange={(e) => setContactFormData({ ...contactFormData, fullName: e.target.value })}
                                        placeholder={language === 'es' ? "Tu nombre y apellido" : "Your full name"}
                                    />
                                </div>

                                <div className={styles.modalField}>
                                    <label>✉️ Email *</label>
                                    <input
                                        type="email"
                                        value={contactFormData.email}
                                        onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                                        placeholder="usuario@ejemplo.com"
                                    />
                                </div>

                                <div className={styles.modalField}>
                                    <label>📞 {language === 'es' ? 'Teléfono (opcional)' : 'Phone (optional)'}</label>
                                    <input
                                        type="tel"
                                        value={contactFormData.phone}
                                        onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                                        placeholder="+54 11 1234-5678"
                                    />
                                </div>

                                <div className={styles.modalField}>
                                    <label>📋 {language === 'es' ? 'Categoría *' : 'Category *'}</label>
                                    <select
                                        value={contactFormData.category}
                                        onChange={(e) => setContactFormData({ ...contactFormData, category: e.target.value })}
                                    >
                                        <option value={language === 'es' ? "Consulta General" : "General Inquiry"}>
                                            {language === 'es' ? 'Consulta General' : 'General Inquiry'}
                                        </option>
                                        <option value={language === 'es' ? "Problema Técnico" : "Technical Issue"}>
                                            {language === 'es' ? 'Problema Técnico' : 'Technical Issue'}
                                        </option>
                                        <option value={language === 'es' ? "Sugerencia" : "Suggestion"}>
                                            {language === 'es' ? 'Sugerencia' : 'Suggestion'}
                                        </option>
                                        <option value={language === 'es' ? "Otro" : "Other"}>
                                            {language === 'es' ? 'Otro' : 'Other'}
                                        </option>
                                    </select>
                                </div>

                                <div className={styles.modalField}>
                                    <label>💬 {language === 'es' ? 'Consulta *' : 'Inquiry *'}</label>
                                    <textarea
                                        value={contactFormData.message}
                                        onChange={(e) => setContactFormData({ ...contactFormData, message: e.target.value })}
                                        placeholder={language === 'es' ? "Detalle su consulta o comentario" : "Detail your inquiry or comment"}
                                        className={styles.textarea}
                                        rows={4}
                                    />
                                </div>

                                <div className={styles.captchaSection}>
                                    <div className={styles.modalField} style={{ flex: 1 }}>
                                        <label>🛡️ {language === 'es' ? 'Verificación *' : 'Verification *'}</label>
                                        <input
                                            type="text"
                                            value={captchaInput}
                                            onChange={(e) => setCaptchaInput(e.target.value)}
                                            placeholder={language === 'es' ? "Escriba el código" : "Type the code"}
                                        />
                                    </div>
                                    <div className={styles.captchaDisplayWrapper}>
                                        <div className={styles.captchaDisplay}>
                                            {captchaCode}
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.captchaRefresh}
                                            onClick={generateCaptcha}
                                            title={language === 'es' ? "Refrescar captcha" : "Refresh captcha"}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                                                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {contactError && (
                                    <div className={styles.modalError}>{contactError}</div>
                                )}

                                <div className={styles.modalActions} style={{ justifyContent: 'center', marginTop: '10px' }}>
                                    <button
                                        className={styles.modalSaveButton}
                                        onClick={handleSendContact}
                                        disabled={isSendingContact}
                                        style={{ width: '100%', padding: '12px', fontSize: '16px' }}
                                    >
                                        {isSendingContact ? (language === 'es' ? 'Enviando...' : 'Sending...') : (language === 'es' ? 'ENVIAR' : 'SEND')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}