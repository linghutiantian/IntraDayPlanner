import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Palette, CheckSquare, Type, Undo2 } from 'lucide-react';

const IntraDayPlanner = () => {
  const timeSlots = Array.from({ length: 20 }, (_, i) => {
    const totalMinutes = i * 30 + (8 * 60); // Start from 8:00 AM
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours === 12 ? 12 : hours % 12}:${minutes.toString().padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
  });

  const colorOptions = [
    {
      class: 'bg-blue-100 border-blue-300',
      hoverClass: 'hover:bg-blue-200',
      label: 'Blue'
    },
    {
      class: 'bg-green-100 border-green-300',
      hoverClass: 'hover:bg-green-200',
      label: 'Green'
    },
    {
      class: 'bg-yellow-100 border-yellow-300',
      hoverClass: 'hover:bg-yellow-200',
      label: 'Yellow'
    },
    {
      class: 'bg-purple-100 border-purple-300',
      hoverClass: 'hover:bg-purple-200',
      label: 'Purple'
    },
    {
      class: 'bg-pink-100 border-pink-300',
      hoverClass: 'hover:bg-pink-200',
      label: 'Pink'
    }
  ];

  const [lastColorIndex, setLastColorIndex] = useState(0); // Default to blue (index 0)

  const initialEvents = { planned: [], reality: [] };

  // State management
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('dayPlanner');
    return saved ? JSON.parse(saved) : initialEvents;
  });

  // History stack for undo functionality
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [currentColumn, setCurrentColumn] = useState(null);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [resizing, setResizing] = useState(null);
  const [tempEvent, setTempEvent] = useState(null);
  const [movingEvent, setMovingEvent] = useState(null);
  const [openColorPicker, setOpenColorPicker] = useState(null);
  const timeGridRef = useRef(null);

  const updateEventsWithHistory = (newEventsOrUpdater) => {
    // Calculate new events state
    const newEvents = typeof newEventsOrUpdater === 'function' 
      ? newEventsOrUpdater(events)
      : newEventsOrUpdater;

    // If we're not at the end of the history, remove all future states
    const newHistory = history.slice(0, currentIndex + 1);
    
    // Add the new state to history
    newHistory.push(JSON.stringify(newEvents));

    // Update history and current index
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);

    // Update events
    setEvents(newEvents);
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      const previousState = JSON.parse(history[currentIndex - 1]);
      setCurrentIndex(currentIndex - 1);
      setEvents(previousState);
    }
  };

  useEffect(() => {
    localStorage.setItem('dayPlanner', JSON.stringify(events));
  }, [events]);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openColorPicker && !event.target.closest('.color-picker')) {
        setOpenColorPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openColorPicker]);

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
    const startMinutes = 8 * 60; // 8 AM
    const endMinutes = 18 * 60 - 30; // 5:30 PM
    // 2% is 8:00, 86% is 17:30
    const percentage = ((totalMinutes - startMinutes) / (endMinutes - startMinutes)) * 84 + 2;
    return Math.min(Math.max(2, percentage), 86);
  };

  const handleMouseDown = (e, timeSlot, column) => {
    if (e.target.classList.contains('resize-handle') || e.target.classList.contains('event-content')) return;

    const gridRect = timeGridRef.current.getBoundingClientRect();
    const relativeY = e.clientY - gridRect.top;
    const slotIndex = Math.floor(relativeY / 30);

    if (slotIndex > 0 && slotIndex < timeSlots.length) {
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

      // Allow creation of 30-minute events (when start equals end)
      const hasOverlap = events[tempEvent.column].some(event => {
        const eventStart = timeSlots.indexOf(event.start);
        const eventEnd = timeSlots.indexOf(event.end);
        return (startIndex <= eventEnd && endIndex >= eventStart);
      });

      if (!hasOverlap) {
        const newEventId = Date.now();
        const newEvent = {
          id: newEventId,
          start: tempEvent.start,
          end: tempEvent.end,
          content: '',
          colorIndex: lastColorIndex // Use the last selected color
        };

        updateEventsWithHistory(prev => ({
          ...prev,
          [tempEvent.column]: [...prev[tempEvent.column], newEvent]
        }));

        // Set a timeout to allow the DOM to update before focusing
        setTimeout(() => {
          const eventElement = document.querySelector(`[data-event-id="${newEventId}"]`);
          if (eventElement) {
            const textarea = eventElement.querySelector('textarea');
            if (textarea) {
              textarea.focus();
            }
          }
        }, 0);
      }
    } else if (resizing || movingEvent) {
      // Record the final state in history only when the drag operation ends
      updateEventsWithHistory(events);
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

  const updateEventContent = (columnType, eventId, newContent) => {
    updateEventsWithHistory(prev => ({
      ...prev,
      [columnType]: prev[columnType].map(event =>
        event.id === eventId ? { ...event, content: newContent } : event
      )
    }));
  };

  const toggleEventMode = (columnType, eventId) => {
    updateEventsWithHistory(prev => ({
      ...prev,
      [columnType]: prev[columnType].map(event =>
        event.id === eventId ? {
          ...event,
          isCheckboxMode: !event.isCheckboxMode
        } : event
      )
    }));
  };

  const deleteEvent = (columnType, eventId) => {
    updateEventsWithHistory(prev => ({
      ...prev,
      [columnType]: prev[columnType].filter(event => event.id !== eventId)
    }));
  };

  const updateEventColor = (columnType, eventId, colorIndex) => {
    setLastColorIndex(colorIndex); // Store the last used color index
    updateEventsWithHistory(prev => ({
      ...prev,
      [columnType]: prev[columnType].map(event =>
        event.id === eventId ? {
          ...event,
          colorIndex
        } : event
      )
    }));
    setOpenColorPicker(null);
  };

  const resetPlanner = () => {
    updateEventsWithHistory(initialEvents);
  };

  const renderEventContent = (event, columnType) => {
    if (event.isCheckboxMode) {
      const tasks = event.content.split('\n').filter(task => task.trim());
      return (
        <div className="w-full h-full p-1 overflow-y-auto">
          {tasks.map((task, index) => (
            <div key={index} className="flex items-start gap-2 mb-0.5 leading-tight">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={task.startsWith('[x]')}
                onChange={() => {
                  const newTasks = [...tasks];
                  newTasks[index] = task.startsWith('[x]') ?
                    task.replace('[x]', '[ ]') :
                    task.startsWith('[ ]') ?
                      task.replace('[ ]', '[x]') :
                      `[x]${task}`;
                  updateEventContent(columnType, event.id, newTasks.join('\n'));
                }}
                onClick={e => e.stopPropagation()}
              />
              <span className={`${task.startsWith('[x]') ? 'line-through' : ''} leading-tight`}>
                {task.replace(/^\[[\sx]\]/, '').trim()}
              </span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <textarea
        className="w-full h-full bg-transparent resize-none event-content pr-12 px-1 leading-tight"
        value={event.content}
        onChange={(e) => updateEventContent(columnType, event.id, e.target.value)}
        placeholder="Enter event details..."
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const renderEvent = (event, columnType) => {
    const startIndex = timeSlots.indexOf(event.start);
    const endIndex = timeSlots.indexOf(event.end);
    const height = `${(endIndex - startIndex + 1) * 30}px`;
    const top = `${startIndex * 30}px`;

    return (
      <div
        key={event.id}
        data-event-id={event.id}
        className={`absolute left-12 right-2 ${colorOptions[event.colorIndex || 0].class} border rounded cursor-move`}
        style={{ top, height }}
        onMouseDown={(e) => startEventMove(e, event, columnType)}
      >
        <div
          className="absolute top-0 left-0 right-0 h-2 cursor-n-resize resize-handle hover:bg-gray-400/20 z-10"
          onMouseDown={(e) => handleResizeStart(e, event, 'top', columnType)}
        />
        <div className="absolute inset-0 pt-0 pb-0 px-2 event-content">
          <div className="relative h-full">
            {renderEventContent(event, columnType)}
            <div className="absolute top-0 right-0 flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleEventMode(columnType, event.id);
                }}
                className="text-gray-500 hover:text-gray-700"
                title={event.isCheckboxMode ? "Switch to Text Mode" : "Switch to Checkbox Mode"}
              >
                {event.isCheckboxMode ? <Type size={16} /> : <CheckSquare size={16} />}
              </button>
              <div className="relative color-picker">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenColorPicker(openColorPicker === event.id ? null : event.id);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <Palette size={16} />
                </button>
                {openColorPicker === event.id && (
                  <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 w-32">
                    {colorOptions.map((color, index) => (
                      <button
                        key={index}
                        className={`w-full p-2 text-left ${color.class} ${color.hoverClass}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateEventColor(columnType, event.id, index);
                        }}
                      >
                        {color.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize resize-handle hover:bg-gray-400/20 z-10"
          onMouseDown={(e) => handleResizeStart(e, event, 'bottom', columnType)}
        />
      </div>
    );
  };

  const renderColumn = (columnType) => (
    <div className="border rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4 text-center">{columnType === 'planned' ? 'Planned' : 'Reality'}</h2>
      <div className="relative h-[600px]" ref={timeGridRef}>
        {/* Time labels */}
        <div className="absolute -left-4 top-3 h-full">
          {timeSlots.map((time) => (
            <div key={time} className="h-[30px] flex items-center">
              <span className="text-sm text-gray-500 select-none">{time}</span>
            </div>
          ))}
        </div>

        {/* Grid lines */}
        <div className="ml-2">
          {timeSlots.map((time) => (
            <div
              key={time}
              className="h-[30px] border-b border-gray-200"
              onMouseDown={(e) => handleMouseDown(e, time, columnType)}
            />
          ))}
        </div>

        {/* Events */}
        {events[columnType].map(event => renderEvent(event, columnType))}

        {/* Temporary event while dragging */}
        {tempEvent && tempEvent.column === columnType && (
          <div
            className={`absolute left-12 right-2 ${colorOptions[lastColorIndex].class} border rounded opacity-50`}
            style={{
              top: `${timeSlots.indexOf(tempEvent.start) * 30}px`,
              height: `${(timeSlots.indexOf(tempEvent.end) - timeSlots.indexOf(tempEvent.start) + 1) * 30}px`
            }}
          />
        )}
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
        <div className="flex gap-2">
          <button
            onClick={handleUndo}
            disabled={currentIndex <= 0}
            className={`px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-2 ${
              currentIndex <= 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            <Undo2 size={16} />
            Undo
          </button>
          <button
            onClick={resetPlanner}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Reset Planner
          </button>
        </div>
      </div>

      <div className="relative">
        {/* Current time indicator */}
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{
            top: `calc(${getCurrentTimePosition()}% - 1px)`,
            transform: 'translateY(64px)'
          }}
        >
          <div className="flex items-center w-full px-4">
            <div className="flex-1">
              <div className="border-t-2 border-red-500 w-full" />
            </div>
            <div className="w-4" />
            <div className="flex-1 flex items-center">
              <div className="border-t-2 border-red-500 flex-grow" />
              <div className="bg-red-500 text-white text-sm px-2 py-1 rounded ml-2">
                {formatTimeForDisplay(currentTime)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {renderColumn('planned')}
          {renderColumn('reality')}
        </div>
      </div>
    </div>
  );
};

export default IntraDayPlanner;