"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./CalendarComponent.module.css";

interface CalendarProps {
  enabledPositions: Set<number>;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  view: 'week' | 'day' | 'twoWeeks';
  setView: (view: 'week' | 'day' | 'twoWeeks') => void;
  onStatsUpdate?: (stats: { unpublishedCount: number }) => void;
}

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
  positionId: number;
  position?: string;
  positionColor?: string;
  published: boolean;
  isUserUnavailable?: boolean;
}

interface Position {
  id: number;
  name: string;
  color: string;
  starttime: string | null;
  endtime: string | null;
}

const CalendarComponent: React.FC<CalendarProps> = ({
  enabledPositions,
  currentDate,
  setCurrentDate,
  view,
  setView,
  onStatsUpdate
}) => {
  // Local state removed for currentDate and view (lifted)

  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [unavailableSet, setUnavailableSet] = useState<Set<string>>(new Set());
  const [userConfirmations, setUserConfirmations] = useState<Map<number, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ userId: number, date: Date } | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [notifyUserOnDelete, setNotifyUserOnDelete] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);
  const [selectedStartTime, setSelectedStartTime] = useState<string>('');
  const [selectedEndTime, setSelectedEndTime] = useState<string>('');

  // Copy week state
  const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);

  // Delete week state
  const [showDeleteWeekConfirmation, setShowDeleteWeekConfirmation] = useState(false);
  const [deleteWeekLoading, setDeleteWeekLoading] = useState(false);
  const [deleteWeekWarningType, setDeleteWeekWarningType] = useState<'published' | 'unpublished'>('unpublished');

  // Warning modal state
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Drag & drop states
  const [draggedShift, setDraggedShift] = useState<Shift | null>(null);
  const [dropTarget, setDropTarget] = useState<{ userId: number; dateStr: string } | null>(null);

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

    return () => {
      window.removeEventListener('siteChanged', handler as EventListener);
    };
  }, []);

  // Separate effect: listen for search events and update users/shifts accordingly.
  useEffect(() => {
    const searchHandler = (e: any) => {
      const q = e?.detail ?? '';
      (async () => {
        try {
          const url = selectedSiteId ? `/api/users?siteId=${selectedSiteId}&q=${encodeURIComponent(q)}` : `/api/users?q=${encodeURIComponent(q)}`;
          const resp = await fetch(url);
          if (!resp.ok) return;
          const data = await resp.json();
          setUsers(data);

          // Reload shifts for the visible week and filter them to the found users
          try {
            const dates = getWeekDates(currentDate);
            const shiftsData = await fetchShifts(dates);
            const userIds = new Set(data.map((u: User) => u.id));
            const filtered = shiftsData.filter((s: Shift) => userIds.has(s.userId));
            setShifts(filtered);

            // Refresh confirmations for week view
            if (view === 'week' && dates.length > 0) {
              const weekStartDate = formatDateLocal(dates[0]);
              await fetchUserConfirmations(weekStartDate, data);
            }
          } catch (innerErr) {
            console.error('Error updating shifts after search:', innerErr);
          }
        } catch (err) {
          console.error('Search fetch error', err);
        }
      })();
    };

    window.addEventListener('userSearch', searchHandler as EventListener);

    return () => {
      window.removeEventListener('userSearch', searchHandler as EventListener);
    };
  }, [selectedSiteId, currentDate, view]);

  // Helper to format date as YYYY-MM-DD in local time
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchShifts = async (dates: Date[]) => {
    if (dates.length === 0) return [] as Shift[];

    try {
      const startDate = formatDateLocal(dates[0]);
      const endDate = formatDateLocal(dates[dates.length - 1]);

      const response = await fetch(`/api/shifts?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) {
        throw new Error('Error al cargar turnos');
      }
      const data = await response.json();

      // Data consistency check: detect multiple shifts per user per day
      const shiftsByUserDate = new Map<string, Shift[]>();

      (data as Shift[]).forEach(shift => {
        const key = `${shift.userId}-${shift.date}`;
        if (!shiftsByUserDate.has(key)) {
          shiftsByUserDate.set(key, []);
        }
        shiftsByUserDate.get(key)!.push(shift);
      });

      // Report inconsistencies
      const inconsistencies = Array.from(shiftsByUserDate.entries())
        .filter(([key, shifts]) => shifts.length > 1);

      if (inconsistencies.length > 0) {
        console.warn('🔥 DATA INCONSISTENCY DETECTED: Multiple shifts per user per day:',
          inconsistencies.reduce((acc, [key, shifts]) => {
            acc[key] = shifts;
            return acc;
          }, {} as Record<string, Shift[]>)
        );
      }

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
  const createShiftAssignment = async (userId: number, date: Date, positionId: number, startTime?: string, endTime?: string) => {
    try {
      const dateStr = formatDateLocal(date);

      // Check for existing shift on this user/date
      const existingShift = shifts.find(shift => shift.userId === userId && shift.date === dateStr);

      if (existingShift) {
        // PATCH existing shift — include position's schedule
        const selectedPosition = positions.find(p => p.id === positionId);

        // Use provided times or fallback to position defaults (or maintain existing if not provided, but here we expect overrides)
        // If startTime/endTime are passed, use them.
        const useStartTime = startTime !== undefined ? startTime : (selectedPosition?.starttime || null);
        const useEndTime = endTime !== undefined ? endTime : (selectedPosition?.endtime || null);

        const patchData: any = {
          positionId,
          published: false,
          startTime: useStartTime,
          endTime: useEndTime
        };

        console.log(`🔄 PATCHing existing shift ${existingShift.id} for user ${userId} on ${dateStr}:`, patchData);

        const response = await fetch(`/api/shifts/${existingShift.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchData)
        });

        if (!response.ok) {
          let errorMessage = `Error al actualizar turno (${response.status})`;
          try {
            const errorData = await response.json();
            if (errorData?.error) errorMessage = errorData.error;
          } catch { }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('✅ Shift updated:', result);
      } else {
        // POST new shift
        const requestData = {
          userId,
          date: dateStr,
          positionId,
          published: false,
        };

        console.log('📤 Creating new shift:', requestData);

        const response = await fetch('/api/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });

        if (!response.ok) {
          let errorMessage = `Error al crear la asignación (${response.status})`;
          try {
            const errorData = await response.json();
            if (errorData?.error) errorMessage = errorData.error;
          } catch { }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('✅ Shift created:', result);
      }

      // Notify sidebar/calendar to enable this position filter so the new shift is visible
      try {
        window.dispatchEvent(new CustomEvent('enablePosition', { detail: positionId }));
      } catch { }

      // Refresh shifts data
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('❌ Failed to create/update shift:', err);
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
  // Obtener días de la semana (domingo a sábado)
  const getWeekDates = (date: Date) => {
    const currentDate = new Date(date);

    // If view is 'day', just return that single day
    if (view === 'day') {
      return [currentDate];
    }

    const dayOfWeek = currentDate.getDay(); // 0=domingo, 1=lunes...

    // Crear el domingo de esta semana (reset local time to midnight)
    const sunday = new Date(currentDate);
    sunday.setHours(0, 0, 0, 0); // Essential for local consistency
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

  // Calculate filtered users - only show users that have shifts with enabled positions in current week
  const filteredUsers = users.filter(user => {
    // If no positions are enabled (or strictly if list is empty, though UI typically defaults to all), show all?
    // Actually, if size is 0 it implies nothing selected.
    if (enabledPositions.size === 0) {
      return true;
    }

    // Check if user has unavailability in current week and Unavailable filter is active
    // We assume ID 1 is "Unavailable"
    if (enabledPositions.has(1) && weekDates.some(d => unavailableSet.has(`${user.id}-${formatDateLocal(d)}`))) {
      return true;
    }

    // Check if user has any shift with an enabled position in the current week
    const weekStart = formatDateLocal(weekDates[0]);
    const weekEnd = formatDateLocal(weekDates[weekDates.length - 1]);

    // Group user's shifts by date to avoid counting duplicates
    const userShiftsByDate = new Map<string, Shift[]>();

    shifts
      .filter(shift =>
        shift.userId === user.id &&
        shift.date >= weekStart &&
        shift.date <= weekEnd
      )
      .forEach(shift => {
        if (!userShiftsByDate.has(shift.date)) {
          userShiftsByDate.set(shift.date, []);
        }
        userShiftsByDate.get(shift.date)!.push(shift);
      });

    // Strategy:
    // 1. If user has visible shifts (matching enabled filters), SHOW.
    // 2. If user has NO shifts, and "No Position" (0) is enabled, SHOW.
    // 3. If user has Unavailability, and "Unavailable" (1) is enabled, SHOW (handled above, but let's ensure flow).

    const hasVisibleShifts = Array.from(userShiftsByDate.values()).some(shiftsForDate => {
      if (shiftsForDate.length > 1) {
        console.warn(`Multiple shifts for user ${user.id} on date:`, shiftsForDate);
      }
      return shiftsForDate.some(shift => enabledPositions.has(shift.positionId));
    });

    if (hasVisibleShifts) return true;

    // Special case: User has NO shifts in this week, and "No Position" (0) is enabled.
    if (userShiftsByDate.size === 0 && enabledPositions.has(0)) {
      return true;
    }

    return false;
  });

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

        // Fetch availability for the same date range
        try {
          const startDate = formatDateLocal(weekDates[0]);
          const endDate = formatDateLocal(weekDates[weekDates.length - 1]);
          const availResp = await fetch(`/api/availability?startDate=${startDate}&endDate=${endDate}`);
          if (availResp.ok) {
            const availData = await availResp.json();
            const newSet = new Set<string>(availData.map((a: any) => `${a.userId}-${a.date}`));
            setUnavailableSet(newSet);
          }
        } catch (availErr) {
          console.error('Error fetching availability:', availErr);
        }

        // Only fetch confirmations for week view
        if (view === 'week' && weekDates.length > 0) {
          const weekStartDate = formatDateLocal(weekDates[0]);
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
    // Show full screen loading
    setShiftsLoading(true);

    try {
      console.log('🔄 Refreshing calendar data...');

      // We don't need to reload users every time, just shifts for the current view
      // const usersData = await loadUsers(selectedSiteId); 
      // setUsers(usersData); 

      // Use current weekDates state
      const shiftsData = await fetchShifts(weekDates);
      const userIds = new Set(users.map(u => u.id)); // Use existing users
      const filtered = shiftsData.filter(s => userIds.has(s.userId));
      setShifts(filtered);

      // Fetch availability for the same date range
      try {
        if (weekDates.length > 0) {
          const startDate = formatDateLocal(weekDates[0]);
          const endDate = formatDateLocal(weekDates[weekDates.length - 1]);
          const availResp = await fetch(`/api/availability?startDate=${startDate}&endDate=${endDate}`);
          if (availResp.ok) {
            const availData = await availResp.json();
            const newSet = new Set<string>(availData.map((a: any) => `${a.userId}-${a.date}`));
            setUnavailableSet(newSet);
          }
        }
      } catch (availErr) {
        console.error('Error fetching availability:', availErr);
      }

      // Only fetch confirmations for week view
      if (view === 'week' && weekDates.length > 0) {
        const weekStartDate = formatDateLocal(weekDates[0]);
        await fetchUserConfirmations(weekStartDate, users);
      }
    } catch (err) {
      console.error('Error refreshing calendar data:', err);
      // Don't wipe data on error
    } finally {
      setShiftsLoading(false);
    }
  };

  // Listen for publish and position update events to refresh data
  useEffect(() => {
    const handlePublish = () => {
      console.log('🔄 Detected published shifts - refreshing calendar');
      refreshData();
    };
    const handlePositions = (e: any) => {
      console.log('🔄 Detected position changes - updating local state:', e.detail);
      const { positionId, color, name, starttime, endtime } = e.detail;

      // Update shifts locally
      setShifts(prev => prev.map(s => {
        if (s.positionId === positionId) {
          return {
            ...s,
            ...(color !== undefined && { positionColor: color }),
            ...(name !== undefined && { position: name })
          };
        }
        return s;
      }));

      // Update positions list (for assignment modal) locally
      setPositions(prev => prev.map(p => {
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
      }));
    };

    window.addEventListener('publishedShifts', handlePublish);
    window.addEventListener('positionsUpdated', handlePositions);

    return () => {
      window.removeEventListener('publishedShifts', handlePublish);
      window.removeEventListener('positionsUpdated', handlePositions);
    };
  }, [refreshData]);

  // Notify parent about conflict shifts count
  useEffect(() => {
    const count = shifts.filter(s => s.isUserUnavailable).length;
    try {
      window.dispatchEvent(new CustomEvent('conflictShiftsCount', { detail: count }));
    } catch { }
  }, [shifts]);

  // Calculate unpublished count explicitly for parent
  useEffect(() => {
    const unpublished = shifts.filter(s => !s.published).length;
    onStatsUpdate?.({ unpublishedCount: unpublished });
  }, [shifts, onStatsUpdate]);

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
    const nextDate = new Date(currentDate);
    if (view === 'day') {
      nextDate.setDate(currentDate.getDate() + 1);
    } else if (view === 'twoWeeks') {
      nextDate.setDate(currentDate.getDate() + 14);
    } else {
      nextDate.setDate(currentDate.getDate() + 7);
    }
    setCurrentDate(nextDate);
  };

  const goToPrevWeek = () => {
    const prevDate = new Date(currentDate);
    if (view === 'day') {
      prevDate.setDate(currentDate.getDate() - 1);
    } else if (view === 'twoWeeks') {
      prevDate.setDate(currentDate.getDate() - 14);
    } else {
      prevDate.setDate(currentDate.getDate() - 7);
    }
    setCurrentDate(prevDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  // Obtener shift para un usuario en una fecha específica
  const getShiftForUserAndDay = (userId: number, date: Date): Shift | undefined => {
    const dateStr = formatDateLocal(date);



    // Get all shifts for this user on this date
    const userShiftsForDate = shifts.filter(shift =>
      shift.userId === userId && shift.date === dateStr
    );

    // If multiple shifts exist (data inconsistency), log warning and take the first one
    if (userShiftsForDate.length > 1) {
      console.warn(`Multiple shifts found for user ${userId} on ${dateStr}:`, userShiftsForDate);
    }

    // Return the first shift (regardless of position filter)
    return userShiftsForDate[0];
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
    // Si startTime o endTime son null/undefined, retornar 0
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
    if (enabledPositions.size === 0) {
      return 0;
    }

    // Group shifts by date to detect duplicates
    const shiftsByDate = new Map<string, Shift[]>();

    shifts
      .filter(s => s.userId === userId)
      .forEach(shift => {
        const date = shift.date;
        if (!shiftsByDate.has(date)) {
          shiftsByDate.set(date, []);
        }
        shiftsByDate.get(date)!.push(shift);
      });

    let totalHours = 0;

    // For each date, only count the first shift (log if duplicates found)
    shiftsByDate.forEach((shiftsForDate, date) => {
      if (shiftsForDate.length > 1) {
        console.warn(`Multiple shifts for user ${userId} on ${date}:`, shiftsForDate);
      }
      // Only count the first shift
      const shift = shiftsForDate[0];
      totalHours += calculateHours(shift.startTime, shift.endTime);
    });

    return totalHours;
  };

  // ── Drag & Drop helpers ──

  const isShiftDraggable = (shift: Shift): boolean => {
    // Allow dragging conflicts (isUserUnavailable=true) if it's a real position.
    // Prevent dragging only if it's a "pure" unavailability record (Position ID 1).
    if (shift.positionId === 1) return false;
    return true;
  };

  const handleDragStart = (e: React.DragEvent, shift: Shift) => {
    if (!isShiftDraggable(shift)) {
      e.preventDefault();
      return;
    }
    setDraggedShift(shift);
    e.dataTransfer.effectAllowed = 'move';
    // Use a small timeout so the browser captures the element before we style it
    setTimeout(() => {
      (e.target as HTMLElement).classList.add(styles.dragging);
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove(styles.dragging);
    setDraggedShift(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, userId: number, date: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const dateStr = formatDateLocal(date);
    if (!dropTarget || dropTarget.userId !== userId || dropTarget.dateStr !== dateStr) {
      setDropTarget({ userId, dateStr });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the cell (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDropTarget(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetUserId: number, targetDate: Date) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);

    if (!draggedShift) return;

    const targetDateStr = formatDateLocal(targetDate);

    // No-op if dropped on original cell
    if (draggedShift.userId === targetUserId && draggedShift.date === targetDateStr) {
      setDraggedShift(null);
      return;
    }

    // Check if target cell already has a shift
    const existing = getShiftForUserAndDay(targetUserId, targetDate);
    if (existing) {
      setWarningMessage('Ya existe un turno en esta celda. Por favor, elimínelo antes de mover otro turno aquí.');
      setDraggedShift(null);
      return;
    }

    try {
      const response = await fetch(`/api/shifts/${draggedShift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          date: new Date(targetDateStr),
          published: false // Explicitly unpublish when moving
        })
      });

      if (!response.ok) {
        throw new Error('Error al mover turno');
      }

      await refreshData();
    } catch (err: any) {
      console.error('Failed to move shift:', err);
      // alert(`Error al mover turno: ${err.message}`); // Optional: could use warning modal for errors too, but maybe less critical for "ugly" alerts.
      // Let's use warning modal for consistency if desired, or leave alerts for technical errors.
      // User asked for "drag collision" alert replacement specifically. But error handling is nicer too.
      setWarningMessage(`No se pudo mover el turno: ${err.message}`);
    } finally {
      setDraggedShift(null);
    }
  };

  // Manejar click en celda
  const handleCellClick = (userId: number, date: Date) => {
    // Don't open modal if we just finished a drag
    if (draggedShift) return;

    console.log(`Clicked on user ${userId} for date ${date.toDateString()}`);

    // Open modal for position selection
    const existingShift = getShiftForUserAndDay(userId, date);
    setSelectedPositionId(existingShift ? existingShift.positionId : null);
    setSelectedStartTime(existingShift?.startTime || '');
    setSelectedEndTime(existingShift?.endTime || '');

    setSelectedCell({ userId, date });
    setIsModalOpen(true);
    fetchPositions(); // Load available positions
  };

  // Modal handlers
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCell(null);
    setShowDeleteConfirmation(false);
    setSelectedPositionId(null);
    setSelectedStartTime('');
    setSelectedEndTime('');
  };

  const handlePositionSelect = async (positionId: number) => {
    if (!selectedCell) return;

    // Check for existing shift to determine mode
    const existingShift = shifts.find(s =>
      s.userId === selectedCell.userId &&
      s.date === formatDateLocal(selectedCell.date)
    );

    if (existingShift) {
      // Editing: Manual save mode -> Just select
      setSelectedPositionId(positionId);
      // Update times to new position defaults if available
      const pos = positions.find(p => p.id === positionId);
      if (pos) {
        setSelectedStartTime(pos.starttime || '');
        setSelectedEndTime(pos.endtime || '');
      }
    } else {
      // Creating: Auto save mode -> Save immediately
      const success = await createShiftAssignment(selectedCell.userId, selectedCell.date, positionId);
      if (success) {
        handleModalClose();
      }
    }
  };

  const handleSaveAssignment = async () => {
    if (!selectedCell || selectedPositionId === null) return;

    // Client-side validation: check for existing shifts
    const existingShifts = shifts.filter(s =>
      s.userId === selectedCell.userId &&
      s.date === formatDateLocal(selectedCell.date)
    );

    if (existingShifts.length > 1) {
      console.error('Multiple shifts detected for this user/date. Data cleanup required.');
      alert('Error: Se detectaron múltiples turnos para este usuario en esta fecha. Se requiere limpieza de datos.');
      return;
    }

    const success = await createShiftAssignment(
      selectedCell.userId,
      selectedCell.date,
      selectedPositionId,
      selectedStartTime,
      selectedEndTime
    );
    if (success) {
      handleModalClose();
    }
  };



  const handleDeleteShift = async (confirmed: boolean = false) => {
    if (!selectedCell) return;

    // Get all shifts for this user/date
    const allShifts = shifts.filter(s =>
      s.userId === selectedCell.userId &&
      s.date === formatDateLocal(selectedCell.date)
    );

    if (allShifts.length === 0) return;

    if (allShifts.length > 1) {
      console.warn('Multiple shifts found for delete operation:', allShifts);
      alert('Se encontraron múltiples turnos. Se eliminará el primero.');
    }

    const shift = allShifts[0]; // Take the first one

    // If shift is published and not yet confirmed, show confirmation
    if (shift.published && !confirmed) {
      setShowDeleteConfirmation(true);
      return;
    }

    try {
      setModalLoading(true);

      // Delete the shift (availability is managed separately)
      // Pass notification preference if confirmed (for published shifts)
      const queryParams = confirmed && notifyUserOnDelete ? '?notify=true' : '';
      const response = await fetch(`/api/shifts/${shift.id}${queryParams}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar turno');
      }

      await refreshData();
      handleModalClose();
    } catch (err: any) {
      console.error('Failed to delete/revert shift:', err);
      alert('Error al eliminar turno');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCopyWeekClick = () => {
    // Check if current week has any shifts
    // Filter shifts that are within the current week range
    const weekStart = formatDateLocal(weekDates[0]);
    const weekEnd = formatDateLocal(weekDates[weekDates.length - 1]);

    const shiftsInWeek = shifts.filter(s =>
      s.date >= weekStart && s.date <= weekEnd
    );

    if (shiftsInWeek.length > 0) {
      setShowCopyConfirmation(true);
    } else {
      confirmCopyWeek();
    }
  };

  const confirmCopyWeek = async () => {
    try {
      setCopyLoading(true);

      const targetDate = formatDateLocal(weekDates[0]);

      // Calculate source date (7 days before target)
      const sourceDateObj = new Date(weekDates[0]);
      sourceDateObj.setDate(sourceDateObj.getDate() - 7);
      const sourceDate = formatDateLocal(sourceDateObj);

      console.log(`📋 Copying week from ${sourceDate} to ${targetDate}`);

      const response = await fetch('/api/shifts/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate, sourceDate })
      });

      if (!response.ok) {
        throw new Error('Error al copiar semana');
      }

      const result = await response.json();
      console.log('✅ Copy successful:', result);

      await refreshData();
      setShowCopyConfirmation(false);

    } catch (err: any) {
      console.error('Failed to copy week:', err);
      setWarningMessage(`Error al copiar la semana anterior: ${err.message}`);
    } finally {
      setCopyLoading(false);
    }
  };

  const handleDeleteWeekClick = () => {
    // Filter shifts that are within the current week range
    const weekStart = formatDateLocal(weekDates[0]);
    const weekEnd = formatDateLocal(weekDates[weekDates.length - 1]);

    // Check if there are ANY shifts (excluding unavailable if we wanted, but "delete week" usually means clear everything)
    // Actually, user might want to keep Unavailability?
    // "borrar la semana" -> Delete shifts.
    // Let's check for standard shifts.
    const shiftsInWeek = shifts.filter(s =>
      s.date >= weekStart && s.date <= weekEnd && s.positionId !== 1
    );

    if (shiftsInWeek.length === 0) {
      setWarningMessage('No hay turnos para eliminar en esta semana.');
      return;
    }

    // Check for published shifts
    const hasPublishedShifts = shiftsInWeek.some(s => s.published);
    setDeleteWeekWarningType(hasPublishedShifts ? 'published' : 'unpublished');
    setShowDeleteWeekConfirmation(true);
  };

  const confirmDeleteWeek = async () => {
    try {
      setDeleteWeekLoading(true);
      const weekStart = formatDateLocal(weekDates[0]);
      const weekEnd = formatDateLocal(weekDates[weekDates.length - 1]);

      console.log(`🗑️ Deleting week from ${weekStart} to ${weekEnd}`);

      const response = await fetch(`/api/shifts?startDate=${weekStart}&endDate=${weekEnd}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar semana');
      }

      await refreshData();
      setShowDeleteWeekConfirmation(false);

    } catch (err: any) {
      console.error('Failed to delete week:', err);
      // reusing warning modal for error
      setWarningMessage(`Error al eliminar la semana: ${err.message}`);
      setShowDeleteWeekConfirmation(false);
    } finally {
      setDeleteWeekLoading(false);
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
            <button className={styles.actionButton} title="Copiar semana anterior" onClick={handleCopyWeekClick}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          )}
          {view === 'week' && (
            <button className={`${styles.actionButton} ${styles.deleteAction}`} title="Borrar semana completa" onClick={handleDeleteWeekClick}>
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
            <div>
              {view === 'day' ? 'Cargando día...' :
                view === 'twoWeeks' ? 'Cargando 2 semanas...' :
                  'Cargando semana...'}
            </div>
          </div>
        ) : error ? (
          <div className={styles.errorContainer}>{error}</div>
        ) : users.length === 0 ? (
          <div className={styles.emptyContainer}>No se encontraron usuarios</div>
        ) : (
          // filter users by selected site if available
          filteredUsers
            .filter((u: User) => selectedSiteId == null ? true : u.siteId === selectedSiteId)
            .map((user: User) => (
              <div key={user.id} className={styles.userRow}>
                {/* Columna de usuario */}
                <div className={styles.userCell}>
                  <div className={styles.userName}>
                    {user.firstName} {user.lastName}
                    <div className={styles.userStatusIcons}>
                      {/* Confirmation Slot - Always rendered to maintain spacing */}
                      <div
                        className={styles.confirmationIndicator}
                        title={view === 'week' && userConfirmations.get(user.id) ? "Programación confirmada" : undefined}
                        style={{
                          visibility: (view === 'week' && userConfirmations.get(user.id)) ? 'visible' : 'hidden'
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: '14px', height: '14px' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>

                      {/* Overtime Slot */}
                      {getUserTotalHours(user.id) > 40 && (
                        <div className={styles.overtimeIndicator} title="Horas excedidas (>40hs)">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.userHours}>
                    {getUserTotalHours(user.id).toFixed(1)}
                  </div>
                </div>

                {/* Una celda para cada día de la semana */}
                {weekDates.map((date: Date, dayIndex: number) => {
                  const shift = getShiftForUserAndDay(user.id, date);
                  const shiftTimeText = shift ? formatShiftTime(shift.startTime, shift.endTime) : "";
                  const isFilteredOut = shift ? !enabledPositions.has(shift.positionId) : false;
                  const dateStr = formatDateLocal(date);
                  const isDropTarget = dropTarget?.userId === user.id && dropTarget?.dateStr === dateStr;
                  return (
                    <div
                      key={`${user.id}-${dayIndex}`}
                      className={`${styles.dayCell} ${isToday(date) ? styles.todayCell : ''} ${isDropTarget ? styles.dropTargetCell : ''}`}
                      onClick={() => handleCellClick(user.id, date)}
                      onDragOver={(e) => handleDragOver(e, user.id, date)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, user.id, date)}
                    >
                      {shift ? (
                        <div
                          className={`${styles.shiftContent} ${!shift.published ? styles.unpublishedShift : ''} ${isFilteredOut ? styles.filteredShift : ''}`}
                          draggable={isShiftDraggable(shift)}
                          onDragStart={(e) => handleDragStart(e, shift)}
                          onDragEnd={handleDragEnd}
                          style={{
                            backgroundColor: isFilteredOut
                              ? '#f3f4f6' // Light gray for filtered/ghost items
                              : (shift.positionColor ?
                                `${shift.positionColor}${!shift.published ? '30' : '85'}` :
                                (!shift.published ? 'rgba(251, 191, 36, 0.3)' : 'rgba(59, 130, 246, 0.85)')),
                            borderLeftColor: shift.positionColor || '#3b82f6',
                            color: isFilteredOut ? 'var(--foreground-secondary, #94a3b8)' : (shift.positionColor || '#fbbf24'),
                            position: 'relative'
                          }}
                          title={shift.isUserUnavailable ? 'Conflicto: usuario no disponible con turno asignado' : undefined}
                        >
                          {shift.isUserUnavailable && (
                            <div className={styles.unavailableWarningOverlay} title="Usuario NO disponible — turno asignado por manager">
                              <svg className={styles.unavailableWarningIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L2 22H22L12 2Z" fill="#FBBF24" stroke="black" strokeWidth="2" strokeLinejoin="round" />
                                <path d="M12 9V14" stroke="black" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="12" cy="19" r="1.5" fill="black" />
                              </svg>
                            </div>
                          )}
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
                      ) : unavailableSet.has(`${user.id}-${dateStr}`) ? (
                        <div
                          className={styles.shiftContent}
                          style={{
                            backgroundColor: (enabledPositions.has(1) || enabledPositions.size === 0) ? '#9E9E9E40' : 'transparent',
                            borderLeftColor: '#9E9E9E',
                            color: '#9E9E9E',
                            position: 'relative'
                          }}
                          title="Usuario no disponible"
                        >
                          <span className={styles.positionName} style={{ color: '#9E9E9E', fontStyle: 'italic' }}>No Disponible</span>
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
          <div className={styles.footerLabel}>
            <span>Horas Totales</span>
            <span>
              {(() => {
                // Calculate grand total of all visible shifts for enabled users
                if (view === 'day') return null;
                const total = filteredUsers.reduce((acc, user) => acc + getUserTotalHours(user.id), 0);
                return total > 0 ? total.toFixed(1) : '';
              })()}
            </span>
          </div>
          {weekDates.map((date, index) => {
            const dateStr = formatDateLocal(date);
            // Group shifts by user to avoid counting duplicates
            const dailyShiftsMap = new Map<number, Shift>();

            shifts
              .filter(s => s.date === dateStr)
              .forEach(shift => {
                // Only keep one shift per user per day
                if (!dailyShiftsMap.has(shift.userId)) {
                  dailyShiftsMap.set(shift.userId, shift);
                } else {
                  console.warn(`Duplicate shift detected for user ${shift.userId} on ${dateStr}`);
                }
              });

            const totalHours = Array.from(dailyShiftsMap.values()).reduce((acc, shift) => {
              return acc + calculateHours(shift.startTime, shift.endTime);
            }, 0);

            return (
              <div
                key={`footer-${index}`}
                className={styles.footerCell}
              >
                {totalHours > 0 ? `${totalHours.toFixed(1)}` : '-'}
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
              <div>
                <h3>
                  {selectedCell && shifts.some(s => s.userId === selectedCell.userId && s.date === formatDateLocal(selectedCell.date))
                    ? 'Editar Turno'
                    : 'Asignar Turno'}
                </h3>
                {selectedCell && (
                  <p>
                    Usuario: {users.find(u => u.id === selectedCell.userId)?.firstName} {users.find(u => u.id === selectedCell.userId)?.lastName}
                    <br />
                    Fecha: {selectedCell.date.toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className={styles.modalHeaderActions}>
                {selectedCell && (() => {
                  const allUserShifts = shifts.filter(s =>
                    s.userId === selectedCell.userId &&
                    s.date === formatDateLocal(selectedCell.date)
                  );
                  const hasMultiple = allUserShifts.length > 1;
                  const shift = allUserShifts[0];

                  return (
                    <div>
                      {hasMultiple && (
                        <div style={{ color: 'orange', fontSize: '0.9em', marginBottom: '10px' }}>
                          ⚠️ Se detectaron múltiples turnos para esta fecha. Se mostrará/operará con el primero.
                        </div>
                      )}
                      {shift && shift.positionId !== 1 && (
                        <button className={styles.modalDeleteButton} onClick={() => handleDeleteShift()} title="Borrar">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })()}
                <button className={styles.modalCloseButton} onClick={handleModalClose} title="Cerrar">
                  ×
                </button>
              </div>
            </div>

            <div className={styles.modalBody}>
              {showDeleteConfirmation ? (
                <div className={styles.deleteConfirmation}>
                  <div className={styles.deleteIconContainer}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                  </div>
                  <h4>¿Eliminar turno publicado?</h4>
                  <p>Este turno ya fue publicado. Si continúas, puedes optar por enviarle una notificación a la persona.</p>

                  <div className={styles.notificationOption}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={notifyUserOnDelete}
                        onChange={(e) => setNotifyUserOnDelete(e.target.checked)}
                      />
                      <span className={styles.customCheckbox}></span>
                      Notificar al usuario
                    </label>
                  </div>

                  <div className={styles.deleteConfirmationButtons}>
                    <button
                      className={styles.cancelDeleteBtn}
                      onClick={() => setShowDeleteConfirmation(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      className={styles.confirmDeleteBtn}
                      onClick={() => handleDeleteShift(true)}
                    >
                      Eliminar Turno
                    </button>
                  </div>
                </div>
              ) : modalLoading ? (
                <div className={styles.modalLoading}>Cargando posiciones...</div>
              ) : positions.length > 0 ? (
                <div>
                  {selectedCell && (() => {
                    const shift = shifts.find(s => s.userId === selectedCell.userId && s.date === formatDateLocal(selectedCell.date));
                    if (!shift) return null;
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: 'var(--text-primary)' }}>
                            Hora de inicio
                          </label>
                          <input
                            type="time"
                            value={selectedStartTime}
                            onChange={(e) => setSelectedStartTime(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                              backgroundColor: 'var(--background)',
                              color: 'var(--text-primary)'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: 'var(--text-primary)' }}>
                            Hora de fin
                          </label>
                          <input
                            type="time"
                            value={selectedEndTime}
                            onChange={(e) => setSelectedEndTime(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                              backgroundColor: 'var(--background)',
                              color: 'var(--text-primary)'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                  <div className={styles.positionsGrid}>
                    {positions.map((position) => (
                      <div
                        key={position.id}
                        className={`${styles.positionCard} ${selectedPositionId === position.id ? styles.selected : ''}`}
                        onClick={() => handlePositionSelect(position.id)}
                        style={{
                          backgroundColor: position.color ? `${position.color}20` : '#f5f5f5',
                          borderLeftColor: position.color || '#ccc'
                        }}
                      >
                        <div className={styles.positionInfo}>
                          {position.starttime && position.endtime && (
                            <div className={styles.shiftTime} style={{ fontWeight: 'normal', marginBottom: '4px' }}>
                              {formatShiftTime(position.starttime, position.endtime)}
                            </div>
                          )}
                          <div className={styles.shiftPosition}>
                            {position.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.modalError}>No hay posiciones disponibles</div>
              )}
            </div>
            {selectedCell && shifts.some(s => s.userId === selectedCell.userId && s.date === formatDateLocal(selectedCell.date)) && (
              <div className={styles.modalFooter}>
                <button
                  className={styles.modalCancelButton}
                  onClick={handleModalClose}
                >
                  Cancelar
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={handleSaveAssignment}
                  disabled={selectedPositionId === null || modalLoading}
                >
                  Guardar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {warningMessage && (
        <div className={styles.modalOverlay} onClick={() => setWarningMessage(null)} style={{ zIndex: 1100 }}>
          <div className={styles.modalContent} style={{ maxWidth: '400px', padding: '0', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.deleteConfirmation}>
              <div className={styles.warningIconContainer}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h4>Atención</h4>
              <p>{warningMessage}</p>
              <div style={{ padding: '0 20px 20px' }}>
                <button
                  className={styles.primaryBtn}
                  onClick={() => setWarningMessage(null)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy Confirmation Modal */}
      {showCopyConfirmation && (
        <div className={styles.modalOverlay} onClick={() => setShowCopyConfirmation(false)} style={{ zIndex: 1100 }}>
          <div className={styles.modalContent} style={{ maxWidth: '400px', padding: '0', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.deleteConfirmation}>
              <div className={styles.warningIconContainer}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h4>¿Sobrescribir semana actual?</h4>
              <p style={{ textAlign: 'center', marginBottom: '8px' }}>
                Hay turnos asignados en la semana actual.
              </p>
              <p style={{ textAlign: 'center', fontWeight: 'bold' }}>
                Al copiar, se borrarán TODOS los turnos de esta semana y se reemplazarán con los de la semana anterior.
              </p>

              <div className={styles.deleteConfirmationButtons}>
                <button
                  className={styles.cancelDeleteBtn}
                  onClick={() => setShowCopyConfirmation(false)}
                  disabled={copyLoading}
                >
                  Cancelar
                </button>
                <button
                  className={styles.confirmDeleteBtn}
                  onClick={confirmCopyWeek}
                  disabled={copyLoading}
                >
                  {copyLoading ? 'Copiando...' : 'Confirmar Copia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Week Confirmation Modal */}
      {showDeleteWeekConfirmation && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteWeekConfirmation(false)} style={{ zIndex: 1100 }}>
          <div className={styles.modalContent} style={{ maxWidth: '400px', padding: '0', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.deleteConfirmation}>
              <div className={deleteWeekWarningType === 'published' ? styles.warningIconContainer : styles.deleteIconContainer}>
                {deleteWeekWarningType === 'published' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                )}
              </div>
              <h4>
                {deleteWeekWarningType === 'published' ? '¿Eliminar semana PUBLICADA?' : '¿Eliminar semana completa?'}
              </h4>
              <p style={{ textAlign: 'center', marginBottom: '8px' }}>
                {deleteWeekWarningType === 'published'
                  ? 'Hay turnos PUBLICADOS en esta semana.'
                  : 'Estás a punto de eliminar todos los turnos de la semana.'}
              </p>
              <p style={{ textAlign: 'center', fontWeight: 'bold', color: deleteWeekWarningType === 'published' ? '#d32f2f' : 'inherit' }}>
                Esta acción no se puede deshacer. Se eliminarán TODOS los turnos{deleteWeekWarningType === 'published' ? ' (incluyendo los publicados)' : ''}.
              </p>

              <div className={styles.deleteConfirmationButtons}>
                <button
                  className={styles.cancelDeleteBtn}
                  onClick={() => setShowDeleteWeekConfirmation(false)}
                  disabled={deleteWeekLoading}
                >
                  Cancelar
                </button>
                <button
                  className={styles.confirmDeleteBtn}
                  onClick={confirmDeleteWeek}
                  disabled={deleteWeekLoading}
                >
                  {deleteWeekLoading ? 'Eliminando...' : 'Eliminar Todo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarComponent;