"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface CalendarContextType {
    // Selected site
    selectedSiteId: number | null;
    setSelectedSiteId: (id: number | null) => void;

    // Current date
    currentDate: Date;
    setCurrentDate: (date: Date) => void;

    // View type
    view: 'week' | 'day' | 'twoWeeks';
    setView: (view: 'week' | 'day' | 'twoWeeks') => void;

    // Enabled position filters
    enabledPositions: Set<number>;
    setEnabledPositions: React.Dispatch<React.SetStateAction<Set<number>>>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
    const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'week' | 'day' | 'twoWeeks'>('week');
    const [enabledPositions, setEnabledPositions] = useState<Set<number>>(new Set());

    return (
        <CalendarContext.Provider
            value={{
                selectedSiteId,
                setSelectedSiteId,
                currentDate,
                setCurrentDate,
                view,
                setView,
                enabledPositions,
                setEnabledPositions,
            }}
        >
            {children}
        </CalendarContext.Provider>
    );
}

export function useCalendar() {
    const context = useContext(CalendarContext);
    if (!context) {
        throw new Error("useCalendar must be used within a CalendarProvider");
    }
    return context;
}
