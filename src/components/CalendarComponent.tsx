"use client";

import { useState, useEffect } from "react";
import styles from "./CalendarComponent.module.css";

interface CalendarProps {}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  color: string;
}

interface Shift {
  id: number;
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  position?: string;
}

const CalendarComponent: React.FC<CalendarProps> = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'day'>('week');
  
  // Usuarios de ejemplo
  const users: User[] = [
    { id: 1, firstName: 'Juan', lastName: 'Pérez', color: '#3b82f6' },
    { id: 2, firstName: 'María', lastName: 'García', color: '#ef4444' },
    { id: 3, firstName: 'Carlos', lastName: 'López', color: '#10b981' },
    { id: 4, firstName: 'Ana', lastName: 'Martín', color: '#f59e0b' },
    { id: 5, firstName: 'Francisco', lastName: 'González', color: '#8b5cf6' },
  ];

  // Shifts de ejemplo - solo 1 por persona por día, incluyendo turnos para hoy (12 ene 2026)
  const shifts: Shift[] = [
    // Lunes 12 enero 2026 (HOY)
    { id: 1, userId: 1, date: '2026-01-12', startTime: '09:00', endTime: '18:00', position: 'Recepción' },
    { id: 2, userId: 3, date: '2026-01-12', startTime: '08:00', endTime: '17:00', position: 'Técnico' },
    { id: 3, userId: 4, date: '2026-01-12', startTime: '14:00', endTime: '22:00', position: 'Supervisión' },
    
    // Martes 13 enero 2026
    { id: 4, userId: 1, date: '2026-01-13', startTime: '08:00', endTime: '17:00', position: 'Administración' },
    { id: 5, userId: 2, date: '2026-01-13', startTime: '14:00', endTime: '22:00', position: 'Supervisión' },
    { id: 6, userId: 5, date: '2026-01-13', startTime: '09:00', endTime: '18:00', position: 'Gerencia' },
    
    // Miércoles 14 enero 2026
    { id: 7, userId: 2, date: '2026-01-14', startTime: '09:00', endTime: '18:00', position: 'Ventas' },
    { id: 8, userId: 4, date: '2026-01-14', startTime: '12:00', endTime: '21:00', position: 'Marketing' },
    
    // Jueves 15 enero 2026
    { id: 9, userId: 1, date: '2026-01-15', startTime: '08:00', endTime: '17:00', position: 'Recepción' },
    { id: 10, userId: 5, date: '2026-01-15', startTime: '10:00', endTime: '19:00', position: 'Administración' },
    
    // Viernes 16 enero 2026
    { id: 11, userId: 3, date: '2026-01-16', startTime: '10:00', endTime: '19:00', position: 'Soporte' },
    { id: 12, userId: 4, date: '2026-01-16', startTime: '09:00', endTime: '18:00', position: 'Técnico' },
    
    // Sábado 17 enero 2026
    { id: 13, userId: 2, date: '2026-01-17', startTime: '08:00', endTime: '16:00', position: 'Supervisión' },
    
    // Domingo 18 enero 2026
    { id: 14, userId: 5, date: '2026-01-18', startTime: '12:00', endTime: '20:00', position: 'Gerencia' },
  ];
  
  // Obtener exactamente 7 días de la semana (lunes a domingo)
  const getWeekDates = (date: Date) => {
    const currentDate = new Date(date);
    const dayOfWeek = currentDate.getDay(); // 0=domingo, 1=lunes, 2=martes...
    
    // Calcular cuántos días restar para llegar al lunes
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    // Crear el lunes de esta semana
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() - daysFromMonday);
    
    // Crear array con los 7 días
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      weekDates.push(dayDate);
    }
    
    console.log('Week dates:', weekDates.map(d => d.toDateString())); // Debug
    return weekDates;
  };

  const weekDates = getWeekDates(currentDate);
  const today = new Date();
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-AR', { 
      weekday: 'short', 
      day: 'numeric',
      month: 'short'
    });
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
    const start = startTime.substring(0, 5); // "09:00" de "09:00:00"
    const end = endTime.substring(0, 5);
    return `${start} a ${end}hs`;
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
        <div className={styles.navigationControls}>
          <button onClick={goToPrevWeek} className={styles.navButton}>
            ← Anterior
          </button>
          <button onClick={goToToday} className={styles.todayButton}>
            Hoy
          </button>
          <button onClick={goToNextWeek} className={styles.navButton}>
            Siguiente →
          </button>
        </div>
        
        <h2 className={styles.monthTitle}>
          {formatMonth(currentDate)}
        </h2>
        
        <div className={styles.viewToggle}>
          <button 
            className={`${styles.toggleButton} ${styles.active}`}
          >
            Semana
          </button>
          {/* Vista día - implementar después */}
          <button 
            className={styles.toggleButton}
            disabled
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            Día (próximamente)
          </button>
        </div>
      </div>

      {/* Vista de calendario tipo tabla */}
      <div className={styles.calendarTable}>
        {/* Header de la tabla */}
        <div className={styles.tableHeader}>
          <div className={styles.userColumn}>Usuarios</div>
          {/* Siempre mostrar los 7 días en vista semanal */}
          {weekDates.map((date, index) => (
            <div 
              key={index} 
              className={`${styles.dayColumn} ${isToday(date) ? styles.today : ''}`}
            >
              <div className={styles.dayName}>{formatDate(date)}</div>
            </div>
          ))}
        </div>

        {/* Filas de usuarios */}
        <div className={styles.tableBody}>
          {users.map(user => (
            <div key={user.id} className={styles.userRow}>
              {/* Columna de usuario */}
              <div className={styles.userCell}>
                <div className={styles.userName}>
                  {user.firstName} {user.lastName}
                </div>
                <div className={styles.userHours}>
                  40h {/* Aquí irían las horas calculadas */}
                </div>
              </div>
              
              {/* Una celda para cada día de la semana */}
              {weekDates.map((date, dayIndex) => {
                const shift = getShiftForUserAndDay(user.id, date);
                return (
                  <div 
                    key={`${user.id}-${dayIndex}`}
                    className={`${styles.dayCell} ${isToday(date) ? styles.todayCell : ''}`}
                    onClick={() => handleCellClick(user.id, date)}
                    style={{ borderColor: user.color }}
                  >
                    {shift ? (
                      <div className={styles.shiftContent} style={{ backgroundColor: user.color + '20', borderLeft: `3px solid ${user.color}` }}>
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarComponent;