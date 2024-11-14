import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Palette } from 'lucide-react';

const IntraDayPlanner = () => {
  // Generate time slots from 8 AM to 6 PM with 30-minute intervals
  const timeSlots = Array.from({ length: 21 }, (_, i) => {
    const totalMinutes = (i * 30) + (8 * 60); // Start from 8 AM
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours === 12 ? 12 : hours % 12}:${minutes.toString().padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
  });

  const colorOptions = [
    'bg-blue-100 border-blue-300',
    'bg-green-100 border-green-300',
    'bg-yellow-100 border-yellow-300',
    'bg-purple-100 border-purple-300',
    'bg-pink-100 border-pink-300'
  ];

  const initialEvents = {
    planned: [],
    reality: []
  };

  // State for events and UI interactions
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('dayPlanner');
    return saved ? JSON.parse(saved) : initialEvents;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [currentColumn, setCurrentColumn] = useState(null);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const timeGridRef = useRef(null);

  // Save events to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dayPlanner', JSON.stringify(events));
  }, [events]);

  // Get and update current time
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000); // Update every second
    return () => clearInterval(timer);
  }, []);

  const formatTimeForDisplay = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  };

  const getCurrentTimePosition = () => {
    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const startMinutes = 8 * 60; // 8 AM
    const endMinutes = 18 * 60; // 6 PM
    const position = ((totalMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
    return Math.min(Math.max(0, position), 100);
  };

  const handleMouseDown = (timeSlot, column) => {
    setIsDragging(true);
    setDragStart(timeSlot);
    setCurrentColumn(column);
  };

  const handleMouseUp = (timeSlot) => {
    if (isDragging && dragStart !== null && currentColumn) {
      const startIndex = timeSlots.indexOf(dragStart);
      const endIndex = timeSlots.indexOf(timeSlot);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const newEvent = {
          id: Date.now(),
          start: dragStart,
          end: timeSlot,
          content: '',
          colorIndex: 0
        };

        // Check for overlaps
        const hasOverlap = events[currentColumn].some(event => {
          const eventStart = timeSlots.indexOf(event.start);
          const eventEnd = timeSlots.indexOf(event.end);
          return (startIndex <= eventEnd && endIndex >= eventStart);
        });

        if (!hasOverlap) {
          setEvents(prev => ({
            ...prev,
            [currentColumn]: [...prev[currentColumn], newEvent]
          }));
        }
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setCurrentColumn(null);
  };

  const startEventDrag = (e, event, columnType) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    setDraggedEvent({ event, columnType });
    setDragOffset(offsetY);
  };

  const handleEventDrag = (e) => {
    if (draggedEvent && timeGridRef.current) {
      e.preventDefault();
      const gridRect = timeGridRef.current.getBoundingClientRect();
      const relativeY = e.clientY - gridRect.top - dragOffset;
      const timeSlotHeight = 30; // height of each 30-minute slot
      const newPosition = Math.round(relativeY / timeSlotHeight) * timeSlotHeight;
      
      // Calculate new start and end times
      const newStartIndex = Math.floor(newPosition / timeSlotHeight);
      if (newStartIndex >= 0 && newStartIndex < timeSlots.length) {
        const eventDuration = timeSlots.indexOf(draggedEvent.event.end) - 
                            timeSlots.indexOf(draggedEvent.event.start);
        const newEndIndex = Math.min(newStartIndex + eventDuration, timeSlots.length - 1);
        
        // Check for overlaps
        const hasOverlap = events[draggedEvent.columnType].some(event => {
          if (event.id === draggedEvent.event.id) return false;
          const eventStart = timeSlots.indexOf(event.start);
          const eventEnd = timeSlots.indexOf(event.end);
          return (newStartIndex <= eventEnd && newEndIndex >= eventStart);
        });

        if (!hasOverlap) {
          setEvents(prev => ({
            ...prev,
            [draggedEvent.columnType]: prev[draggedEvent.columnType].map(event => {
              if (event.id === draggedEvent.event.id) {
                return {
                  ...event,
                  start: timeSlots[newStartIndex],
                  end: timeSlots[newEndIndex]
                };
              }
              return event;
            })
          }));
        }
      }
    }
  };

  const handleEventDragEnd = () => {
    setDraggedEvent(null);
  };

  const updateEventContent = (columnType, eventId, newContent) => {
    setEvents(prev => ({
      ...prev,
      [columnType]: prev[columnType].map(event => 
        event.id === eventId ? { ...event, content: newContent } : event
      )
    }));
  };

  const updateEventColor = (columnType, eventId) => {
    setEvents(prev => ({
      ...prev,
      [columnType]: prev[columnType].map(event => 
        event.id === eventId ? {
          ...event,
          colorIndex: (event.colorIndex + 1) % colorOptions.length
        } : event
      )
    }));
  };

  const deleteEvent = (columnType, eventId) => {
    setEvents(prev => ({
      ...prev,
      [columnType]: prev[columnType].filter(event => event.id !== eventId)
    }));
  };

  const resetPlanner = () => {
    setEvents(initialEvents);
  };

  const renderEvent = (event, columnType) => {
    const startIndex = timeSlots.indexOf(event.start);
    const endIndex = timeSlots.indexOf(event.end);
    const height = `${(endIndex - startIndex + 1) * 30}px`;
    const top = `${startIndex * 30}px`;

    return (
      <div
        key={event.id}
        className={`absolute left-0 right-0 mx-2 p-2 border rounded ${colorOptions[event.colorIndex || 0]}`}
        style={{ top, height, cursor: 'move' }}
        onMouseDown={(e) => startEventDrag(e, event, columnType)}
      >
        <textarea
          className="w-full h-full bg-transparent resize-none"
          value={event.content}
          onChange={(e) => updateEventContent(columnType, event.id, e.target.value)}
          placeholder="Enter event details..."
          onClick={(e) => e.stopPropagation()}
        />
        <div className="absolute top-1 right-1 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateEventColor(columnType, event.id);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <Palette size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteEvent(columnType, event.id);
            }}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="max-w-6xl mx-auto p-4 bg-white shadow-lg rounded-lg"
      onMouseMove={handleEventDrag}
      onMouseUp={handleEventDragEnd}
    >
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Intra-day Planner</h1>
        <button
          onClick={resetPlanner}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Reset Planner
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Planned Column */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4 text-center">Planned</h2>
          <div className="relative" ref={timeGridRef}>
            {timeSlots.map((time) => (
              <div
                key={time}
                className="h-[30px] border-b relative"
                onMouseDown={() => handleMouseDown(time, 'planned')}
                onMouseUp={() => handleMouseUp(time)}
              >
                <span className="absolute -left-16 top-0 text-sm text-gray-500 select-none">
                  {time}
                </span>
              </div>
            ))}
            {events.planned.map(event => renderEvent(event, 'planned'))}
          </div>
        </div>

        {/* Reality Column */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4 text-center">Reality</h2>
          <div className="relative">
            {timeSlots.map((time) => (
              <div
                key={time}
                className="h-[30px] border-b relative"
                onMouseDown={() => handleMouseDown(time, 'reality')}
                onMouseUp={() => handleMouseUp(time)}
              >
                <span className="absolute -left-16 top-0 text-sm text-gray-500 select-none">
                  {time}
                </span>
              </div>
            ))}
            {events.reality.map(event => renderEvent(event, 'reality'))}
          </div>
        </div>
      </div>

      {/* Current time indicator with time display */}
      <div 
        className="absolute left-0 right-0 flex items-center"
        style={{ top: `${getCurrentTimePosition()}%` }}
      >
        <div className="border-t-2 border-red-500 flex-grow z-10" />
        <div className="bg-red-500 text-white text-sm px-2 py-1 rounded ml-2 z-10">
          {formatTimeForDisplay(currentTime)}
        </div>
      </div>
    </div>
  );
};

export default IntraDayPlanner;