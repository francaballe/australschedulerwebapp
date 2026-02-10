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
  startTime: string;
  endTime: string;
  position?: string;
  positionColor?: string;
  published: boolean;
}

const CalendarComponent: React.FC<CalendarProps> = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'day' | 'twoWeeks'>('week');

  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      try {
        const usersData = await loadUsers(selectedSiteId);
        const shiftsData = await fetchShifts(weekDates);
        const userIds = new Set(usersData.map(u => u.id));
        const filtered = shiftsData.filter(s => userIds.has(s.userId));
        setShifts(filtered);
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
    try {
      const usersData = await loadUsers(selectedSiteId);
      const shiftsData = await fetchShifts(weekDates);
      const userIds = new Set(usersData.map(u => u.id));
      const filtered = shiftsData.filter(s => userIds.has(s.userId));
      setShifts(filtered);
    } catch (err) {
      console.error('Error refreshing calendar data:', err);
    } finally {
      setShiftsLoading(false);
    }
  };

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
  const formatShiftTime = (startTime: string, endTime: string): string => {
    const to12 = (time: string) => {
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
  const calculateHours = (startTime: string, endTime: string): number => {
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
    // Aquí iría la lógica para abrir el diálogo de asignación/edición
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

        <div className={styles.headerActions}>
          <button className={styles.actionButton} title="Actualizar" onClick={() => refreshData()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <button className={styles.actionButton} title="Imprimir">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
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
                  </div>
                  <div className={styles.userHours}>
                    {getUserTotalHours(user.id).toFixed(1)}h
                  </div>
                </div>

                {/* Una celda para cada día de la semana */}
                {weekDates.map((date: Date, dayIndex: number) => {
                  const shift = getShiftForUserAndDay(user.id, date);
                  return (
                    <div
                      key={`${user.id}-${dayIndex}`}
                      className={`${styles.dayCell} ${isToday(date) ? styles.todayCell : ''}`}
                      onClick={() => handleCellClick(user.id, date)}
                    >
                      {shift ? (
                        <div
                          className={`${styles.shiftContent} ${!shift.published ? styles.unpublishedShift : ''}`}
                          style={shift.positionColor ? {
                            backgroundColor: `${shift.positionColor}${!shift.published ? '40' : '20'}`,
                            borderLeftColor: shift.positionColor
                          } : {}}
                        >
                          <div className={styles.shiftTime}>
                            {formatShiftTime(shift.startTime, shift.endTime)}
                          </div>
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
    </div>
  );
};

export default CalendarComponent;