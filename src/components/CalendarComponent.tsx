"use client";

import { useState, useEffect } from "react";
import styles from "./CalendarComponent.module.css";

interface CalendarProps { }

interface User {
  id: number;
  firstName: string;
  lastName: string;
  siteId?: number | null;
}

interface Shift {
  id: number;
  userId: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  position?: string;
  positionColor?: string;
  published: boolean;
}

interface Position {
  id: number;
  name: string;
  color: string;
}

const CalendarComponent: React.FC<CalendarProps> = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'day' | 'twoWeeks'>('week');

  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [userConfirmations, setUserConfirmations] = useState<Map<number, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{userId: number, date: Date} | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Load users (optionally filtered by siteId)
  const loadUsers = async (siteId?: number | null) => {
    try {
      setLoading(true);
      const url = siteId ? `/api/users?siteId=${siteId}` : '/api/users';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Error al cargar usuarios');
      }
      const data = await response.json();
      setUsers(data);
      return data as User[];
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError(err.message);
      return [] as User[];
    } finally {
      setLoading(false);
    }
  };

  // Selected site filtering: read initial value from localStorage and listen to site changes
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  useEffect(() => {
    const init = () => {
      try {
        const v = window.localStorage.getItem('selectedSiteId');
        if (v) setSelectedSiteId(Number(v));
      } catch { }
    };

    const handler = (e: any) => {
      const id = e?.detail ?? null;
      setSelectedSiteId(id);
    };

    init();
    window.addEventListener('siteChanged', handler as EventListener);
    return () => window.removeEventListener('siteChanged', handler as EventListener);
  }, []);

  const fetchShifts = async (dates: Date[]) => {
    if (dates.length === 0) return [] as Shift[];

    try {
      const startDate = dates[0].toISOString().split('T')[0];
      const endDate = dates[dates.length - 1].toISOString().split('T')[0];

      const response = await fetch(`/api/shifts?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) {
        throw new Error('Error al cargar turnos');
      }
      const data = await response.json();
      return data as Shift[];
    } catch (err: any) {
      console.error('Failed to fetch shifts:', err);
      return [] as Shift[];
    }
  };

  // Fetch available positions for admin assignment
  const fetchPositions = async () => {
    try {
      setModalLoading(true);
      const response = await fetch('/api/positions?adminOnly=true');
      if (!response.ok) {
        throw new Error('Error al cargar posiciones');
      }
      const data = await response.json();
      setPositions(data);
    } catch (err: any) {
      console.error('Failed to fetch positions:', err);
      setError('Error al cargar posiciones');
    } finally {
      setModalLoading(false);
    }
  };

  // Create new shift assignment
  const createShiftAssignment = async (userId: number, date: Date, positionId: number) => {
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      // Check if shift already exists for this user/date
      const existingShift = getShiftForUserAndDay(userId, date);
      
      if (existingShift) {
        // If shift exists, delete it first and then create new one
        console.log('🔄 Updating existing shift:', existingShift);
        
        // Delete existing shift first
        const deleteResponse = await fetch(`/api/shifts/${existingShift.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (!deleteResponse.ok) {
          console.warn('⚠️ Could not delete existing shift, will try to create new one anyway');
        } else {
          console.log('✅ Existing shift deleted successfully');
        }
      }
      
      const requestData = {
        userId: userId,
        date: dateStr,
        positionId: positionId,
        published: false
      };

      console.log('📤 Sending shift assignment request:', requestData);

      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        // Try to get detailed error message from server
        let errorMessage = `Error al crear la asignación (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
          console.error('❌ Server error response:', errorData);
        } catch (parseError) {
          console.error('❌ Failed to parse error response, using status:', response.status, response.statusText);
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Shift assignment successful:', result);

      // Refresh shifts data
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('❌ Failed to create shift assignment:', err);
      alert(`Error al asignar turno: ${err.message}`);
      return false;
    }
  };

  // Fetch user confirmations for the current week
  const fetchUserConfirmations = async (weekStartDate: string, usersData: User[]) => {
    try {
      console.log('🔍 WEB: Fetching confirmations for weekStartDate:', weekStartDate);
      console.log('🔍 WEB: Users to check:', usersData.map(u => u.id));
      
      const confirmationsMap = new Map<number, boolean>();
      
      // Fetch all confirmations at once for better performance
      const promises = usersData.map(async (user) => {
        try {
          const url = `/api/confirm-weeks?userId=${user.id}&date=${weekStartDate}`;
          console.log('🔍 WEB: Fetching from URL:', url);
          
          const response = await fetch(url);
          if (response.ok) {
            const confirmations = await response.json();
            console.log(`🔍 WEB: User ${user.id} confirmations:`, confirmations);
            
            // Just check if there's any record for this user/week, don't check .confirmed field
            const isConfirmed = confirmations.length > 0;
            console.log(`🔍 WEB: User ${user.id} isConfirmed:`, isConfirmed);
            
            return { userId: user.id, confirmed: isConfirmed };
          }
        } catch (error) {
          console.error(`Error fetching confirmation for user ${user.id}:`, error);
        }
        return { userId: user.id, confirmed: false };
      });
      
      const results = await Promise.all(promises);
      results.forEach(result => {
        confirmationsMap.set(result.userId, result.confirmed);
      });
      
      console.log('🔍 WEB: Final confirmationsMap:', confirmationsMap);
      setUserConfirmations(confirmationsMap);
    } catch (error) {
      console.error('Failed to fetch user confirmations:', error);
      setUserConfirmations(new Map()); // Clear confirmations on error
    }
  };

  // Obtener días de la semana (domingo a sábado)
  const getWeekDates = (date: Date) => {
    const currentDate = new Date(date);
    const dayOfWeek = currentDate.getDay(); // 0=domingo, 1=lunes...

    // Crear el domingo de esta semana
    const sunday = new Date(currentDate);
    sunday.setDate(currentDate.getDate() - dayOfWeek);

    // Crear array con los días según la vista
    const numDays = view === 'twoWeeks' ? 14 : 7;
    const weekDates = [];
    for (let i = 0; i < numDays; i++) {
      const dayDate = new Date(sunday);
      dayDate.setDate(sunday.getDate() + i);
      weekDates.push(dayDate);
    }

    return weekDates;
  };

  const weekDates = getWeekDates(currentDate);

  // When currentDate, view or selectedSiteId changes, reload users and shifts
  useEffect(() => {
    const loadUsersAndShifts = async () => {
      setShiftsLoading(true);
      
      // Clear confirmations immediately when changing weeks to prevent visual artifacts
      if (view === 'week') {
        setUserConfirmations(new Map());
      }
      
      try {
        const usersData = await loadUsers(selectedSiteId);
        setUsers(usersData); // Update users state first
        const shiftsData = await fetchShifts(weekDates);
        const userIds = new Set(usersData.map(u => u.id));
        const filtered = shiftsData.filter(s => userIds.has(s.userId));
        setShifts(filtered);
        
        // Only fetch confirmations for week view
        if (view === 'week' && weekDates.length > 0) {
          const weekStartDate = weekDates[0].toISOString().split('T')[0];
          await fetchUserConfirmations(weekStartDate, usersData);
        }
      } catch (err) {
        console.error('Error loading users and shifts:', err);
      } finally {
        setShiftsLoading(false);
      }
    };

    loadUsersAndShifts();
  }, [currentDate, view, selectedSiteId]);

  // Expose a manual refresh that other UI can call
  const refreshData = async () => {
    setShiftsLoading(true);
    
    // Clear confirmations immediately when refreshing to prevent visual artifacts
    if (view === 'week') {
      setUserConfirmations(new Map());
    }
    
    try {
      const usersData = await loadUsers(selectedSiteId);
      setUsers(usersData); // Update users state first
      const shiftsData = await fetchShifts(weekDates);
      const userIds = new Set(usersData.map(u => u.id));
      const filtered = shiftsData.filter(s => userIds.has(s.userId));
      setShifts(filtered);
      
      // Only fetch confirmations for week view
      if (view === 'week' && weekDates.length > 0) {
        const weekStartDate = weekDates[0].toISOString().split('T')[0];
        await fetchUserConfirmations(weekStartDate, usersData);
      }
    } catch (err) {
      console.error('Error refreshing calendar data:', err);
    } finally {
      setShiftsLoading(false);
    }
  };

  // Listen for publish events to refresh data
  useEffect(() => {
    const handler = () => {
      console.log('🔄 Detected published shifts - refreshing calendar');
      refreshData();
    };
    window.addEventListener('publishedShifts', handler);
    return () => window.removeEventListener('publishedShifts', handler);
  }, []);

  const today = new Date();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDisplayRange = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric'
      });
    }

    const start = weekDates[0];
    const end = weekDates[weekDates.length - 1];

    const options: Intl.DateTimeFormatOptions = {
      month: '2-digit', day: '2-digit', year: 'numeric'
    };

    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric'
    });
  };

  const goToNextWeek = () => {
    const nextWeek = new Date(currentDate);
    nextWeek.setDate(currentDate.getDate() + 7);
    setCurrentDate(nextWeek);
  };

  const goToPrevWeek = () => {
    const prevWeek = new Date(currentDate);
    prevWeek.setDate(currentDate.getDate() - 7);
    setCurrentDate(prevWeek);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  // Obtener shift para un usuario en una fecha específica
  const getShiftForUserAndDay = (userId: number, date: Date): Shift | undefined => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.find(shift => shift.userId === userId && shift.date === dateStr);
  };

  // Formatear horarios del shift
  const formatShiftTime = (startTime: string | null, endTime: string | null): string => {
    // Si startTime o endTime son null/undefined, retornar string vacía (no mostrar horario)
    if (!startTime || !endTime) {
      return "";
    }

    const to12 = (time: string) => {
      if (!time) return "";
      const parts = time.split(':');
      if (parts.length < 2) return time;
      const h = Number(parts[0]);
      const m = Number(parts[1]);
      if (Number.isNaN(h) || Number.isNaN(m)) return `${parts[0]}:${parts[1]}`;
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = ((h + 11) % 12) + 1;
      return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
    };

    const start = to12(startTime);
    const end = to12(endTime);
    return `${start} - ${end}`;
  };

  // Calcular horas entre dos strings "HH:mm:ss"
  const calculateHours = (startTime: string | null, endTime: string | null): number => {
    // Si startTime o endTime son null/undefined (como en "unavailable"), retornar 0
    if (!startTime || !endTime) {
      return 0;
    }
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    const totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    return Math.max(0, totalMinutes / 60);
  };

  // Calcular total de horas para un usuario en el rango visible
  const getUserTotalHours = (userId: number): number => {
    return shifts
      .filter(s => s.userId === userId)
      .reduce((acc, s) => acc + calculateHours(s.startTime, s.endTime), 0);
  };

  // Manejar click en celda
  const handleCellClick = (userId: number, date: Date) => {
    console.log(`Clicked on user ${userId} for date ${date.toDateString()}`);
    
    // Open modal for position selection
    setSelectedCell({ userId, date });
    setIsModalOpen(true);
    fetchPositions(); // Load available positions
  };

  // Modal handlers
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCell(null);
  };

  const handlePositionSelect = async (positionId: number) => {
    if (!selectedCell) return;

    const success = await createShiftAssignment(selectedCell.userId, selectedCell.date, positionId);
    if (success) {
      handleModalClose();
    }
  };

  return (
    <div className={styles.calendarContainer}>
      {/* Header del calendario */}
      <div className={styles.calendarHeader}>
        <div className={styles.leftHeader}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleButton} ${view === 'day' ? styles.active : ''}`}
              onClick={() => setView('day')}
            >
              Día
            </button>
            <button
              className={`${styles.toggleButton} ${view === 'week' ? styles.active : ''}`}
              onClick={() => setView('week')}
            >
              Semana
            </button>
            <button
              className={`${styles.toggleButton} ${view === 'twoWeeks' ? styles.active : ''}`}
              onClick={() => setView('twoWeeks')}
            >
              2 Semanas
            </button>
          </div>
          <div className={styles.navigationControls}>
            <button onClick={goToPrevWeek} className={styles.iconNavBtn} title="Anterior">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className={styles.dateRangeDisplay}>{formatDisplayRange()}</span>
            <button onClick={goToNextWeek} className={styles.iconNavBtn} title="Siguiente">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button onClick={goToToday} className={styles.todaySmallBtn}>
              Hoy
            </button>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.actionButton} title="Actualizar" onClick={() => refreshData()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          {view === 'week' && (
            <button className={styles.actionButton} title="Copiar semana anterior">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          )}
          {view === 'week' && (
            <button className={`${styles.actionButton} ${styles.deleteAction}`} title="Borrar semana completa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
          <button className={styles.actionButton} title="Exportar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V15" />
              <polyline points="7,10 12,15 17,10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>

      </div>

      {/* Vista de calendario tipo tabla */}
      {/* Cuerpo de la tabla que contiene Header, Body y Footer */}
      <div className={styles.tableBody}>
        {/* Header de la tabla (Sticky) */}
        <div className={styles.tableHeader}>
          <div className={styles.userColumn}>Usuarios</div>
          {weekDates.map((date: Date, index: number) => (
            <div
              key={index}
              className={`${styles.dayColumn} ${isToday(date) ? styles.today : ''}`}
            >
              <div className={styles.dayName}>{formatDate(date)}</div>
            </div>
          ))}
        </div>

        {/* Contenido de usuarios */}
        {loading ? (
          <div className={styles.loadingContainer}>Cargando usuarios...</div>
        ) : shiftsLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <div>Cargando semana...</div>
          </div>
        ) : error ? (
          <div className={styles.errorContainer}>{error}</div>
        ) : users.length === 0 ? (
          <div className={styles.emptyContainer}>No se encontraron usuarios</div>
        ) : (
          // filter users by selected site if available
          users
            .filter((u: User) => selectedSiteId == null ? true : u.siteId === selectedSiteId)
            .map((user: User) => (
              <div key={user.id} className={styles.userRow}>
                {/* Columna de usuario */}
                <div className={styles.userCell}>
                  <div className={styles.userName}>
                    {user.firstName} {user.lastName}
                    {view === 'week' && userConfirmations.get(user.id) && (
                      <div className={styles.confirmationIndicator} title="Programación confirmada"></div>
                    )}
                  </div>
                  <div className={styles.userHours}>
                    {getUserTotalHours(user.id).toFixed(1)}h
                  </div>
                </div>

                {/* Una celda para cada día de la semana */}
                {weekDates.map((date: Date, dayIndex: number) => {
                  const shift = getShiftForUserAndDay(user.id, date);
                  const shiftTimeText = shift ? formatShiftTime(shift.startTime, shift.endTime) : "";
                  return (
                    <div
                      key={`${user.id}-${dayIndex}`}
                      className={`${styles.dayCell} ${isToday(date) ? styles.todayCell : ''}`}
                      onClick={() => handleCellClick(user.id, date)}
                    >
                      {shift ? (
                        <div
                          className={`${styles.shiftContent} ${!shift.published ? styles.unpublishedShift : ''}`}
                          style={{
                            backgroundColor: shift.positionColor ? 
                              `${shift.positionColor}${!shift.published ? '30' : '85'}` : 
                              (!shift.published ? 'rgba(251, 191, 36, 0.3)' : 'rgba(59, 130, 246, 0.85)'),
                            borderLeftColor: shift.positionColor || '#3b82f6',
                            color: shift.positionColor || '#fbbf24'
                          }}
                        >
                          {shiftTimeText && (
                            <div className={styles.shiftTime} style={{ fontWeight: 'normal' }}>
                              {shiftTimeText}
                            </div>
                          )}
                          {shift.position && (
                            <div className={styles.shiftPosition}>
                              {shift.position}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={styles.emptyCell}>
                          {/* Celda vacía pero clickeable */}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
        )}

        {/* Footer de totales (Sticky) */}
        <div className={styles.tableFooter}>
          <div className={styles.footerLabel}>Totales:</div>
          {weekDates.map((date, index) => {
            const dailyShifts = shifts.filter(s => s.date === date.toISOString().split('T')[0]);
            const totalHours = dailyShifts.reduce((acc, shift) => {
              return acc + calculateHours(shift.startTime, shift.endTime);
            }, 0);

            return (
              <div
                key={`footer-${index}`}
                className={styles.footerCell}
              >
                {totalHours > 0 ? `${totalHours.toFixed(1)}h` : '-'}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal for Position Selection */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={handleModalClose}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Asignar Turno</h3>
              {selectedCell && (
                <p>
                  Usuario: {users.find(u => u.id === selectedCell.userId)?.firstName} {users.find(u => u.id === selectedCell.userId)?.lastName}
                  <br />
                  Fecha: {selectedCell.date.toLocaleDateString()}
                </p>
              )}
              <button className={styles.modalCloseButton} onClick={handleModalClose}>
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              {modalLoading ? (
                <div className={styles.modalLoading}>Cargando posiciones...</div>
              ) : positions.length > 0 ? (
                <div className={styles.positionsGrid}>
                  {positions.map((position) => (
                    <div
                      key={position.id}
                      className={styles.positionCard}
                      onClick={() => handlePositionSelect(position.id)}
                      style={{
                        backgroundColor: position.color ? `${position.color}20` : '#f5f5f5',
                        borderLeftColor: position.color || '#ccc'
                      }}
                    >
                      <span className={styles.positionName}>{position.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.modalError}>No hay posiciones disponibles</div>
              )}
            </div>
            
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelButton} onClick={handleModalClose}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarComponent;