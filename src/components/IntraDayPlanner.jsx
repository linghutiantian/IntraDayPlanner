import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trash2, Palette, CheckSquare, Type, Undo2, Copy, Sun, Moon, Plus, ArrowUp, ArrowDown, Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import DatePicker from './DatePicker';
import GoogleCalendarImport from './GoogleCalendarImport';

// Utility function to check if two time ranges overlap using direct time comparison
const checkTimeOverlap = (startTime1, endTime1, startTime2, endTime2) => {
  // Function to convert time to minutes since midnight
  const timeToMinutes = (timeStr, period) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    let totalHours = hours;
    if (period === 'PM' && hours !== 12) totalHours += 12;
    if (period === 'AM' && hours === 12) totalHours = 0;
    return totalHours * 60 + minutes;
  };

  // Parse times
  const [start1Time, start1Period] = startTime1.split(' ');
  const [end1Time, end1Period] = endTime1.split(' ');
  const [start2Time, start2Period] = startTime2.split(' ');
  const [end2Time, end2Period] = endTime2.split(' ');

  // Convert to minutes
  const start1Minutes = timeToMinutes(start1Time, start1Period);
  const end1Minutes = timeToMinutes(end1Time, end1Period);
  const start2Minutes = timeToMinutes(start2Time, start2Period);
  const end2Minutes = timeToMinutes(end2Time, end2Period);

  // Time-based overlap check
  return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
};

// Add the current version number constant
const CURRENT_VERSION = 1;

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return formatDate(today);
  });

  // Add these state variables to your component's state
  const [touchTimer, setTouchTimer] = useState(null);
  const [touchStartPosition, setTouchStartPosition] = useState(null);
  const [touchDragStart, setTouchDragStart] = useState(null);
  const [touchStartTime, setTouchStartTime] = useState(null);
  const LONG_PRESS_DURATION = 500; // milliseconds

  // Add these functions to handle touch events

  const handleTouchStart = (e, timeSlot, column) => {
    const touch = e.touches[0];
    const gridRect = timeGridRef.current.getBoundingClientRect();
    const relativeY = touch.clientY - gridRect.top;

    // Store the initial touch position
    setTouchStartPosition({
      x: touch.clientX,
      y: touch.clientY,
      relativeY: relativeY
    });

    // Start a timer for long press
    const timer = setTimeout(() => {
      // Long press detected - create event
      const slotIndex = Math.floor(relativeY / densityConfig[density]);

      // Allow creating events at any valid index (including 0)
      if (slotIndex >= 0 && slotIndex < timeSlots.length) {
        setTouchDragStart(timeSlots[slotIndex]);
        setCurrentColumn(column);

        setTempEvent({
          start: timeSlots[slotIndex],
          end: timeSlots[slotIndex],
          column
        });
      }
    }, LONG_PRESS_DURATION);

    setTouchTimer(timer);
    setTouchStartTime(Date.now());
  };

  const handleTouchMove = (e) => {
    // Only prevent default if we're actively dragging or resizing
    if (!touchStartPosition) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosition.x;
    const dy = touch.clientY - touchStartPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If movement is detected before long press completes, cancel the timer
    if (touchTimer && distance > 10) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
    }

    // Handle event resizing if in resize mode
    if (resizing) {
      const gridRect = timeGridRef.current.getBoundingClientRect();
      const relativeY = Math.max(0, Math.min(touch.clientY - gridRect.top, gridRect.height - densityConfig[density]));
      const currentSlotIndex = Math.floor(relativeY / densityConfig[density]);

      if (currentSlotIndex >= 0 && currentSlotIndex < timeSlots.length) {
        const { event, edge, columnType } = resizing;
        const newStart = edge === 'top' ? timeSlots[currentSlotIndex] : event.start;
        const newEnd = edge === 'bottom' ? timeSlots[currentSlotIndex + 1 < timeSlots.length ? currentSlotIndex + 1 : currentSlotIndex] : event.end;

        if (timeSlots.indexOf(newStart) <= timeSlots.indexOf(newEnd)) {
          const hasOverlap = getCurrentEvents(columnType).some(otherEvent => {
            if (otherEvent.id === event.id) return false;
            return checkTimeOverlap(newStart, newEnd, otherEvent.start, otherEvent.end);
          });

          if (!hasOverlap) {
            setEvents(prev => ({
              ...prev,
              [columnType]: {
                ...prev[columnType],
                [selectedDate]: (prev[columnType][selectedDate] || []).map(evt =>
                  evt.id === event.id ? { ...evt, start: newStart, end: newEnd } : evt
                )
              }
            }));
          }
        }
      }
      return;
    }

    // Handle event moving
    if (movingEvent) {
      const gridRect = timeGridRef.current.getBoundingClientRect();
      const relativeY = Math.max(0, Math.min(touch.clientY - gridRect.top, gridRect.height - densityConfig[density]));
      const currentSlotIndex = Math.floor(relativeY / densityConfig[density]);

      if (currentSlotIndex >= 0 && currentSlotIndex < timeSlots.length) {
        const { event, offsetY } = movingEvent;
        const eventDuration = timeSlots.indexOf(event.end) - timeSlots.indexOf(event.start) - 1;
        const newStartIndex = Math.max(0, Math.min(currentSlotIndex - Math.floor(offsetY / densityConfig[density]), timeSlots.length - eventDuration - 1));
        const newEndIndex = newStartIndex + eventDuration;

        const hasOverlap = getCurrentEvents(movingEvent.columnType).some(otherEvent => {
          if (otherEvent.id === event.id) return false;
          // Use time-based comparison instead of index-based
          const newEventStart = timeSlots[newStartIndex];
          const newEventEnd = timeSlots[newEndIndex + 1 < timeSlots.length ? newEndIndex + 1 : newEndIndex];
          return checkTimeOverlap(newEventStart, newEventEnd, otherEvent.start, otherEvent.end);
        });

        if (!hasOverlap) {
          setEvents(prev => ({
            ...prev,
            [movingEvent.columnType]: {
              ...prev[movingEvent.columnType],
              [selectedDate]: (prev[movingEvent.columnType][selectedDate] || []).map(evt =>
                evt.id === event.id ? {
                  ...evt,
                  start: timeSlots[newStartIndex],
                  end: timeSlots[newEndIndex + 1 < timeSlots.length ? newEndIndex + 1 : newEndIndex]
                } : evt
              )
            }
          }));
        }
      }
      return;
    }

    // Handle event creation (drag to define size)
    if (tempEvent) {
      const gridRect = timeGridRef.current.getBoundingClientRect();
      const relativeY = Math.max(0, Math.min(touch.clientY - gridRect.top, gridRect.height - densityConfig[density]));
      const currentSlotIndex = Math.floor(relativeY / densityConfig[density]);

      if (currentSlotIndex >= 0 && currentSlotIndex < timeSlots.length) {
        setTempEvent(prev => ({
          ...prev,
          end: timeSlots[currentSlotIndex]
        }));
      }
    }
  };

  const handleTouchEnd = (e) => {
    // Clear the long press timer if it's still running
    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
    }

    // Handle short tap on an event for focusing textarea
    const shortTapDuration = Date.now() - touchStartTime;
    if (shortTapDuration < LONG_PRESS_DURATION && !touchDragStart && !resizing && !movingEvent) {
      // This was a short tap - perhaps focus on text area if tapped on an event
      // The existing click event should handle this
    }

    // Handle event creation completion
    if (tempEvent) {
      const startIndex = timeSlots.indexOf(tempEvent.start);
      const endIndex = timeSlots.indexOf(tempEvent.end);

      // Prevent creating zero duration
      if (startIndex > endIndex) {
        setIsDragging(false);
        setTouchDragStart(null);
        setCurrentColumn(null);
        setTempEvent(null);
        return;
      }

      // Check for overlaps
      const endTimeSlot = timeSlots[timeSlots.indexOf(tempEvent.end) + 1 < timeSlots.length ?
        timeSlots.indexOf(tempEvent.end) + 1 :
        timeSlots.indexOf(tempEvent.end)];
      const hasOverlap = getCurrentEvents(tempEvent.column).some(event => {
        return checkTimeOverlap(tempEvent.start, endTimeSlot, event.start, event.end);
      });

      if (!hasOverlap) {
        const newEventId = Date.now();
        const newEvent = {
          id: newEventId,
          start: tempEvent.start,
          end: timeSlots[timeSlots.indexOf(tempEvent.end) + 1 < timeSlots.length ? timeSlots.indexOf(tempEvent.end) + 1 : timeSlots.indexOf(tempEvent.end)],
          content: '',
          colorIndex: lastColorIndex
        };

        updateEventsWithHistory(prev => ({
          ...prev,
          [tempEvent.column]: {
            ...prev[tempEvent.column],
            [selectedDate]: [...(prev[tempEvent.column][selectedDate] || []), newEvent]
          }
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
      // Record the final state in history when the touch operation ends
      updateEventsWithHistory(events);
    }

    // Reset all touch-related state
    setTouchStartPosition(null);
    setTouchDragStart(null);
    setIsDragging(false);
    setCurrentColumn(null);
    setTempEvent(null);
    setResizing(null);
    setMovingEvent(null);
  };

  // Function for touch-based event resizing
  const handleTouchResizeStart = (e, event, edge, columnType) => {
    e.stopPropagation();

    const touch = e.touches[0];

    // Store the initial touch position
    setTouchStartPosition({
      x: touch.clientX,
      y: touch.clientY
    });

    // Start a timer for long press before resizing
    const timer = setTimeout(() => {
      // Long press detected - start resizing the event
      setResizing({ event, edge, columnType });
    }, LONG_PRESS_DURATION);

    setTouchTimer(timer);
    setTouchStartTime(Date.now());
  };

  // Function for touch-based event moving
  const startEventTouchMove = (e, event, columnType) => {
    e.stopPropagation();
    if (e.target.classList.contains('resize-handle')) return;

    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = touch.clientY - rect.top;

    // Store the initial touch position
    setTouchStartPosition({
      x: touch.clientX,
      y: touch.clientY
    });

    // Start a timer for long press before moving
    const timer = setTimeout(() => {
      // Long press detected - start moving the event
      setMovingEvent({
        event,
        columnType,
        offsetY
      });
    }, LONG_PRESS_DURATION);

    setTouchTimer(timer);
    setTouchStartTime(Date.now());
  };

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
      // For the last slot, add a special designator
      if (i === totalSlots - 1 && startHour === 0 && endHour === 24) {
        slots.push(`${hours === 0 || hours === 24 ? 12 : hours === 12 ? 12 : hours % 12}:${minutes.toString().padStart(2, '0')} ${hours < 12 || hours === 24 ? 'AM' : 'PM'} [END]`);
      } else {
        slots.push(`${hours === 0 || hours === 24 ? 12 : hours === 12 ? 12 : hours % 12}:${minutes.toString().padStart(2, '0')} ${hours < 12 || hours === 24 ? 'AM' : 'PM'}`);
      }
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
    },
    {
      class: isDark ? 'bg-gray-600 border-gray-500' : 'bg-gray-100 border-gray-300',
      hoverClass: isDark ? 'hover:bg-gray-500' : 'hover:bg-gray-200',
      label: 'Grey'
    }
  ];

  const [lastColorIndex, setLastColorIndex] = useState(0); // Default to blue (index 0)

  const initialEvents = {
    planned: {},
    reality: {},
    standby: [],
    version: CURRENT_VERSION
  };

  // Function to fix time slots in events (shift by 30 minutes earlier)
  const migrateEventsTimeSlots = (events, allTimeSlots) => {
    return events.map(event => {
      // Calculate the correct time slot indices, fixing the 30-minute lag
      // If the event start time is at index 0, we don't want to go negative
      const startIndex = allTimeSlots.indexOf(event.start) <= 0 ? 0 : allTimeSlots.indexOf(event.start) - 1;

      return {
        ...event,
        start: allTimeSlots[startIndex],
      };
    });
  };

  // State management
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('dayPlanner');
    if (saved) {
      const parsedEvents = JSON.parse(saved);

      // Check if the data has a version number
      const dataVersion = parsedEvents.version || 0;

      // Ensure standby array exists in saved data
      const newFormat = {
        planned: typeof parsedEvents.planned === 'object' && !Array.isArray(parsedEvents.planned)
          ? parsedEvents.planned
          : { [selectedDate]: parsedEvents.planned || [] },
        reality: typeof parsedEvents.reality === 'object' && !Array.isArray(parsedEvents.reality)
          ? parsedEvents.reality
          : { [selectedDate]: parsedEvents.reality || [] },
        standby: parsedEvents.standby || [],
        version: dataVersion
      };

      // If unversioned data, adjust event times to fix the 30-minute lag
      if (dataVersion < 1) {
        // Migrate each day's events in planned and reality
        Object.keys(newFormat.planned).forEach(date => {
          if (Array.isArray(newFormat.planned[date])) {
            newFormat.planned[date] = migrateEventsTimeSlots(newFormat.planned[date], timeSlots);
          }
        });

        Object.keys(newFormat.reality).forEach(date => {
          if (Array.isArray(newFormat.reality[date])) {
            newFormat.reality[date] = migrateEventsTimeSlots(newFormat.reality[date], timeSlots);
          }
        });

        // Set the version to current
        newFormat.version = CURRENT_VERSION;
      }

      return newFormat;
    }
    return initialEvents;
  });

  // Shows version info in console for debugging
  useEffect(() => {
    if (events.version !== undefined) {
      console.log(`Current data version: ${events.version}, Latest version: ${CURRENT_VERSION}`);
    }
  }, [events.version]);

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

    // Ensure version number is always set correctly
    if (!newEvents.version) {
      newEvents.version = CURRENT_VERSION;
    }

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
    const top_pixel = 47;
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

  const handleMouseDown = (e, timeSlot, column) => {
    if (e.target.classList.contains('resize-handle') || e.target.classList.contains('event-content')) return;

    const gridRect = timeGridRef.current.getBoundingClientRect();
    const relativeY = e.clientY - gridRect.top;
    const slotIndex = Math.floor(relativeY / densityConfig[density]);

    // Allow creating events at any valid index (including 0)
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
        const newEnd = edge === 'bottom' ? timeSlots[currentSlotIndex + 1 < timeSlots.length ? currentSlotIndex + 1 : currentSlotIndex] : event.end;

        if (timeSlots.indexOf(newStart) <= timeSlots.indexOf(newEnd)) {
          const hasOverlap = getCurrentEvents(columnType).some(otherEvent => {
            if (otherEvent.id === event.id) return false;
            return checkTimeOverlap(newStart, newEnd, otherEvent.start, otherEvent.end);
          });

          if (!hasOverlap) {
            updateEventsWithHistory(prev => ({
              ...prev,
              [columnType]: {
                ...prev[columnType],
                [selectedDate]: (prev[columnType][selectedDate] || []).map(evt =>
                  evt.id === event.id ? { ...evt, start: newStart, end: newEnd } : evt
                )
              }
            }));
          }
        }
      } else if (movingEvent) {
        const { event, offsetY } = movingEvent;
        const eventDuration = timeSlots.indexOf(event.end) - timeSlots.indexOf(event.start) - 1;
        const newStartIndex = Math.max(0, Math.min(currentSlotIndex - Math.floor(offsetY / densityConfig[density]), timeSlots.length - eventDuration - 1));
        const newEndIndex = newStartIndex + eventDuration;

        const hasOverlap = getCurrentEvents(movingEvent.columnType).some(otherEvent => {
          if (otherEvent.id === event.id) return false;
          // Use time-based comparison instead of index-based
          const newEventStart = timeSlots[newStartIndex];
          const newEventEnd = timeSlots[newEndIndex + 1 < timeSlots.length ? newEndIndex + 1 : newEndIndex];
          return checkTimeOverlap(newEventStart, newEventEnd, otherEvent.start, otherEvent.end);
        });

        if (!hasOverlap) {
          setEvents(prev => ({
            ...prev,
            [movingEvent.columnType]: {
              ...prev[movingEvent.columnType],
              [selectedDate]: (prev[movingEvent.columnType][selectedDate] || []).map(evt =>
                evt.id === event.id ? {
                  ...evt,
                  start: timeSlots[newStartIndex],
                  end: timeSlots[newEndIndex + 1 < timeSlots.length ? newEndIndex + 1 : newEndIndex]
                } : evt
              )
            }
          }));
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging && tempEvent) {
      const startIndex = timeSlots.indexOf(tempEvent.start);
      const endIndex = timeSlots.indexOf(tempEvent.end);

      // Prevent creating zero duration
      if (startIndex > endIndex) {
        setIsDragging(false);
        setDragStart(null);
        setCurrentColumn(null);
        setTempEvent(null);
        return;
      }

      // Allow creation of 30-minute events (when start equals end)
      const endTimeSlot = timeSlots[timeSlots.indexOf(tempEvent.end) + 1 < timeSlots.length ?
        timeSlots.indexOf(tempEvent.end) + 1 :
        timeSlots.indexOf(tempEvent.end)];
      const hasOverlap = getCurrentEvents(tempEvent.column).some(event => {
        return checkTimeOverlap(tempEvent.start, endTimeSlot, event.start, event.end);
      });

      if (!hasOverlap) {
        const newEventId = Date.now();
        const newEvent = {
          id: newEventId,
          start: tempEvent.start,
          end: timeSlots[timeSlots.indexOf(tempEvent.end) + 1 < timeSlots.length ? timeSlots.indexOf(tempEvent.end) + 1 : timeSlots.indexOf(tempEvent.end)],
          content: '',
          colorIndex: lastColorIndex // Use the last selected color
        };

        updateEventsWithHistory(prev => ({
          ...prev,
          [tempEvent.column]: {
            ...prev[tempEvent.column],
            [selectedDate]: [...(prev[tempEvent.column][selectedDate] || []), newEvent]
          }
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
      [columnType]: columnType === 'standby'
        ? prev.standby.map(event =>
          event.id === eventId ? { ...event, content: newContent } : event
        )
        : {
          ...prev[columnType],
          [selectedDate]: (prev[columnType][selectedDate] || []).map(event =>
            event.id === eventId ? { ...event, content: newContent } : event
          )
        }
    }));
  };

  const toggleEventMode = (columnType, eventId) => {
    updateEventsWithHistory(prev => ({
      ...prev,
      [columnType]: columnType === 'standby'
        ? prev.standby.map(event =>
          event.id === eventId ? {
            ...event,
            isCheckboxMode: !event.isCheckboxMode
          } : event
        )
        : {
          ...prev[columnType],
          [selectedDate]: (prev[columnType][selectedDate] || []).map(event =>
            event.id === eventId ? {
              ...event,
              isCheckboxMode: !event.isCheckboxMode
            } : event
          )
        }
    }));
  };

  const deleteEvent = (columnType, eventId) => {
    if (columnType === 'standby') {
      updateEventsWithHistory(prev => ({
        ...prev,
        standby: prev.standby.filter(event => event.id !== eventId)
      }));
    } else {
      updateEventsWithHistory(prev => ({
        ...prev,
        [columnType]: {
          ...prev[columnType],
          [selectedDate]: (prev[columnType][selectedDate] || [])
            .filter(event => event.id !== eventId)
        }
      }));
    }
  };

  const updateEventColor = (columnType, eventId, colorIndex) => {
    setLastColorIndex(colorIndex); // Store the last used color index
    updateEventsWithHistory(prev => ({
      ...prev,
      [columnType]: columnType === 'standby'
        ? prev.standby.map(event =>
          event.id === eventId ? {
            ...event,
            colorIndex
          } : event
        )
        : {
          ...prev[columnType],
          [selectedDate]: (prev[columnType][selectedDate] || []).map(event =>
            event.id === eventId ? {
              ...event,
              colorIndex
            } : event
          )
        }
    }));
    setOpenColorPicker(null);
  };

  const resetPlanner = () => {
    updateEventsWithHistory(prev => ({
      ...prev,
      planned: {
        ...prev.planned,
        [selectedDate]: []
      },
      reality: {
        ...prev.reality,
        [selectedDate]: []
      }
    }));
  };

  const clearStandby = () => {
    updateEventsWithHistory(prev => ({
      ...prev,
      standby: []
    }));
  };

  const renderDatePicker = () => (
    <DatePicker
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      isDark={isDark}
    />
  );

  const getCurrentEvents = (type) => {
    return events[type][selectedDate] || [];
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
    const eventDuration = timeSlots.indexOf(event.end) - timeSlots.indexOf(event.start) - 1;
    let newStartIndex = timeSlots.indexOf(event.start);
    let found = false;

    // Try to find a non-overlapping slot
    while (!found && newStartIndex < timeSlots.length - eventDuration) {
      const newEndIndex = newStartIndex + eventDuration;
      const hasOverlap = (events.reality[selectedDate] || []).some(existingEvent => {
        const newEventStart = timeSlots[newStartIndex];
        const newEventEnd = timeSlots[newEndIndex + 1 < timeSlots.length ? newEndIndex + 1 : newEndIndex];
        return checkTimeOverlap(newEventStart, newEventEnd, existingEvent.start, existingEvent.end);
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
        end: timeSlots[newStartIndex + eventDuration + 1 < timeSlots.length ? newStartIndex + eventDuration + 1 : newStartIndex + eventDuration],
      };

      updateEventsWithHistory(prev => ({
        ...prev,
        reality: {
          ...prev.reality,
          [selectedDate]: [...(prev.reality[selectedDate] || []), newEvent]
        }
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

  useEffect(() => {
    const preventContextMenu = (e) => {
      // Prevent default context menu
      e.preventDefault();
    };

    const preventTouchScroll = (e) => {
      if (isDragging || resizing || movingEvent || tempEvent) {
        e.preventDefault();
      }
    };

    // Add event listeners to both column containers
    const plannedColumn = document.querySelector('[data-column="planned"]');
    const realityColumn = document.querySelector('[data-column="reality"]');

    if (plannedColumn) {
      plannedColumn.addEventListener('contextmenu', preventContextMenu);
    }

    if (realityColumn) {
      realityColumn.addEventListener('contextmenu', preventContextMenu);
    }

    document.addEventListener('touchmove', preventTouchScroll, { passive: false });

    // Clean up
    return () => {
      if (plannedColumn) {
        plannedColumn.removeEventListener('contextmenu', preventContextMenu);
      }

      if (realityColumn) {
        realityColumn.removeEventListener('contextmenu', preventContextMenu);
      }

      document.removeEventListener('touchmove', preventTouchScroll);
    };
  }, [density, timeSlots, isDragging, resizing, movingEvent, tempEvent]);

  // Update connections when events change or on window resize
  useEffect(() => {
    const updateConnections = () => {
      const newConnections = getCurrentEvents('reality')
        .filter(realityEvent => realityEvent.sourceId)
        .map(realityEvent => {
          const plannedEvent = getCurrentEvents('planned').find(p => p.id === realityEvent.sourceId);
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
  }, [events, startHour, endHour, density, selectedDate]);

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
      planned: {
        ...prev.planned,
        [selectedDate]: (prev.planned[selectedDate] || []).filter(e => e.id !== event.id)
      }
    }));
  };

  const renderEvent = (event, columnType) => {
    const startIndex = timeSlots.indexOf(event.start);
    const endIndex = timeSlots.indexOf(event.end);
    const height = `${(endIndex - startIndex) * densityConfig[density]}px`;
    const top = `${startIndex * densityConfig[density]}px`;

    return (
      <div
        key={event.id}
        data-event-id={event.id}
        className={`absolute left-12 right-2 ${colorOptions[event.colorIndex || 0].class} border rounded cursor-move`}
        style={{ top, height }}
        onMouseDown={(e) => startEventMove(e, event, columnType)}
        onTouchStart={(e) => startEventTouchMove(e, event, columnType)}
      >
        <div
          className="absolute top-0 left-0 right-0 h-2 cursor-n-resize resize-handle hover:bg-gray-400/20 z-10"
          onMouseDown={(e) => handleResizeStart(e, event, 'top', columnType)}
          onTouchStart={(e) => handleTouchResizeStart(e, event, 'top', columnType)}
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
          onTouchStart={(e) => handleTouchResizeStart(e, event, 'bottom', columnType)}
        />
      </div>
    );
  };

  const isEventInRange = (event) => {
    // Parse event start time
    const [startTimeStr, startPeriod] = event.start.split(' ');
    const [startHours, startMinutes] = startTimeStr.split(':').map(Number);

    let eventStartHour = startHours;
    if (startPeriod === 'PM' && startHours !== 12) eventStartHour += 12;
    if (startPeriod === 'AM' && startHours === 12) eventStartHour = 0;

    const eventStartMinutes = eventStartHour * 60 + startMinutes;

    // Parse event end time
    const [endTimeStr, endPeriod] = event.end.split(' ');
    const [endHours, endMinutes] = endTimeStr.split(':').map(Number);

    let eventEndHour = endHours;
    if (endPeriod === 'PM' && endHours !== 12) eventEndHour += 12;
    if (endPeriod === 'AM' && endHours === 12) eventEndHour = 0;

    const eventEndMinutes = eventEndHour * 60 + endMinutes;

    // Get planner's time range in minutes
    const plannerStartMinutes = startHour * 60;
    const plannerEndMinutes = endHour * 60;

    // Event is in range if any part of it overlaps with the planner's time range
    return eventEndMinutes > plannerStartMinutes && eventStartMinutes < plannerEndMinutes;
  };

  const renderColumn = (columnType) => (
    <div
      className={`border rounded-lg p-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
      data-column={columnType}
    >
      <h2 className={`text-xl font-semibold mb-4 text-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
        {columnType === 'planned' ? 'Planned' : 'Reality'}
      </h2>
      <div className="relative"
        style={{
          height: `${timeSlots.length * densityConfig[density]}px`
        }}
        ref={timeGridRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Time labels column - add the last time slot label */}
        <div className="absolute -left-4 top-0 h-full">
          {/* Display all existing time slots */}
          {timeSlots.map((time, index) => (
            <div
              key={time}
              style={{ height: `${densityConfig[density]}px` }}
              className="flex items-center"
            >
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} select-none`} style={{ marginTop: `${density === 'compact' ? -30 : density === 'comfortable' ? -45 : -60}px` }}>
                {time}
              </span>
            </div>
          ))}

        </div>

        {/* Grid lines with top border for the first slot */}
        <div className="ml-12">
          {/* Add a horizontal line at the very top - beginning of first time slot */}
          <div
            className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
          />

          {/* Regular grid lines */}
          {/* Regular grid lines - skip the last slot */}
          {timeSlots.slice(0, -1).map((time, index) => (
            <div
              key={time}
              style={{ height: `${densityConfig[density]}px` }}
              className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
              onMouseDown={(e) => handleMouseDown(e, time, columnType)}
              onTouchStart={(e) => handleTouchStart(e, time, columnType)}
            />
          ))}
        </div>

        {/* Events */}
        {getCurrentEvents(columnType).filter(isEventInRange).map(event => renderEvent(event, columnType))}

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
      const plannedEvents = events.planned[selectedDate] || [];
      return !plannedEvents.some(event => {
        const eventStart = timeSlots.indexOf(event.start);
        const eventEnd = timeSlots.indexOf(event.end);
        return (index < eventEnd && index >= eventStart);
      });
    };

    // Look for first available slot
    const findFirstAvailableSlot = (fromIndex) => {
      for (let i = fromIndex; i < timeSlots.length - 1; i++) {
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
      availableSlot = findFirstAvailableSlot(0);
    }

    if (availableSlot !== -1) {
      const newEvent = {
        id: Date.now(),
        start: timeSlots[availableSlot],
        end: timeSlots[availableSlot + 1 < timeSlots.length ? availableSlot + 1 : availableSlot],
        content: standbyEvent.content,
        colorIndex: standbyEvent.colorIndex,
        isCheckboxMode: standbyEvent.isCheckboxMode
      };

      updateEventsWithHistory(prev => ({
        ...prev,
        planned: {
          ...prev.planned,
          [selectedDate]: [...(prev.planned[selectedDate] || []), newEvent]
        },
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
                className={`w-full h-full min-h-24 resize-none bg-transparent px-1 pr-5 ${isDark ? 'text-gray-300 placeholder-gray-500' : 'text-gray-700 placeholder-gray-400'
                  }`}
                value={item.content}
                onChange={(e) => updateEventContent('standby', item.id, e.target.value)}
                placeholder="Enter item details..."
              />
            )}

            <div className="absolute top-2 right-2 flex flex-col gap-1">
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
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <img
            src="/white-logo.png"
            alt="Catlendar Logo"
            className={`h-10 w-auto rounded-lg ${isDark ? 'invert' : ''}`}
          />
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
          {renderDatePicker()}
          <GoogleCalendarImport
            selectedDate={selectedDate}
            updateEventsWithHistory={updateEventsWithHistory}
            events={events}
            timeSlots={timeSlots}
            lastColorIndex={lastColorIndex}
          />
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
            Clear Day
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
      <div className={`mt-8 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        <a
          href="/privacy.html"
          className={`hover:underline ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </a>
        <span>Version: {events.version || 'unknown'}</span>
      </div>
    </div>
  );
};

export default IntraDayPlanner;