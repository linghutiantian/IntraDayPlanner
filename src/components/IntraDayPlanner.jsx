import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trash2, Palette, CheckSquare, Type, Undo2, Copy, Sun, Moon, Plus, ArrowUp, ArrowDown, Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const IntraDayPlanner = ({ isDark, setIsDark }) => {
  const [startHour, setStartHour] = useState(() => {
    const saved = localStorage.getItem('dayPlannerStartHour');
    return saved ? parseInt(saved) : 8;
  });

  const [endHour, setEndHour] = useState(() => {
    const saved = localStorage.getItem('dayPlannerEndHour');
    return saved ? parseInt(saved) : 18;
  });

  const [density, setDensity] = useState(() => {
    const saved = localStorage.getItem('dayPlannerDensity');
    return saved || 'compact'; // 'compact', 'comfortable', 'spacious'
  });

  useEffect(() => {
    localStorage.setItem('dayPlannerStartHour', startHour.toString());
    localStorage.setItem('dayPlannerEndHour', endHour.toString());
    localStorage.setItem('dayPlannerDensity', density);
  }, [startHour, endHour, density]);

  // Save dark mode preference whenever it changes
  useEffect(() => {
    localStorage.setItem('dayPlannerDarkMode', isDark);
  }, [isDark]);

  const timeSlots = useMemo(() => {
    const slots = [];
    const totalSlots = ((endHour - startHour) * 2) + 1; // 30-minute intervals

    for (let i = 0; i < totalSlots; i++) {
      const totalMinutes = i * 30 + (startHour * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      slots.push(`${hours === 0 || hours === 24 ? 12 : hours === 12 ? 12 : hours % 12}:${minutes.toString().padStart(2, '0')} ${hours < 12 || hours === 24 ? 'AM' : 'PM'}`);
    }

    return slots;
  }, [startHour, endHour]);

  const densityConfig = {
    compact: 30,      // Dense view - 30px per slot
    comfortable: 45,  // Moderate view - 45px per slot
    spacious: 60     // Spacious view - 60px per slot
  };

  const colorOptions = [
    {
      class: isDark ? 'bg-blue-900 border-blue-700' : 'bg-blue-100 border-blue-300',
      hoverClass: isDark ? 'hover:bg-blue-800' : 'hover:bg-blue-200',
      label: 'Blue'
    },
    {
      class: isDark ? 'bg-green-900 border-green-700' : 'bg-green-100 border-green-300',
      hoverClass: isDark ? 'hover:bg-green-800' : 'hover:bg-green-200',
      label: 'Green'
    },
    {
      class: isDark ? 'bg-yellow-900 border-yellow-700' : 'bg-yellow-100 border-yellow-300',
      hoverClass: isDark ? 'hover:bg-yellow-800' : 'hover:bg-yellow-200',
      label: 'Yellow'
    },
    {
      class: isDark ? 'bg-purple-900 border-purple-700' : 'bg-purple-100 border-purple-300',
      hoverClass: isDark ? 'hover:bg-purple-800' : 'hover:bg-purple-200',
      label: 'Purple'
    },
    {
      class: isDark ? 'bg-pink-900 border-pink-700' : 'bg-pink-100 border-pink-300',
      hoverClass: isDark ? 'hover:bg-pink-800' : 'hover:bg-pink-200',
      label: 'Pink'
    }
  ];

  const [lastColorIndex, setLastColorIndex] = useState(0); // Default to blue (index 0)

  const initialEvents = { planned: [], reality: [], standby: [] };

  // State management
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('dayPlanner');
    if (saved) {
      const parsedEvents = JSON.parse(saved);
      // Ensure standby array exists in saved data
      return {
        ...initialEvents,
        ...parsedEvents,
        standby: parsedEvents.standby || []
      };
    }
    return initialEvents;
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Handle Undo shortcut
      if (!e.target.tagName.match(/^(INPUT|TEXTAREA)$/) && (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Handle ESC to exit text editing
      if (e.key === 'Escape' && e.target.tagName.match(/^(INPUT|TEXTAREA)$/)) {
        e.preventDefault();
        e.target.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

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
    const top_pixel = 75;
    const end_pixel = top_pixel + ((timeSlots.length - 1) * densityConfig[density]);
    // Calculate start and end minutes of the day planner
    const startMinutes = startHour * 60;
    const endMinutes = endHour * 60;

    // If time is before start or after end, clamp to limits
    if (totalMinutes <= startMinutes) return top_pixel;
    if (totalMinutes >= endMinutes) return end_pixel;

    // Calculate position proportionally between top_pixel and end_pixel
    return top_pixel + ((totalMinutes - startMinutes) / (endMinutes - startMinutes)) * (end_pixel - top_pixel);
  };

  const updateTimeSettings = (newStart, newEnd) => {
    if (newStart >= newEnd) {
      alert('Start time must be before end time');
      return;
    }

    setStartHour(newStart);
    setEndHour(newEnd);
  };

  // Track touch events
  const [touchStartY, setTouchStartY] = useState(null);
  const [isTouching, setIsTouching] = useState(false);

  // Handle touch events for mobile
  const handleTouchStart = (e, timeSlot, column) => {
    e.preventDefault(); // Prevent default touch behavior
    setTouchStartY(e.touches[0].clientY);
    setIsTouching(true);
    handleMouseDown(e.touches[0], timeSlot, column);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!isTouching || !touchStartY) return;

    const touchDelta = Math.abs(touch.clientY - touchStartY);
    if (touchDelta > 5) {
      handleMouseMove({
        clientY: touch.clientY,
        clientX: touch.clientX
      });
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    setIsTouching(false);
    setTouchStartY(null);
    handleMouseUp();
  };
  const handleMouseDown = (e, timeSlot, column) => {
    if (e.target.classList.contains('resize-handle') || e.target.classList.contains('event-content')) return;

    const gridRect = timeGridRef.current.getBoundingClientRect();
    const relativeY = e.clientY - gridRect.top;
    const slotIndex = Math.floor(relativeY / densityConfig[density]);

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
    const relativeY = Math.max(0, Math.min(e.clientY - gridRect.top, gridRect.height - densityConfig[density]));
    const currentSlotIndex = Math.floor(relativeY / densityConfig[density]);

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
    updateEventsWithHistory(prev => ({
      ...prev,
      planned: [],
      reality: []
    }));
  };

  const clearStandby = () => {
    updateEventsWithHistory(prev => ({
      ...prev,
      standby: []
    }));
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
              <span className={`${task.startsWith('[x]') ? 'line-through' : ''} leading-tight ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {task.replace(/^\[[\sx]\]/, '').trim()}
              </span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <textarea
        className={`w-full h-full resize-none event-content pr-12 px-1 leading-tight ${isDark ? 'bg-transparent text-gray-300 placeholder-gray-500' : 'bg-transparent text-gray-700 placeholder-gray-400'
          }`}
        value={event.content}
        onChange={(e) => updateEventContent(columnType, event.id, e.target.value)}
        placeholder="Enter event details..."
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const duplicateToReality = (event) => {
    // Find a non-overlapping position for the duplicated event
    const eventDuration = timeSlots.indexOf(event.end) - timeSlots.indexOf(event.start);
    let newStartIndex = timeSlots.indexOf(event.start);
    let found = false;

    // Try to find a non-overlapping slot
    while (!found && newStartIndex < timeSlots.length - eventDuration) {
      const newEndIndex = newStartIndex + eventDuration;
      const hasOverlap = events.reality.some(existingEvent => {
        const existingStart = timeSlots.indexOf(existingEvent.start);
        const existingEnd = timeSlots.indexOf(existingEvent.end);
        return (newStartIndex <= existingEnd && newEndIndex >= existingStart);
      });

      if (!hasOverlap) {
        found = true;
      } else {
        newStartIndex++;
      }
    }

    if (found) {
      const newEvent = {
        ...event,
        id: Date.now(), // New unique ID
        sourceId: event.id,  // Track which planned event this was copied from
        start: timeSlots[newStartIndex],
        end: timeSlots[newStartIndex + eventDuration],
      };

      updateEventsWithHistory(prev => ({
        ...prev,
        reality: [...prev.reality, newEvent]
      }));
    }
  };

  // Add helper function to calculate connection points
  const calculateConnectionPoints = (plannedEvent, realityEvent) => {
    const plannedEl = document.querySelector(`[data-event-id="${plannedEvent.id}"]`);
    const realityEl = document.querySelector(`[data-event-id="${realityEvent.id}"]`);

    if (!plannedEl || !realityEl) return null;

    const plannedRect = plannedEl.getBoundingClientRect();
    const realityRect = realityEl.getBoundingClientRect();
    const gridRect = timeGridRef.current.getBoundingClientRect();
    const colWidth = gridRect.width; // Width of each column


    // Calculate relative positions, accounting for the two-column layout
    return {
      x1: colWidth + 8,
      y1: (plannedRect.top - gridRect.top) + (plannedRect.height / 2) + 60,
      x2: colWidth + 123,
      y2: (realityRect.top - gridRect.top) + (realityRect.height / 2) + 60
    };
  }
  const [connections, setConnections] = useState([]);

  // Update connections when events change or on window resize
  useEffect(() => {
    const updateConnections = () => {
      const newConnections = events.reality
        .filter(realityEvent => realityEvent.sourceId)
        .map(realityEvent => {
          const plannedEvent = events.planned.find(p => p.id === realityEvent.sourceId);
          if (!plannedEvent) return null;

          const points = calculateConnectionPoints(plannedEvent, realityEvent);
          if (!points) return null;

          return {
            id: `${plannedEvent.id}-${realityEvent.id}`,
            ...points
          };
        })
        .filter(Boolean);

      setConnections(newConnections);
    };

    updateConnections();
    window.addEventListener('resize', updateConnections);
    return () => window.removeEventListener('resize', updateConnections);
  }, [events, startHour, endHour, density]);

  const moveToStandby = (event) => {
    // Create new standby item
    const standbyItem = {
      id: Date.now(),
      content: event.content,
      colorIndex: event.colorIndex,
      isCheckboxMode: event.isCheckboxMode
    };

    // Add to standby and remove from planned
    updateEventsWithHistory(prev => ({
      ...prev,
      standby: [...prev.standby, standbyItem],
      planned: prev.planned.filter(e => e.id !== event.id)
    }));
  };

  const renderEvent = (event, columnType) => {
    const startIndex = timeSlots.indexOf(event.start);
    const endIndex = timeSlots.indexOf(event.end);
    const height = `${(endIndex - startIndex + 1) * densityConfig[density]}px`;
    const top = `${startIndex * densityConfig[density]}px`;

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
              {columnType === 'planned' && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateToReality(event);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                    title="Copy to Reality"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveToStandby(event);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                    title="Move to Standby"
                  >
                    <ArrowDown size={16} />
                  </button>
                </>
              )}
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
  const isEventInRange = (event) => {
    const [timeStr, period] = event.start.split(' ');
    const [hours, minutes] = timeStr.split(':').map(Number);

    let eventStartHour = hours;
    if (period === 'PM' && hours !== 12) eventStartHour += 12;
    if (period === 'AM' && hours === 12) eventStartHour = 0;

    const eventStartMinutes = eventStartHour * 60 + minutes;
    const startHourMinutes = startHour * 60;

    return eventStartMinutes > startHourMinutes;
  };
  const renderColumn = (columnType) => (
    <div className={`border rounded-lg p-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      <h2 className={`text-xl font-semibold mb-4 text-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
        {columnType === 'planned' ? 'Planned' : 'Reality'}
      </h2>
      <div className="relative" style={{ height: `${timeSlots.length * densityConfig[density]}px` }} ref={timeGridRef}>

        <div className={`absolute -left-4 ${density === 'compact' ? 'top-3' : density === 'comfortable' ? 'top-5' : 'top-7'} h-full`}>
          {timeSlots.map((time) => (
            <div key={time} style={{ height: `${densityConfig[density]}px` }} className="flex items-center">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} select-none`}>
                {time}
              </span>
            </div>
          ))}
        </div>

        {/* Grid lines */}
        <div className="ml-12">
          {timeSlots.map((time) => (
            <div
              key={time}
              style={{ height: `${densityConfig[density]}px` }}
              className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
              onMouseDown={(e) => handleMouseDown(e, time, columnType)}
              onTouchStart={(e) => handleTouchStart(e, time, columnType)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          ))}
        </div>

        {/* Events */}
        {events[columnType].filter(isEventInRange).map(event => renderEvent(event, columnType))}

        {/* Temporary event while dragging */}
        {tempEvent && tempEvent.column === columnType && (
          <div
            className={`absolute left-12 right-2 ${colorOptions[lastColorIndex].class} border rounded opacity-50`}
            style={{
              top: `${timeSlots.indexOf(tempEvent.start) * densityConfig[density]}px`,
              height: `${(timeSlots.indexOf(tempEvent.end) - timeSlots.indexOf(tempEvent.start) + 1) * densityConfig[density]}px`

            }}
          />
        )}
      </div>
    </div>
  );

  const createStandbyItem = () => {
    const newEventId = Date.now();
    updateEventsWithHistory(prev => ({
      ...prev,
      standby: [...prev.standby, {
        id: newEventId,
        content: '',
        colorIndex: lastColorIndex
      }]
    }));

    // Focus the new item
    setTimeout(() => {
      const eventElement = document.querySelector(`[data-standby-id="${newEventId}"]`);
      if (eventElement) {
        const textarea = eventElement.querySelector('textarea');
        if (textarea) {
          textarea.focus();
        }
      }
    }, 0);
  };

  const moveToPlanned = (standbyEvent, shouldCopy = false) => {
    // Get current time
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    // Find the next available 30-minute slot after current time
    let startIndex = timeSlots.findIndex(slot => {
      const [timeStr, period] = slot.split(' ');
      const [hours, minutes] = timeStr.split(':').map(Number);
      let slotHours = hours;
      if (period === 'PM' && hours !== 12) slotHours += 12;
      if (period === 'AM' && hours === 12) slotHours = 0;

      // Convert both times to minutes for comparison
      const slotTotalMinutes = slotHours * 60 + minutes;
      const currentTotalMinutes = currentHours * 60 + currentMinutes;

      return slotTotalMinutes >= currentTotalMinutes;
    });

    // Function to check if a slot is available
    const isSlotAvailable = (index) => {
      return !events.planned.some(event => {
        const eventStart = timeSlots.indexOf(event.start);
        const eventEnd = timeSlots.indexOf(event.end);
        return (index <= eventEnd && index >= eventStart);
      });
    };

    // Look for first available slot
    const findFirstAvailableSlot = (fromIndex) => {
      for (let i = fromIndex; i < timeSlots.length; i++) {
        if (isSlotAvailable(i)) {
          return i;
        }
      }
      return -1;
    };

    // Try to find a slot after current time
    let availableSlot = startIndex !== -1 ? findFirstAvailableSlot(startIndex) : -1;

    // If no slot found after current time, try from the beginning
    if (availableSlot === -1) {
      availableSlot = findFirstAvailableSlot(1);
    }

    if (availableSlot !== -1) {
      const newEvent = {
        id: Date.now(),
        start: timeSlots[availableSlot],
        end: timeSlots[availableSlot],
        content: standbyEvent.content,
        colorIndex: standbyEvent.colorIndex,
        isCheckboxMode: standbyEvent.isCheckboxMode
      };

      updateEventsWithHistory(prev => ({
        ...prev,
        planned: [...prev.planned, newEvent],
        standby: shouldCopy ? prev.standby : prev.standby.filter(e => e.id !== standbyEvent.id)
      }));
    }
  }

  const renderStandbySection = () => (
    <div className={`mt-8 border rounded-lg p-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className={`text-xl font-semibold text-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          Standby Items
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={createStandbyItem}
            className={`px-3 py-1 rounded-lg flex items-center gap-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
          >
            <Plus size={16} />
            Add Item
          </button>
          <button
            onClick={clearStandby}
            className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {events.standby.map(item => (
          <div
            key={item.id}
            data-standby-id={item.id}
            className={`relative w-64 min-h-32 p-2 rounded ${colorOptions[item.colorIndex || 0].class} border`}
          >
            {item.isCheckboxMode ? (
              <div className="w-full h-full p-1 overflow-y-auto">
                {item.content.split('\n').filter(task => task.trim()).map((task, index) => (
                  <div key={index} className="flex items-start gap-2 mb-0.5">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={task.startsWith('[x]')}
                      onChange={() => {
                        const tasks = item.content.split('\n').filter(t => t.trim());
                        tasks[index] = task.startsWith('[x]') ?
                          task.replace('[x]', '[ ]') :
                          task.startsWith('[ ]') ?
                            task.replace('[ ]', '[x]') :
                            `[x]${task}`;
                        updateEventContent('standby', item.id, tasks.join('\n'));
                      }}
                    />
                    <span className={`${task.startsWith('[x]') ? 'line-through' : ''} ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {task.replace(/^\[[\sx]\]/, '').trim()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <textarea
                className={`w-full h-full min-h-24 resize-none bg-transparent pr-12 ${isDark ? 'text-gray-300 placeholder-gray-500' : 'text-gray-700 placeholder-gray-400'
                  }`}
                value={item.content}
                onChange={(e) => updateEventContent('standby', item.id, e.target.value)}
                placeholder="Enter item details..."
              />
            )}

            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={() => moveToPlanned(item, true)}
                className="text-gray-500 hover:text-gray-700"
                title="Copy to Planned"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={() => moveToPlanned(item, false)}
                className="text-gray-500 hover:text-gray-700"
                title="Move to Planned"
              >
                <ArrowUp size={16} />
              </button>
              <button
                onClick={() => toggleEventMode('standby', item.id)}
                className="text-gray-500 hover:text-gray-700"
                title={item.isCheckboxMode ? "Switch to Text Mode" : "Switch to Checkbox Mode"}
              >
                {item.isCheckboxMode ? <Type size={16} /> : <CheckSquare size={16} />}
              </button>
              <div className="relative color-picker">
                <button
                  onClick={() => setOpenColorPicker(openColorPicker === item.id ? null : item.id)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <Palette size={16} />
                </button>
                {openColorPicker === item.id && (
                  <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 w-32">
                    {colorOptions.map((color, index) => (
                      <button
                        key={index}
                        className={`w-full p-2 text-left ${color.class} ${color.hoverClass}`}
                        onClick={() => updateEventColor('standby', item.id, index)}
                      >
                        {color.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => deleteEvent('standby', item.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className={`max-w-6xl mx-auto p-4 shadow-lg rounded-lg ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
        }`}
      style={{ minWidth: '640px' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <a href="http://catlendar.online">
            <img
              src="/logo2.svg"
              alt="Catlendar.online Logo"
              className={`rounded ${isDark ? 'invert' : ''}`}
            />
          </a>
          <div className="w-fit">
            <img
              src="/logo1.svg"
              alt="Catlendar.online Logo"
              className={`rounded w-1/2 ${isDark ? 'invert' : ''}`}
            />
          </div>
        </div>
        <div className="flex flex-wrap  gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`px-4 py-2 rounded flex items-center gap-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
              >
                <Settings size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={`w-64 ${isDark ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-white text-gray-900 border-gray-200'}`}
            >
              <div className="space-y-4">
                <h3 className="font-medium">Time Range Settings</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Start Time:</label>
                    <select
                      value={startHour}
                      onChange={(e) => updateTimeSettings(parseInt(e.target.value), endHour)}
                      className={`p-1 rounded text-sm ${isDark ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-900'} border`}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{i === 12 ? '12:00 PM' : i > 12 ? `${i - 12}:00 PM` : `${i}:00 AM`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">End Time:</label>
                    <select
                      value={endHour}
                      onChange={(e) => updateTimeSettings(startHour, parseInt(e.target.value))}
                      className={`p-1 rounded text-sm ${isDark ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-900'} border`}
                    >
                      {Array.from({ length: 25 }, (_, i) => (
                        <option key={i} value={i}>{i === 12 ? '12:00 PM' : i > 12 && i < 24 ? `${i - 12}:00 PM` : i === 24 ? '12:00 AM' : `${i}:00 AM`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 mt-4">
                    <h3 className="font-medium">Time Slot Height</h3>
                    <div className="flex items-center justify-between">
                      <label className="text-sm">Density:</label>
                      <select
                        value={density}
                        onChange={(e) => setDensity(e.target.value)}
                        className={`p-1 rounded text-sm ${isDark ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-900'} border`}
                      >
                        <option value="compact">Compact</option>
                        <option value="comfortable">Comfortable</option>
                        <option value="spacious">Spacious</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <button
            onClick={() => setIsDark(!isDark)}
            className={`px-4 py-2 rounded flex items-center gap-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
              }`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={handleUndo}
            disabled={currentIndex <= 0}
            className={`px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-2 ${currentIndex <= 0 ? 'opacity-50 cursor-not-allowed' : ''
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
            top: `${getCurrentTimePosition()}px`,
          }}
        >
          <div className="flex items-center w-full">
            {/* Left line with padding to start more right */}
            <div className="flex-1 ml-4">
              <div className="border-t-2 border-red-500 w-[91%] ml-11" />
            </div>

            {/* Time box with original positioning */}
            <div className="bg-red-500 text-white text-sm px-0.5 py-1 rounded mr-4 -ml-4">
              {formatTimeForDisplay(currentTime)}
            </div>

            {/* Right line */}
            <div className="flex-1 mr-4">
              <div className="border-t-2 border-red-500 w-[91%] ml-11" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {renderColumn('planned')}
          {renderColumn('reality')}
        </div>
        <svg
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 1 }}
        >
          {connections.map(conn => (
            <g key={conn.id}>
              <path
                d={`M ${conn.x1} ${conn.y1} C ${conn.x1 + 20} ${conn.y1}, ${conn.x2 - 20} ${conn.y2}, ${conn.x2} ${conn.y2}`}
                stroke="#8884"
                strokeWidth="3"
                fill="none"
              />
              <path
                d={`M ${conn.x2 + 8} ${conn.y2} L ${conn.x2} ${conn.y2 - 5} L ${conn.x2} ${conn.y2 + 5} Z`}
                fill="#8884"
              />
            </g>
          ))}
        </svg>
      </div>
      {renderStandbySection()}
    </div>
  );
};

export default IntraDayPlanner;