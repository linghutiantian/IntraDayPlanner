import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Palette } from 'lucide-react';

const IntraDayPlanner = () => {
  const timeSlots = Array.from({ length: 21 }, (_, i) => {
    const totalMinutes = (i * 30) + (8 * 60);
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

  const initialEvents = { planned: [], reality: [] };

  // State management
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('dayPlanner');
    return saved ? JSON.parse(saved) : initialEvents;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [currentColumn, setCurrentColumn] = useState(null);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [resizing, setResizing] = useState(null);
  const [tempEvent, setTempEvent] = useState(null);
  const [movingEvent, setMovingEvent] = useState(null);
  const timeGridRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('dayPlanner', JSON.stringify(events));
  }, [events]);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
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
    const startMinutes = 8 * 60;
    const endMinutes = 18 * 60;
    const position = Math.floor(((totalMinutes - startMinutes) / (endMinutes - startMinutes)) * 630);
    return Math.min(Math.max(0, position), 630);
  };

  const handleMouseDown = (e, timeSlot, column) => {
    if (e.target.classList.contains('resize-handle') || e.target.classList.contains('event-content')) return;
    
    const gridRect = timeGridRef.current.getBoundingClientRect();
    const relativeY = e.clientY - gridRect.top;
    const slotIndex = Math.floor(relativeY / 30);
    
    if (slotIndex >= 0 && slotIndex < timeSlots.length) {
      setIsDragging(true);
      setDragStart(timeSlots[slotIndex]);
      setCurrentColumn(column);
      
      setTempEvent({
        start: timeSlots[slotIndex],
        end: timeSlots[slotIndex],
        column
      });
    }
  };

  const startEventMove = (e, event, columnType) => {
    e.stopPropagation();
    if (e.target.classList.contains('resize-handle')) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    setMovingEvent({
      event,
      columnType,
      offsetY
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging && !resizing && !movingEvent) return;

    const gridRect = timeGridRef.current.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(e.clientY - gridRect.top, gridRect.height - 30));
    const currentSlotIndex = Math.floor(relativeY / 30);

    if (currentSlotIndex >= 0 && currentSlotIndex < timeSlots.length) {
      if (isDragging && tempEvent) {
        setTempEvent(prev => ({
          ...prev,
          end: timeSlots[currentSlotIndex]
        }));
      } else if (resizing) {
        const { event, edge, columnType } = resizing;
        const newStart = edge === 'top' ? timeSlots[currentSlotIndex] : event.start;
        const newEnd = edge === 'bottom' ? timeSlots[currentSlotIndex] : event.end;

        if (timeSlots.indexOf(newStart) <= timeSlots.indexOf(newEnd)) {
          const hasOverlap = events[columnType].some(otherEvent => {
            if (otherEvent.id === event.id) return false;
            return (timeSlots.indexOf(newStart) <= timeSlots.indexOf(otherEvent.end) && 
                    timeSlots.indexOf(newEnd) >= timeSlots.indexOf(otherEvent.start));
          });

          if (!hasOverlap) {
            setEvents(prev => ({
              ...prev,
              [columnType]: prev[columnType].map(evt => 
                evt.id === event.id ? { ...evt, start: newStart, end: newEnd } : evt
              )
            }));
          }
        }
      } else if (movingEvent) {
        const { event, offsetY } = movingEvent;
        const eventDuration = timeSlots.indexOf(event.end) - timeSlots.indexOf(event.start);
        const newStartIndex = Math.max(0, Math.min(currentSlotIndex - Math.floor(offsetY / 30), timeSlots.length - eventDuration - 1));
        const newEndIndex = newStartIndex + eventDuration;

        const hasOverlap = events[movingEvent.columnType].some(otherEvent => {
          if (otherEvent.id === event.id) return false;
          const otherStart = timeSlots.indexOf(otherEvent.start);
          const otherEnd = timeSlots.indexOf(otherEvent.end);
          return (newStartIndex <= otherEnd && newEndIndex >= otherStart);
        });

        if (!hasOverlap) {
          setEvents(prev => ({
            ...prev,
            [movingEvent.columnType]: prev[movingEvent.columnType].map(evt => 
              evt.id === event.id ? {
                ...evt,
                start: timeSlots[newStartIndex],
                end: timeSlots[newEndIndex]
              } : evt
            )
          }));
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging && tempEvent) {
      const startIndex = timeSlots.indexOf(tempEvent.start);
      const endIndex = timeSlots.indexOf(tempEvent.end);
      
      if (startIndex !== endIndex) {
        const hasOverlap = events[tempEvent.column].some(event => {
          const eventStart = timeSlots.indexOf(event.start);
          const eventEnd = timeSlots.indexOf(event.end);
          return (startIndex <= eventEnd && endIndex >= eventStart);
        });

        if (!hasOverlap) {
          const newEvent = {
            id: Date.now(),
            start: tempEvent.start,
            end: tempEvent.end,
            content: '',
            colorIndex: 0
          };

          setEvents(prev => ({
            ...prev,
            [tempEvent.column]: [...prev[tempEvent.column], newEvent]
          }));
        }
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setCurrentColumn(null);
    setTempEvent(null);
    setResizing(null);
    setMovingEvent(null);
  };

  const handleResizeStart = (e, event, edge, columnType) => {
    e.stopPropagation();
    setResizing({ event, edge, columnType });
  };

  // Utility functions remain the same
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
        className={`absolute left-2 right-2 ${colorOptions[event.colorIndex || 0]} border rounded cursor-move`}
        style={{ top, height }}
        onMouseDown={(e) => startEventMove(e, event, columnType)}
      >
        <div 
          className="absolute top-0 left-0 right-0 h-2 cursor-n-resize resize-handle hover:bg-gray-400/20"
          onMouseDown={(e) => handleResizeStart(e, event, 'top', columnType)}
        />
        <div className="p-2 event-content">
          <textarea
            className="w-full bg-transparent resize-none event-content"
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
        <div 
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize resize-handle hover:bg-gray-400/20"
          onMouseDown={(e) => handleResizeStart(e, event, 'bottom', columnType)}
        />
      </div>
    );
  };

  const renderTimeColumn = () => (
    <div className="absolute -left-16 top-0 h-full">
      {timeSlots.map((time, index) => (
        <div key={time} className="h-[30px] flex items-center">
          <span className="text-sm text-gray-500 select-none">{time}</span>
        </div>
      ))}
    </div>
  );

  const renderColumn = (columnType) => (
    <div className="border rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4 text-center">{columnType === 'planned' ? 'Planned' : 'Reality'}</h2>
      <div className="relative h-[630px]" ref={timeGridRef}>
        {renderTimeColumn()}
        <div className="ml-2">
          {timeSlots.map((time) => (
            <div
              key={time}
              className="h-[30px] border-b border-gray-200"
              onMouseDown={(e) => handleMouseDown(e, time, columnType)}
            />
          ))}
        </div>

        {events[columnType].map(event => renderEvent(event, columnType))}

        {tempEvent && tempEvent.column === columnType && (
          <div
            className="absolute left-2 right-2 bg-blue-100 border border-blue-300 rounded opacity-50"
            style={{
              top: `${timeSlots.indexOf(tempEvent.start) * 30}px`,
              height: `${(timeSlots.indexOf(tempEvent.end) - timeSlots.indexOf(tempEvent.start) + 1) * 30}px`
            }}
          />
        )}

        <div 
          className="absolute left-0 right-0 flex items-center pointer-events-none"
          style={{ top: `${getCurrentTimePosition()}px` }}
        >
          <div className="border-t-2 border-red-500 w-full" />
          {columnType === 'reality' && (
            <div className="bg-red-500 text-white text-sm px-2 py-1 rounded">
              {formatTimeForDisplay(currentTime)}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className="max-w-6xl mx-auto p-4 bg-white shadow-lg rounded-lg"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
        {renderColumn('planned')}
        {renderColumn('reality')}
      </div>
    </div>
  );
};

export default IntraDayPlanner;