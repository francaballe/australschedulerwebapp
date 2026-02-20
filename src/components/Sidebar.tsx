import React, { useState, useEffect, useRef } from 'react';
import styles from './Sidebar.module.css';

interface Position {
    id: string | number;
    name: string;
    color: string;
    checked: boolean;
    starttime?: string | null;
    endtime?: string | null;
}

interface SidebarProps {
    onSearchChange?: (value: string) => void;
    onPositionToggle?: (positionId: string | number, checked: boolean) => void;
    onPublishAll?: () => void;

    onAddPosition?: () => void;
    onEditPosition?: (position: Position) => void;
    conflictCount?: number;
    view?: 'week' | 'day' | 'twoWeeks';
    unpublishedCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({
    onSearchChange,
    onPositionToggle,

    onPublishAll,
    onAddPosition,
    onEditPosition,
    conflictCount = 0,
    unpublishedCount = 0,
    view = 'week'
}) => {
    // Site selector state
    const [sites, setSites] = useState<{ id: number; name: string }[]>([]);
    const [selectedSite, setSelectedSite] = useState<number | null>(null);

    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Delete confirmation modal state
    const [deleteConfirmData, setDeleteConfirmData] = useState<{ id: number; name: string; futureShiftsCount: number } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);





    useEffect(() => {
        const fetchPositions = async () => {
            // Wait until selectedSite is determined
            if (selectedSite === null) return;

            try {
                setLoading(true);
                const url = `/api/positions?siteId=${selectedSite}`;
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Error al cargar posiciones');
                }
                const data = await response.json();
                // Initialize with checked: true
                const initialized = data.map((p: Position) => ({ ...p, checked: true }));
                setPositions(initialized);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch positions:', err);
                setError(err instanceof Error ? err.message : 'Error desconocido');
            } finally {
                setLoading(false);
            }
        };

        const handlePositionsUpdated = (event: Event) => {
            const { positionId, color, name, starttime, endtime } = (event as CustomEvent).detail;
            const updater = (p: Position) => {
                if (p.id === positionId) {
                    return {
                        ...p,
                        ...(color !== undefined && { color }),
                        ...(name !== undefined && { name }),
                        ...(starttime !== undefined && { starttime }),
                        ...(endtime !== undefined && { endtime })
                    };
                }
                return p;
            };

            setPositions(prev => prev.map(updater));
        };

        const handlePositionCreated = (event: Event) => {
            const newPosition = (event as CustomEvent).detail;
            // Only add if it matches current site (or we are in a mode where we show all? 
            // The API handles saving siteId. The current list is filtered by selectedSite.
            // If newPosition.siteid matches selectedSite, add it.
            // Note: API returns 'siteid' (lowercase) or 'siteId'? Prisma returns 'siteid'.
            // Let's check both or cast.

            const currentSiteId = Number(selectedSite);
            const posSiteId = Number(newPosition.siteid);

            if (!currentSiteId || posSiteId === currentSiteId) {
                const formattedPosition: Position = {
                    id: newPosition.id,
                    name: newPosition.name,
                    color: newPosition.color,
                    checked: true, // Default checked
                    starttime: newPosition.starttime ? newPosition.starttime.slice(11, 16) : null,
                    endtime: newPosition.endtime ? newPosition.endtime.slice(11, 16) : null
                };
                setPositions(prev => [...prev, formattedPosition]);
            }
        };

        const handleEnablePosition = (event: Event) => {
            const positionId = (event as CustomEvent).detail;
            setPositions(prev => prev.map(p => {
                if (Number(p.id) === Number(positionId) && !p.checked) {
                    // Also notify parent so enabledPositions set is updated
                    if (onPositionToggle) {
                        setTimeout(() => onPositionToggle(Number(p.id), true), 0);
                    }
                    return { ...p, checked: true };
                }
                return p;
            }));
        };

        fetchPositions();

        // Listen for position updates from other components
        window.addEventListener('positionsUpdated', handlePositionsUpdated);
        window.addEventListener('positionCreated', handlePositionCreated);
        window.addEventListener('enablePosition', handleEnablePosition);

        return () => {
            window.removeEventListener('positionsUpdated', handlePositionsUpdated);
            window.removeEventListener('positionCreated', handlePositionCreated);
            window.removeEventListener('enablePosition', handleEnablePosition);
        };
    }, [selectedSite]);

    // Fetch sites and handle selection (Moved from Navbar)
    useEffect(() => {
        const fetchSites = async () => {
            try {
                const res = await fetch('/api/sites');
                if (!res.ok) return;
                const data = await res.json();
                setSites(data);

                // Initialize selected site to the lowest ID (ignoring localStorage)
                if (data.length > 0) {
                    const minId = data.reduce((acc: number, s: { id: number }) => Math.min(acc, s.id), data[0].id);
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

    // Search input state + debounce (only triggers onSearchChange)
    const [searchValue, setSearchValue] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = (value: string) => {
        setSearchValue(value);
        // debounce 300ms
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            onSearchChange?.(value);
            debounceRef.current = null;
        }, 300);
    };

    // cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    const handleTogglePosition = (id: string | number) => {
        setPositions(prev => {
            const updated = prev.map(p => {
                if (p.id === id) {
                    const newChecked = !p.checked;
                    // Call parent callback immediately with new value
                    if (onPositionToggle) {
                        setTimeout(() => onPositionToggle(Number(id), newChecked), 0);
                    }
                    return { ...p, checked: newChecked };
                }
                return p;
            });
            return updated;
        });
    };

    const handleSelectAll = () => {
        setPositions(prev => {
            const updated = prev.map(p => ({ ...p, checked: true }));
            // Send notifications after state update
            if (onPositionToggle) {
                setTimeout(() => {
                    prev.forEach(p => {
                        if (!p.checked) {
                            onPositionToggle(Number(p.id), true);
                        }
                    });
                }, 0);
            }
            return updated;
        });
    };

    const handleSelectNone = () => {
        setPositions(prev => {
            const updated = prev.map(p => ({ ...p, checked: false }));
            // Send notifications after state update
            if (onPositionToggle) {
                setTimeout(() => {
                    prev.forEach(p => {
                        if (p.checked) {
                            onPositionToggle(Number(p.id), false);
                        }
                    });
                }, 0);
            }
            return updated;
        });
    };

    const handleToggleAllSelection = () => {
        const allSelected = positions.every(p => p.checked);
        if (allSelected) {
            handleSelectNone();
        } else {
            handleSelectAll();
        }
    };



    const handleDeletePosition = async (id: number, name: string) => {
        try {
            const url = `/api/positions/${id}`;
            let res = await fetch(url, { method: 'DELETE' });

            if (res.status === 409) {
                const data = await res.json();
                if (data.requireConfirmation) {
                    // Show custom modal instead of window.confirm
                    setDeleteConfirmData({ id, name, futureShiftsCount: data.futureShiftsCount });
                    return;
                }
            }

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Error al eliminar la posición');
            }

            // Successfully deleted (hard delete, no future shifts)
            setPositions(prev => prev.filter(p => p.id !== id));
            try { window.dispatchEvent(new CustomEvent('positionDeleted', { detail: id })); } catch { }

        } catch (err) {
            console.error('Failed to delete position:', err);
            alert(err instanceof Error ? err.message : 'Error al eliminar');
        }
    };

    const confirmDeletePosition = async () => {
        if (!deleteConfirmData) return;
        const { id } = deleteConfirmData;

        try {
            setDeleteLoading(true);
            const res = await fetch(`/api/positions/${id}?confirm=true`, { method: 'DELETE' });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Error al eliminar la posición');
            }

            // Successfully soft-deleted
            setPositions(prev => prev.filter(p => p.id !== id));
            try { window.dispatchEvent(new CustomEvent('positionDeleted', { detail: id })); } catch { }
            setDeleteConfirmData(null);

        } catch (err) {
            console.error('Failed to delete position:', err);
            alert(err instanceof Error ? err.message : 'Error al eliminar');
        } finally {
            setDeleteLoading(false);
        }
    };

    const allPositionsSelected = positions.every(p => p.checked);

    // Accordion state
    const [isPositionsOpen, setIsPositionsOpen] = useState(true);

    return (
        <>
            <aside className={styles.sidebar}>
                <div className={styles.section}>
                    <div className={styles.actions}>
                        {/* Site Selector moved here */}
                        <div className={styles.siteSelectorWrapper}>
                            <select
                                className={styles.siteSelect}
                                value={selectedSite ?? ''}
                                onChange={onSiteChange}
                                disabled={sites.length === 0}
                            >
                                {sites.length === 0 ? (
                                    <option value="">Cargando sitios...</option>
                                ) : (
                                    sites.map(site => (
                                        <option key={site.id} value={site.id}>{site.name}</option>
                                    ))
                                )}
                            </select>
                        </div>

                        <button
                            className={styles.primaryBtn}
                            onClick={onPublishAll}
                            disabled={unpublishedCount === 0}
                            title={unpublishedCount === 0 ? "Todo publicado" : "Publicar cronograma"}
                            style={unpublishedCount === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        >
                            PUBLICAR CRONOGRAMA
                        </button>

                    </div>
                </div>

                <div className={styles.section}>
                    <hr className={styles.separator} />
                    {/* Visual separator/grouper could go here if needed, but "Filtros" header removed as requested */}
                    <div className={styles.searchWrapper}>
                        <input
                            type="search"
                            name="search-filter"
                            placeholder="Buscar usuario"
                            className={styles.searchInput}
                            value={searchValue}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            data-lpignore="true"
                            data-lastpass-ignore="true"
                            data-1p-ignore="true"
                            data-bwignore="true"
                        />
                        <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.selectionControls}>
                        <button
                            onClick={handleToggleAllSelection}
                            className={styles.selectAllBtn}
                        >
                            {allPositionsSelected ? "Deseleccionar todo" : "Seleccionar todo"}
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
                                        {pos.id !== 0 && pos.id !== 1 && (
                                            <button className={styles.actionIconBtn} title="Editar posición" onClick={() => onEditPosition?.(pos)}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </button>
                                        )}
                                        {pos.id !== 0 && pos.id !== 1 && (
                                            <button className={`${styles.actionIconBtn} ${styles.delete}`} title="Eliminar" onClick={() => handleDeletePosition(Number(pos.id), pos.name)}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M3 6h18" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    <line x1="10" y1="11" x2="10" y2="17" />
                                                    <line x1="14" y1="11" x2="14" y2="17" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <button className={styles.addPositionBtn} onClick={onAddPosition}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>Agregar posición</span>
                    </button>
                </div>
            </aside>

            {/* Delete Position Confirmation Modal */}
            {
                deleteConfirmData && (
                    <div className={styles.modalOverlay} onClick={() => !deleteLoading && setDeleteConfirmData(null)}>
                        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.deleteConfirmation}>
                                <div className={styles.deleteIconContainer}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                        <path d="M12 9v4" />
                                        <path d="M12 17h.01" />
                                    </svg>
                                </div>
                                <h4>¿Eliminar posición?</h4>
                                <p>
                                    La posición <strong>&ldquo;{deleteConfirmData.name}&rdquo;</strong> tiene{' '}
                                    <strong>{deleteConfirmData.futureShiftsCount}</strong> turno(s) asignado(s) desde hoy en adelante.
                                    <br /><br />
                                    Si procedes, la posición y todos esos turnos futuros serán <strong>eliminados</strong>.
                                </p>
                                <div className={styles.deleteConfirmationButtons}>
                                    <button
                                        className={styles.cancelDeleteBtn}
                                        onClick={() => setDeleteConfirmData(null)}
                                        disabled={deleteLoading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        className={styles.confirmDeleteBtn}
                                        onClick={confirmDeletePosition}
                                        disabled={deleteLoading}
                                    >
                                        {deleteLoading ? 'Eliminando...' : 'Eliminar Posición'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
};

export default Sidebar;
