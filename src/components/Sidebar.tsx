import React from 'react';
import styles from './Sidebar.module.css';

interface Position {
    id: string | number;
    name: string;
    color: string;
}

interface SidebarProps {
    onSearchChange?: (value: string) => void;
    onPositionToggle?: (positionName: string, checked: boolean) => void;
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
    // Mock data for demo purposes as requested
    const positions: Position[] = [
        { id: 1, name: 'Mañana', color: '#3b82f6' },
        { id: 2, name: 'Tarde', color: '#10b981' },
        { id: 3, name: 'Noche', color: '#f59e0b' },
        { id: 4, name: 'Refuerzo', color: '#ef4444' },
        { id: 5, name: 'Conflicts', color: '#94a3b8' },
    ];

    return (
        <aside className={styles.sidebar}>
            <div className={styles.section}>
                <div className={styles.actions}>
                    <button className={styles.primaryBtn} onClick={onPublishAll}>
                        Publicar Todo
                    </button>
                    <button className={styles.secondaryBtn} onClick={onPublishChanges}>
                        Publicar Cambios
                    </button>
                </div>
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Filtros</h3>
                <div className={styles.searchWrapper}>
                    <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Buscar usuario..."
                        className={styles.searchInput}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                    />
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.headerWithAction}>
                    <h3 className={styles.sectionTitle}>Posiciones</h3>
                    <button className={styles.iconBtn} onClick={onAddPosition} title="Agregar posición">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.positionList}>
                    {positions.map((pos) => (
                        <div key={pos.id} className={styles.positionItem}>
                            <label className={styles.checkboxWrapper}>
                                <input
                                    type="checkbox"
                                    defaultChecked
                                    onChange={(e) => onPositionToggle?.(pos.name, e.target.checked)}
                                />
                                <span className={styles.checkbox}></span>
                                <span className={styles.positionName}>{pos.name}</span>
                            </label>
                            <div className={styles.positionActions}>
                                <div
                                    className={styles.colorIndicator}
                                    style={{ backgroundColor: pos.color }}
                                />
                                <button className={styles.smallIconBtn}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
