"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
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
  const [enabledPositions, setEnabledPositions] = useState<Set<number>>(new Set());

  // Lifted state from CalendarComponent
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'day' | 'twoWeeks'>('week');
  const [unpublishedCount, setUnpublishedCount] = useState(0);

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

  // Initialize all positions as enabled on component mount
  useEffect(() => {
    const initPositions = async () => {
      try {
        const response = await fetch('/api/positions');
        if (response.ok) {
          const data = await response.json();
          const allIds = new Set<number>(data.map((p: any) => Number(p.id)));
          setEnabledPositions(allIds);
        }
      } catch (err) {
        console.error('Failed to initialize positions:', err);
      }
    };

    initPositions();
  }, []);

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

      const resp = await fetch('/api/shifts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: startDateStr, endDate: endDateStr, type: 'all' })
      });

      if (!resp.ok) throw new Error('Error al publicar');

      // Notify calendar to refresh
      try { window.dispatchEvent(new Event('publishedShifts')); } catch { }
      setPublishModalOpen(false);
    } catch (err) {
      console.error('Publish failed', err);
      alert('Error al publicar. Revisa la consola.');
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
    setEditModalOpen(true);
  };

  const confirmEditPosition = async () => {
    if (!editingPosition || !newPositionName.trim()) return;

    // Validation for schedule times (MANDATORY)
    if (!newStartTime.trim() || !newEndTime.trim()) {
      alert('Los horarios de inicio y fin son obligatorios');
      return;
    }

    const start = newStartTime.trim();
    const end = newEndTime.trim();
    if (start >= end) {
      alert('La hora de inicio debe ser anterior a la hora de fin');
      return;
    }

    setEditLoading(true);
    try {
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

      const response = await fetch(`/api/positions/${editingPosition.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar la posición');
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

      setEditModalOpen(false);
      setEditingPosition(null);
      setNewPositionName('');
      setNewPositionColor('');
      setNewStartTime('');
      setNewEndTime('');
    } catch (err) {
      console.error('Edit position failed', err);
      alert('Error al actualizar la posición. Revisa la consola.');
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
            managerName={user.firstName}
          />
        </main>
      </div>

      {/* Publish confirmation modal copied legend from old app */}
      {publishModalOpen && (
        <div className={modalStyles.modalOverlay} onClick={() => setPublishModalOpen(false)}>
          <div className={modalStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={modalStyles.modalHeader}>
              <h3>Publicar Cronograma</h3>
              <button className={modalStyles.modalCloseButton} onClick={() => setPublishModalOpen(false)}>×</button>
            </div>
            <div className={modalStyles.modalBody}>
              <p>
                ¿Está seguro de que desea publicar todos los turnos del {view === 'day' ? 'DÍA' : 'periodo visible'}?
              </p>
              {conflictCount > 0 && (
                <p style={{ color: '#f59e0b', fontSize: '0.9em', marginTop: '12px' }}>
                  ⚠️ Hay {conflictCount} turno{conflictCount > 1 ? 's' : ''} con conflicto (usuario no disponible con turno asignado).
                </p>
              )}
            </div>
            <div className={modalStyles.modalFooter}>
              <button className={modalStyles.modalCancelButton} onClick={() => setPublishModalOpen(false)} disabled={publishLoading}>Cancelar</button>
              <button className={modalStyles.primaryBtn} onClick={confirmPublish} disabled={publishLoading}>{publishLoading ? 'Publicando...' : 'Publicar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Position modal (unified: name, color, schedule) */}
      {editModalOpen && editingPosition && (
        <div className={modalStyles.modalOverlay} onClick={closeEditModal}>
          <div className={modalStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={modalStyles.modalHeader}>
              <h3>Editar Posición</h3>
              <button className={modalStyles.modalCloseButton} onClick={closeEditModal}>×</button>
            </div>
            <div className={modalStyles.modalBody}>

              {/* Nombre */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Nombre de la posición:
                </label>
                <input
                  type="text"
                  value={newPositionName}
                  onChange={(e) => setNewPositionName(e.target.value)}
                  placeholder="Ingrese el nombre de la posición"
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
                  Color:
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
                    Hora de inicio: *
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
                    Hora de fin: *
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
                Cancelar
              </button>
              <button
                className={modalStyles.primaryBtn}
                onClick={confirmEditPosition}
                disabled={editLoading || !newPositionName.trim() || !newStartTime.trim() || !newEndTime.trim()}
              >
                {editLoading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}