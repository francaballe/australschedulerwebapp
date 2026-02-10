"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import styles from "./Navbar.module.css";

export default function Navbar() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const navigateToCalendar = () => {
        router.push("/calendar");
    };

    const navigateToSettings = () => {
        router.push("/settings");
    };

    const isActive = (path: string) => pathname === path;

    const [sites, setSites] = useState<{ id: number; name: string }[]>([]);
    const [selectedSite, setSelectedSite] = useState<number | null>(null);

    useEffect(() => {
        const fetchSites = async () => {
            try {
                const res = await fetch('/api/sites');
                if (!res.ok) return;
                const data = await res.json();
                setSites(data);

                // choose the site with the smallest id by default
                if (data.length > 0) {
                    const minId = data.reduce((acc: number, s: any) => Math.min(acc, s.id), data[0].id);
                    setSelectedSite(minId);
                    try { window.localStorage.setItem('selectedSiteId', String(minId)); } catch { }
                    // notify other components
                    try { window.dispatchEvent(new CustomEvent('siteChanged', { detail: minId })); } catch { }
                }
            } catch (err) {
                console.warn('Could not fetch sites', err);
            }
        };

        fetchSites();
    }, []);

    const onSiteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = Number(e.target.value) || null;
        setSelectedSite(id);
        try { window.localStorage.setItem('selectedSiteId', String(id)); } catch { }
        try { window.dispatchEvent(new CustomEvent('siteChanged', { detail: id })); } catch { }
    };

    return (
        <nav className={styles.navbar}>
            <div className={styles.logo} onClick={navigateToCalendar}>
                {pathname !== "/calendar" && (
                    <svg className={styles.backArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M19 12H5" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                )}
                <span className={styles.logoText}>
                    RosterLoop <span className={styles.logoVersion}>(v1.0.0)</span>
                </span>
            </div>

            {pathname !== "/settings" && (
                <div className={styles.centerSection}>
                    <select className={styles.siteSelect} value={selectedSite ?? ''} onChange={onSiteChange}>
                        {sites.length === 0 ? (
                            <option value="">No hay sitios</option>
                        ) : (
                            sites.map(site => (
                                <option key={site.id} value={site.id}>{site.name}</option>
                            ))
                        )}
                    </select>
                </div>
            )}

            <div className={styles.userSection}>
                <span className={styles.username}>
                    <svg className={styles.userIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                    </svg>
                    {user?.firstName} {user?.lastName}
                </span>

                <button
                    className={`${styles.navBtn} ${isActive("/settings") ? styles.active : ""}`}
                    onClick={navigateToSettings}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                    </svg>
                    Configuración
                </button>

                <button className={styles.logoutBtn} onClick={logout}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16,17 21,12 16,7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Cerrar Sesión
                </button>
            </div>
        </nav>
    );
}
