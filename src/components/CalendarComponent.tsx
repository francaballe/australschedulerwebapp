"use client";

import { useState, useEffect } from "react";
import styles from "./CalendarComponent.module.css";

interface CalendarProps {}

const CalendarComponent: React.FC<CalendarProps> = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'day'>('week');
  
  // Obtener la semana actual
  const getWeekDates = (date: Date) => {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Empezar el lunes
    startOfWeek.setDate(diff);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      week.push(day);
    }
    return week;
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

  // Horarios del día (placeholder)
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', 
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  // Usuarios de ejemplo (esto vendría de la API)
  const users = [
    { id: 1, name: 'Juan Pérez', color: '#3b82f6' },
    { id: 2, name: 'María García', color: '#ef4444' },
    { id: 3, name: 'Carlos López', color: '#10b981' },
    { id: 4, name: 'Ana Martín', color: '#f59e0b' },
  ];

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
        </div>
      </div>

      {/* Grid del calendario */}
      <div className={styles.calendarGrid}>
        {/* Header con los días de la semana */}
        <div className={styles.daysHeader}>
          <div className={styles.timeColumn}></div>
          {view === 'week' ? weekDates.map((date, index) => (
            <div 
              key={index} 
              className={`${styles.dayHeader} ${isToday(date) ? styles.today : ''}`}
            >
              {formatDate(date)}
            </div>
          )) : (
            <div className={`${styles.dayHeader} ${styles.singleDay}`}>
              {formatDate(currentDate)}
            </div>
          )}
        </div>

        {/* Grid de horarios */}
        <div className={styles.timeGrid}>
          {timeSlots.map((time) => (
            <div key={time} className={styles.timeRow}>
              <div className={styles.timeLabel}>{time}</div>
              {view === 'week' ? weekDates.map((date, dayIndex) => (
                <div 
                  key={`${time}-${dayIndex}`} 
                  className={`${styles.timeSlot} ${isToday(date) ? styles.todaySlot : ''}`}
                  onClick={() => {
                    // Aquí iría la lógica para abrir el diálogo de asignación
                    console.log(`Clicked on ${time} for ${date.toDateString()}`);
                  }}
                >
                  {/* Aquí irían los turnos asignados */}
                </div>
              )) : (
                <div 
                  className={`${styles.timeSlot} ${styles.singleDaySlot}`}
                  onClick={() => {
                    console.log(`Clicked on ${time} for ${currentDate.toDateString()}`);
                  }}
                >
                  {/* Turnos del día específico */}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Panel lateral de usuarios (simplificado) */}
      <div className={styles.usersSidebar}>
        <h3>Personal</h3>
        <div className={styles.usersList}>
          {users.map(user => (
            <div key={user.id} className={styles.userItem}>
              <div 
                className={styles.userColor} 
                style={{ backgroundColor: user.color }}
              ></div>
              <span>{user.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarComponent;