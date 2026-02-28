"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDraggable } from "@/hooks/useDraggable";
import { useTheme } from "@/context/ThemeContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import CalendarComponent from "@/components/CalendarComponent";
import styles from "./page.module.css";
import modalStyles from "./modal.module.css";

interface Position {
  id: string | number;
  name: string;
  color: string;
  checked: boolean;
  starttime?: string | null;
  endtime?: string | null;
}

export default function CalendarPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  const [publishLoading, setPublishLoading] = useState(false);
  const [conflictCount, setConflictCount] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [newPositionName, setNewPositionName] = useState('');
  const [newPositionColor, setNewPositionColor] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editWarning, setEditWarning] = useState<string | null>(null);
  const [enabledPositions, setEnabledPositions] = useState<Set<number>>(new Set());

  // Lifted state from CalendarComponent
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'day' | 'twoWeeks'>('week');
  const [unpublishedCount, setUnpublishedCount] = useState(0);

  // Draggable Modal State
  const { position: modalPos, handleMouseDown: handleModalDrag, resetPosition: resetModalPos } = useDraggable();

  // Reset position when modal opens
  useEffect(() => {
    if (editModalOpen) resetModalPos();
  }, [editModalOpen]);

  useEffect(() => {
    const handleConflictCount = (e: any) => setConflictCount(e.detail || 0);
    window.addEventListener('conflictShiftsCount', handleConflictCount);
    return () => window.removeEventListener('conflictShiftsCount', handleConflictCount);
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  // Initialize and sync positions when site changes
  useEffect(() => {
    const fetchAndSetPositions = async (siteId?: string | number | null) => {
      try {
        const url = siteId ? `/api/positions?siteId=${siteId}` : '/api/positions';
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          // When switching sites, we want to enable all positions for THAT site by default
          const allIds = new Set<number>(data.map((p: any) => Number(p.id)));

          // Always ensure special positions 0 and 1 are included if they aren't already
          // (though the API usually provides them if siteId is present or not)
          allIds.add(0); // No Position
          allIds.add(1); // Unavailable

          setEnabledPositions(allIds);
        }
      } catch (err) {
        console.error('Failed to sync positions:', err);
      }
    };

    const handleSiteChanged = (e: any) => {
      const newSiteId = e.detail;
      fetchAndSetPositions(newSiteId);
    };

    // Initial load
    const savedSiteId = typeof window !== 'undefined' ? localStorage.getItem('selectedSiteId') : null;
    fetchAndSetPositions(savedSiteId);

    window.addEventListener('siteChanged', handleSiteChanged);
    return () => {
      window.removeEventListener('siteChanged', handleSiteChanged);
    };
  }, []);

  const { language } = useTheme();

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  if (!user) return null;

  // ---------- publish helpers ----------
  // ---------- publish helpers ----------
  const getWeekDates = (date: Date): [Date, Date] => {
    const day = date.getDay(); // 0 is Sunday
    // Week starts on Sunday.
    // If it's Sunday (0), we go back 0 days.
    // If it's Monday (1), we go back 1 day, etc.
    const diff = day;

    // Set to last Sunday (or today if today is Sunday)
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - diff);
    sunday.setHours(0, 0, 0, 0);

    // Saturday is sunday + 6
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    return [sunday, saturday];
  };

  const getTwoWeeksDates = (date: Date): [Date, Date] => {
    const [start] = getWeekDates(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 13);
    return [start, end];
  };

  const openPublish = () => {
    setPublishModalOpen(true);
  };

  const confirmPublish = async () => {
    setPublishLoading(true);
    try {
      let startDateStr: string;
      let endDateStr: string;

      if (view === 'day') {
        const dateStr = currentDate.toLocaleDateString('en-CA');
        startDateStr = dateStr;
        endDateStr = dateStr;
      } else if (view === 'twoWeeks') {
        const [start, end] = getTwoWeeksDates(currentDate);
        startDateStr = start.toLocaleDateString('en-CA');
        endDateStr = end.toLocaleDateString('en-CA');
      } else {
        const [start, end] = getWeekDates(currentDate);
        startDateStr = start.toLocaleDateString('en-CA');
        endDateStr = end.toLocaleDateString('en-CA');
      }

      console.log(`Publishing range: ${startDateStr} to ${endDateStr}`);

      const siteId = localStorage.getItem('selectedSiteId');

      const resp = await fetch('/api/shifts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDateStr,
          endDate: endDateStr,
          type: 'all',
          siteId: siteId ? Number(siteId) : undefined,
          callerUserId: user.id
        })
      });

      if (!resp.ok) throw new Error('Error al publicar');

      // Notify calendar to refresh
      try { window.dispatchEvent(new Event('publishedShifts')); } catch { }
      setPublishModalOpen(false);
    } catch (err) {
      console.error('Publish failed', err);
      setEditWarning(language === 'es' ? 'Error al publicar. Revisa la consola.' : 'Publish error. Check console.');
    } finally {
      setPublishLoading(false);
    }
  };

  const handleEditPosition = (position: Position) => {
    setEditingPosition(position);
    setNewPositionName(position.name);
    setNewPositionColor(position.color || '#94a3b8');
    // Format times from Date objects to HH:MM strings
    const startTime = position.starttime ? formatTimeForInput(position.starttime) : '';
    const endTime = position.endtime ? formatTimeForInput(position.endtime) : '';
    setNewStartTime(startTime);
    setNewEndTime(endTime);
    setEditWarning(null);
    setEditModalOpen(true);
  };

  const handleAddPosition = () => {
    setEditingPosition(null);
    setNewPositionName('');
    setNewPositionColor('#94a3b8');
    setNewStartTime('');
    setNewEndTime('');
    setEditWarning(null);
    setEditModalOpen(true);
  };

  const confirmEditPosition = async () => {
    // BUG FIX: Allow editingPosition to be null (creation mode)
    setEditWarning(null);
    if (!newPositionName.trim()) {
      setEditWarning(language === 'es' ? 'El nombre es obligatorio' : 'Name is required');
      return;
    }

    // Validation for schedule times (MANDATORY)
    if (!newStartTime.trim() || !newEndTime.trim()) {
      setEditWarning(language === 'es' ? 'Los horarios de inicio y fin son obligatorios' : 'Start and end times are required');
      return;
    }

    const start = newStartTime.trim();
    const end = newEndTime.trim();
    if (start >= end) {
      setEditWarning(language === 'es' ? 'La hora de inicio debe ser anterior a la hora de fin' : 'Start time must be before end time');
      return;
    }

    setEditLoading(true);
    try {
      if (editingPosition) {
        // UPDATE existing position
        const payload: any = {
          name: newPositionName.trim(),
          color: newPositionColor
        };

        // Include schedule (MANDATORY)
        payload.starttime = newStartTime.trim();
        payload.endtime = newEndTime.trim();

        // NEW: Include current view range to update unpublished shifts
        // We need to calculate the start/end date of the CURRENT VIEW
        let viewStartDateStr: string = '';
        let viewEndDateStr: string = '';

        // Re-using logic from confirmPublish (or lifting it to a helper would be better, but inline for now)
        const getWeekDates = (date: Date): [Date, Date] => {
          const day = date.getDay();
          const diff = day;
          const sunday = new Date(date);
          sunday.setDate(date.getDate() - diff);
          sunday.setHours(0, 0, 0, 0);
          const saturday = new Date(sunday);
          saturday.setDate(sunday.getDate() + 6);
          saturday.setHours(23, 59, 59, 999);
          return [sunday, saturday];
        };

        const getTwoWeeksDates = (date: Date): [Date, Date] => {
          const [start] = getWeekDates(date);
          const end = new Date(start);
          end.setDate(start.getDate() + 13);
          return [start, end];
        };

        if (view === 'day') {
          const dateStr = currentDate.toLocaleDateString('en-CA');
          viewStartDateStr = dateStr;
          viewEndDateStr = dateStr;
        } else if (view === 'twoWeeks') {
          const [start, end] = getTwoWeeksDates(currentDate);
          viewStartDateStr = start.toLocaleDateString('en-CA');
          viewEndDateStr = end.toLocaleDateString('en-CA');
        } else {
          const [start, end] = getWeekDates(currentDate);
          viewStartDateStr = start.toLocaleDateString('en-CA');
          viewEndDateStr = end.toLocaleDateString('en-CA');
        }

        payload.updateUnpublishedShifts = true;
        payload.startDate = viewStartDateStr;
        payload.endDate = viewEndDateStr;

        console.log('Sending position update:', payload);

        const response = await fetch(`/api/positions/${editingPosition.id}?callerUserId=${user?.id || ''}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error al actualizar la posición');
        }

        // Notify sidebar to refresh positions list and calendar
        window.dispatchEvent(new CustomEvent('positionsUpdated', {
          detail: {
            positionId: editingPosition.id,
            name: newPositionName.trim(),
            color: newPositionColor,
            starttime: newStartTime.trim(),
            endtime: newEndTime.trim()
          }
        }));

      } else {
        // CREATE new position
        const siteId = localStorage.getItem('selectedSiteId');
        console.log('Creating position for siteId:', siteId);

        if (!siteId) {
          setEditWarning(language === 'es' ? 'Error: No hay un sitio seleccionado. Por favor recarga la página.' : 'Error: No site selected. Please reload the page.');
          setEditLoading(false);
          return;
        }

        const payload = {
          name: newPositionName.trim(),
          color: newPositionColor,
          starttime: newStartTime.trim(),
          endtime: newEndTime.trim(),
          siteId: siteId
        };

        const response = await fetch('/api/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error al crear la posición');
        }

        const newPosition = await response.json();

        // Notify sidebar to add the new position to the list
        window.dispatchEvent(new CustomEvent('positionCreated', { detail: newPosition }));

        // Enable the new position immediately so it shows up in calendar
        setEnabledPositions(prev => {
          const next = new Set(prev);
          next.add(Number(newPosition.id));
          return next;
        });
      }

      setEditModalOpen(false);
      setEditingPosition(null);
      setNewPositionName('');
      setNewPositionColor('');
      setNewStartTime('');
      setNewEndTime('');
    } catch (err: any) {
      console.warn('Save position failed:', err.message);
      // Translate known API error codes
      let msg = err.message;
      if (msg === 'DUPLICATE_NAME') {
        msg = language === 'es' ? 'Ya existe una posición con este nombre' : 'A position with this name already exists';
      }
      setEditWarning(msg);
    } finally {
      setEditLoading(false);
    }
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingPosition(null);
    setNewPositionName('');
    setNewPositionColor('');
    setNewStartTime('');
    setNewEndTime('');
  };

  const formatTimeForInput = (timeString: string) => {
    // Convert database time string to HH:MM format
    if (!timeString) return '';
    // If it's already in HH:MM format, return as is
    if (timeString.match(/^\d{2}:\d{2}$/)) return timeString;
    // If it's a full time string like "09:00:00", extract HH:MM
    return timeString.substring(0, 5);
  };

  const handlePositionToggle = (positionId: string | number, checked: boolean) => {
    const numId = Number(positionId);
    setEnabledPositions(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(numId);
      } else {
        next.delete(numId);
      }
      return next;
    });
  };



  return (
    <div className={styles.wrapper}>
      <Navbar />
      <div className={styles.content}>
        <Sidebar
          onPublishAll={openPublish}
          onAddPosition={handleAddPosition}
          conflictCount={conflictCount}
          unpublishedCount={unpublishedCount}
          onEditPosition={handleEditPosition}
          onPositionToggle={handlePositionToggle}
          onSearchChange={(q: string) => {
            try { window.dispatchEvent(new CustomEvent('userSearch', { detail: q })); } catch { }
          }}
        />
        <main className={styles.main}>


          {loading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner}></div>
            </div>
          )}

          <CalendarComponent
            enabledPositions={enabledPositions}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            view={view}
            setView={setView}
            onStatsUpdate={(stats: { unpublishedCount: number }) => setUnpublishedCount(stats.unpublishedCount)}
            managerName={`${user.firstName} ${user.lastName || ''}`.trim()}
          />
        </main>
      </div>

      {/* Publish confirmation modal copied legend from old app */}
      {publishModalOpen && (
        <div className={modalStyles.modalOverlay} onClick={() => setPublishModalOpen(false)}>
          <div className={modalStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={modalStyles.modalHeader}>
              <h3>{language === 'es' ? 'Publicar Cronograma' : 'Publish Schedule'}</h3>
              <button className={modalStyles.modalCloseButton} onClick={() => setPublishModalOpen(false)}>×</button>
            </div>
            <div className={modalStyles.modalBody}>
              <p>
                {language === 'es'
                  ? `¿Está seguro de que desea publicar todos los turnos del ${view === 'day' ? 'DÍA' : 'periodo visible'}?`
                  : `Are you sure you want to publish all shifts for the ${view === 'day' ? 'DAY' : 'visible period'}?`}
              </p>
              {conflictCount > 0 && (
                <p style={{ color: '#f59e0b', fontSize: '0.9em', marginTop: '12px' }}>
                  {language === 'es'
                    ? `⚠️ Hay ${conflictCount} turno${conflictCount > 1 ? 's' : ''} con conflicto (usuario no disponible con turno asignado).`
                    : `⚠️ There ${conflictCount > 1 ? 'are' : 'is'} ${conflictCount} shift${conflictCount > 1 ? 's' : ''} with a conflict (unavailable user with assigned shift).`}
                </p>
              )}
            </div>
            <div className={modalStyles.modalFooter}>
              <button className={modalStyles.modalCancelButton} onClick={() => setPublishModalOpen(false)} disabled={publishLoading}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
              <button className={modalStyles.primaryBtn} onClick={confirmPublish} disabled={publishLoading}>{publishLoading ? (language === 'es' ? 'Publicando...' : 'Publishing...') : (language === 'es' ? 'Publicar' : 'Publish')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Position modal (unified: name, color, schedule) */}
      {editModalOpen && (
        <div className={modalStyles.modalOverlay} onClick={closeEditModal}>
          <div
            className={modalStyles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translate(${modalPos.x}px, ${modalPos.y}px)`,
              cursor: 'default'
            }}
          >
            <div
              className={modalStyles.modalHeader}
              onMouseDown={handleModalDrag}
              style={{ cursor: 'grab', userSelect: 'none' }}
            >
              <h3>{editingPosition ? (language === 'es' ? 'Editar Posición' : 'Edit Position') : (language === 'es' ? 'Crear Posición' : 'Create Position')}</h3>
              <button className={modalStyles.modalCloseButton} onClick={closeEditModal}>×</button>
            </div>
            <div className={modalStyles.modalBody}>
              {editWarning && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '13px',
                  fontWeight: 500
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px', flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <circle cx="12" cy="17" r="1" fill="currentColor" />
                  </svg>
                  <span>{editWarning}</span>
                </div>
              )}

              {/* Nombre */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  {language === 'es' ? 'Nombre de la posición:' : 'Position Name:'}
                </label>
                <input
                  type="text"
                  value={newPositionName}
                  onChange={(e) => setNewPositionName(e.target.value)}
                  placeholder={language === 'es' ? "Ingrese el nombre de la posición" : "Enter position name"}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
              </div>

              {/* Color */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  {language === 'es' ? 'Color:' : 'Color:'}
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    '#ef4444', '#f97316', '#f59e0b', '#FACC15',
                    '#22c55e', '#166534', '#06b6d4', '#3b82f6',
                    '#6366f1', '#a855f7', '#ec4899',
                    '#64748b', '#475569', '#1e293b'
                  ].map(color => (
                    <button
                      key={color}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '4px',
                        backgroundColor: color,
                        border: newPositionColor.toLowerCase() === color.toLowerCase() ? '3px solid #000' : '2px solid #ddd',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      onClick={() => setNewPositionColor(color)}
                      type="button"
                    />
                  ))}
                </div>
              </div>

              {/* Horarios */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    {language === 'es' ? 'Hora de inicio: *' : 'Start time: *'}
                  </label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    {language === 'es' ? 'Hora de fin: *' : 'End time: *'}
                  </label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>



            </div>
            <div className={modalStyles.modalFooter}>
              <button
                className={modalStyles.modalCancelButton}
                onClick={closeEditModal}
                disabled={editLoading}
              >
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                className={modalStyles.primaryBtn}
                onClick={confirmEditPosition}
                disabled={editLoading || !newPositionName.trim() || !newStartTime.trim() || !newEndTime.trim()}
              >
                {editLoading ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Guardar' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}