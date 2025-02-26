import React, { useState, useEffect } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.owned.readonly';

const GoogleCalendarImport = ({ selectedDate, updateEventsWithHistory, timeSlots, lastColorIndex }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [gapiInited, setGapiInited] = useState(false);
  const [gisInited, setGisInited] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);

  useEffect(() => {
    // Load the Google API client library
    const loadGapiScript = () => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.onload = () => {
        window.gapi.load('client', initializeGapiClient);
      };
      document.body.appendChild(script);
    };

    // Load the Google Identity Services JavaScript library
    const loadGisScript = () => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = initializeGisClient;
      document.body.appendChild(script);
    };

    loadGapiScript();
    loadGisScript();
  }, []);

  const initializeGapiClient = async () => {
    try {
      await window.gapi.client.init({
        apiKey: API_KEY,
        // Not using discoveryDocs to avoid the 400 error
      });

      // Manually load the calendar API
      const calendarUrl = 'https://www.googleapis.com/calendar/v3/';
      window.gapi.client.calendar = {
        events: {
          list: (params) => {
            return window.gapi.client.request({
              path: `${calendarUrl}calendars/${encodeURIComponent(params.calendarId)}/events`,
              params: {
                timeMin: params.timeMin,
                timeMax: params.timeMax,
                singleEvents: params.singleEvents,
                orderBy: params.orderBy
              }
            });
          }
        }
      };

      setGapiInited(true);
    } catch (error) {
      console.error('Error initializing GAPI client:', error);
    }
  };

  const initializeGisClient = () => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error !== undefined) {
            throw response;
          }
          // Authentication successful, now fetch events
          handleFetchEvents();
          setIsLoading(false);
        },
        error_callback: (error) => {
          console.error('Error during authentication:', error);
          setIsLoading(false);
        }
      });

      setTokenClient(client);
      setGisInited(true);
    } catch (error) {
      console.error('Error initializing GIS client:', error);
    }
  };

  const handleAuthClick = () => {
    if (!tokenClient) {
      console.error('Token client not initialized');
      return;
    }

    setIsLoading(true);

    // Request an access token
    if (window.gapi.client.getToken() === null) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      // Skip display of account chooser and consent dialog
      tokenClient.requestAccessToken({ prompt: '' });
    }
  };

  const handleFetchEvents = async () => {
    setIsLoading(true);

    try {
      // Create date objects for the start and end of the selected day
      const date = new Date(selectedDate);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const response = await window.gapi.client.calendar.events.list({
        'calendarId': 'primary',
        'timeMin': startOfDay.toISOString(),
        'timeMax': endOfDay.toISOString(),
        'singleEvents': true,
        'orderBy': 'startTime'
      });

      const events = response.result.items;

      if (events && events.length > 0) {
        importEventsToPlanner(events);
      } else {
        alert('No events found for this date.');
      }
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      alert('Error fetching events. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Convert time format from 24hr to 12hr with AM/PM
  const convertTo12Hour = (hours, minutes) => {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Find the closest time slot to a given time
  const findClosestTimeSlot = (hours, minutes) => {
    // Normalize to 30-minute intervals
    if (minutes >= 30) {
      minutes = 30;
    } else {
      minutes = 0;
    }

    const timeString = convertTo12Hour(hours, minutes);

    // Find this time in the time slots
    const slotIndex = timeSlots.findIndex(slot => slot === timeString);

    if (slotIndex !== -1) {
      return timeSlots[slotIndex];
    }

    // If exact match not found, find closest available slot
    return timeSlots[0]; // Fallback to first slot
  };

  // Convert time slot string to index
  const getTimeSlotIndex = (timeSlot) => {
    return timeSlots.indexOf(timeSlot);
  };

  // Check if two events overlap
  const eventsOverlap = (event1, event2) => {
    const start1Index = getTimeSlotIndex(event1.start);
    const end1Index = getTimeSlotIndex(event1.end);
    const start2Index = getTimeSlotIndex(event2.start);
    const end2Index = getTimeSlotIndex(event2.end);

    // Check if one event starts during another event
    return (start1Index <= end2Index && end1Index >= start2Index);
  };

  // Import events from Google Calendar into the day planner
  const importEventsToPlanner = (calendarEvents) => {
    updateEventsWithHistory(prev => {
      // Get the current events for this date
      const currentEvents = prev.planned[selectedDate] || [];

      const newEvents = [];
      const skippedEvents = [];

      calendarEvents.forEach(event => {
        // Parse start and end times
        let startTime, endTime;

        if (event.start.dateTime) {
          // This is a timed event
          const startDate = new Date(event.start.dateTime);
          const endDate = new Date(event.end.dateTime);

          startTime = findClosestTimeSlot(startDate.getHours(), startDate.getMinutes());
          endTime = findClosestTimeSlot(endDate.getHours(), endDate.getMinutes());
        } else {
          // This is an all-day event
          startTime = timeSlots[0]; // First time slot
          endTime = timeSlots[timeSlots.length - 1]; // Last time slot
        }

        const newEvent = {
          id: Date.now() + Math.floor(Math.random() * 1000), // Generate unique ID
          start: startTime,
          end: endTime,
          content: event.summary || 'No title',
          colorIndex: lastColorIndex,
          isCheckboxMode: false
        };

        // Check if this new event overlaps with any existing event
        const hasOverlap = currentEvents.some(existingEvent =>
          eventsOverlap(existingEvent, newEvent)
        );

        if (!hasOverlap) {
          newEvents.push(newEvent);
        } else {
          skippedEvents.push(event.summary || 'No title');
        }
      });

      // Show alert with import results
      if (newEvents.length > 0) {
        if (skippedEvents.length > 0) {
          alert(`Imported ${newEvents.length} events from Google Calendar.\nSkipped ${skippedEvents.length} events due to conflicts: ${skippedEvents.join(', ')}`);
        } else {
          alert(`Imported ${newEvents.length} events from Google Calendar.`);
        }
      } else if (skippedEvents.length > 0) {
        alert(`No events imported. Skipped ${skippedEvents.length} events due to conflicts with existing events.`);
      }

      // Add these events to the planner
      return {
        ...prev,
        planned: {
          ...prev.planned,
          [selectedDate]: [...currentEvents, ...newEvents]
        }
      };
    });
  };

  // Determine if we're ready for auth
  const isReadyForAuth = gapiInited && gisInited;

  // Determine if we're ready to fetch events (token exists)
  const isReadyToFetchEvents = isReadyForAuth && window.gapi?.client?.getToken() !== null;

  return (
    <div className="group relative inline-block">
      <button
        onClick={isReadyToFetchEvents ? handleFetchEvents : handleAuthClick}
        disabled={isLoading || !isReadyForAuth}
        className="p-2 bg-white text-gray-600 border border-gray-300 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
        aria-label={isLoading ? 'Loading...' : isReadyToFetchEvents ? 'Import Calendar' : 'Connect Google Calendar'}
      >
        {isLoading ? (
          <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
        ) : (
          <img
            src="google_calendar.png"
            alt="Google Calendar"
            className={`h-5 w-5 ${isReadyToFetchEvents ? "opacity-100" : "opacity-80"}`}
            style={{
              objectFit: 'contain'
            }}
          />
        )}
      </button>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 invisible group-hover:visible transition-all">
        <div className="bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
          Importing from Google Calendar only works for test users
        </div>
        <div className="w-2 h-2 bg-gray-800 transform rotate-45 absolute -bottom-1 left-1/2 -ml-1"></div>
      </div>
    </div>
  );
};

export default GoogleCalendarImport;