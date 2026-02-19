import React, { useState, useEffect, useRef } from 'react';

export const useDraggable = () => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent dragging if clicking on form elements or close buttons
        if ((e.target as HTMLElement).tagName === 'INPUT' ||
            (e.target as HTMLElement).tagName === 'BUTTON' ||
            (e.target as HTMLElement).closest('button')) {
            return;
        }

        isDragging.current = true;
        dragStartRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };

        // Disable text selection while dragging
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;

            setPosition({
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y
            });
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // Function to reset position (useful when closing/reopening modal)
    const resetPosition = () => setPosition({ x: 0, y: 0 });

    return { position, handleMouseDown, resetPosition };
};
