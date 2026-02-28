"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useState, useEffect, useRef } from "react";
import styles from "./Navbar.module.css";

export default function Navbar() {
    const { user, logout } = useAuth();
    const { language } = useTheme();
    const router = useRouter();
    const pathname = usePathname();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const navigateToCalendar = () => {
        router.push("/calendar");
    };

    const navigateToSettings = () => {
        router.push("/settings");
    };

    const isActive = (path: string) => pathname === path;



    // Handle clicks outside dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <>
            <nav className={styles.navbar}>
                <div className={styles.logo} onClick={navigateToCalendar}>
                    {pathname !== "/calendar" && (
                        <svg className={styles.backArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M19 12H5" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                    )}
                    <span className={styles.logoText}>
                        RosterLoop <span className={styles.logoVersion}>(v1.7.13)</span>
                    </span>
                </div>


                <div className={styles.userSection}>
                    <span className={styles.username}>
                        <svg className={styles.userIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                        </svg>
                        {user?.firstName} {user?.lastName}
                    </span>

                    <div className={styles.dropdown} ref={dropdownRef}>
                        <button
                            className={styles.dropdownToggle}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="12" cy="5" r="1" />
                                <circle cx="12" cy="19" r="1" />
                            </svg>
                        </button>

                        {isDropdownOpen && (
                            <div className={styles.dropdownMenu}>
                                <button
                                    className={styles.dropdownItem}
                                    onClick={() => {
                                        setIsDropdownOpen(false);
                                        navigateToSettings();
                                    }}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                                    </svg>
                                    {language === 'es' ? 'Configuración' : 'Settings'}
                                </button>
                                <button
                                    className={styles.dropdownItem}
                                    onClick={() => {
                                        setIsDropdownOpen(false);
                                        setShowLogoutModal(true);
                                    }}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16,17 21,12 16,7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                    {language === 'es' ? 'Cerrar Sesión' : 'Log Out'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Logout Confirmation Modal */}
            {
                showLogoutModal && (
                    <div className={styles.modalOverlay} onClick={() => setShowLogoutModal(false)} onKeyDown={(e) => { if (e.key === 'Enter') { setShowLogoutModal(false); logout(); } }} tabIndex={-1} ref={(el) => el?.focus()}>
                        <div className={`${styles.modalContent} ${styles.confirmModal}`} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.confirmIcon}>
                                🚪
                            </div>
                            <div className={styles.confirmTitle}>
                                {language === 'es' ? '¿Cerrar sesión?' : 'Log out?'}
                            </div>
                            <div className={styles.confirmMessage}>
                                {language === 'es'
                                    ? '¿Estás seguro de que deseas salir de la aplicación?'
                                    : 'Are you sure you want to log out of the application?'}
                            </div>
                            <div className={styles.confirmActions}>
                                <button
                                    className={styles.modalCancelButton}
                                    onClick={() => setShowLogoutModal(false)}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    className={styles.confirmDangerButton}
                                    onClick={() => {
                                        setShowLogoutModal(false);
                                        logout();
                                    }}
                                >
                                    {language === 'es' ? 'Cerrar Sesión' : 'Log Out'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
