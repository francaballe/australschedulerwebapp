import React, { useState, useEffect } from 'react';
import styles from './Sidebar.module.css';

interface Position {
    id: string | number;
    name: string;
    color: string;
    checked: boolean;
}

interface SidebarProps {
    onSearchChange?: (value: string) => void;
    onPositionToggle?: (positionId: string | number, checked: boolean) => void;
    onPublishAll?: () => void;
    onPublishChanges?: () => void;
    onAddPosition?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    onSearchChange,
    onPositionToggle,
    onPublishAll,
    onPublishChanges,
    onAddPosition
}) => {
    const [showAllUsers, setShowAllUsers] = useState(false);
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPositions = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/positions');
                if (!response.ok) {
                    throw new Error('Error al cargar posiciones');
                }
                const data = await response.json();
                // Initialize with checked: true
                setPositions(data.map((p: any) => ({ ...p, checked: true })));
                setError(null);
            } catch (err: any) {
                console.error('Failed to fetch positions:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPositions();
    }, []);

    const handleTogglePosition = (id: string | number) => {
        setPositions(prev => prev.map(p =>
            p.id === id ? { ...p, checked: !p.checked } : p
        ));
        // Also call prop if provided
        const pos = positions.find(p => p.id === id);
        if (pos && onPositionToggle) {
            onPositionToggle(id, !pos.checked);
        }
    };

    const handleSelectAll = () => {
        setPositions(prev => prev.map(p => ({ ...p, checked: true })));
    };

    const handleSelectNone = () => {
        setPositions(prev => prev.map(p => ({ ...p, checked: false })));
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.section}>
                <div className={styles.actions}>
                    <button className={styles.primaryBtn} onClick={onPublishAll}>
                        PUBLICAR TODO
                    </button>
                    <button className={styles.secondaryBtn} onClick={onPublishChanges}>
                        PUBLICAR SÓLO CAMBIOS
                    </button>
                </div>
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Filtros</h3>
                <div className={styles.searchWrapper}>
                    <input
                        type="text"
                        placeholder="Buscar usuario"
                        className={styles.searchInput}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                    />
                    <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </div>

                <label className={styles.toggleWrapper}>
                    <input
                        type="checkbox"
                        checked={showAllUsers}
                        onChange={(e) => setShowAllUsers(e.target.checked)}
                    />
                    <div className={styles.toggleSwitch}>
                        <div className={styles.toggleSlider}></div>
                    </div>
                    <span className={styles.toggleLabel}>
                        {showAllUsers ? "Mostrando todos los usuarios" : "Mostrando sólo usuarios activos"}
                    </span>
                </label>
            </div>

            <div className={styles.section}>
                <div className={styles.headerWithAction}>
                    <div className={styles.sectionTitle}>
                        Posiciones
                        <span style={{ marginLeft: '12px', fontSize: '0.75rem', color: '#888', fontWeight: 'normal' }}>
                            <button className={styles.textBtn} onClick={handleSelectAll}>TODO</button>
                            <button className={styles.textBtn} onClick={handleSelectNone}>NADA</button>
                        </span>
                    </div>
                    <button className={styles.iconBtn} onClick={onAddPosition} title="Agregar posición">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.positionList}>
                    {loading ? (
                        <div className={styles.loadingState}>Cargando posiciones...</div>
                    ) : error ? (
                        <div className={styles.errorState}>{error}</div>
                    ) : positions.length === 0 ? (
                        <div className={styles.emptyState}>No hay posiciones</div>
                    ) : (
                        positions.map((pos) => (
                            <div key={pos.id} className={styles.positionItem}>
                                <label className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        checked={pos.checked}
                                        onChange={() => handleTogglePosition(pos.id)}
                                    />
                                    <span className={styles.checkbox}></span>
                                    <span className={styles.positionName}>{pos.name}</span>
                                </label>
                                <div className={styles.positionActions}>
                                    <div
                                        className={styles.colorIndicator}
                                        style={{ backgroundColor: pos.color || '#94a3b8' }}
                                    />
                                    <button className={styles.actionIconBtn} title="Horarios">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                    </button>
                                    <button className={`${styles.actionIconBtn} ${styles.delete}`} title="Eliminar">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 6h18" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
