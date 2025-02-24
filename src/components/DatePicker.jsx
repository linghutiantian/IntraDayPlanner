import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

const DatePicker = ({ selectedDate, setSelectedDate, isDark }) => {
  const today = new Date();
  const formattedToday = today.getFullYear() + '-' + 
    String(today.getMonth() + 1).padStart(2, '0') + '-' + 
    String(today.getDate()).padStart(2, '0');

  const changeDate = (days) => {
    const currentDate = new Date(selectedDate + 'T00:00:00'); // Add time to ensure consistent date handling
    currentDate.setDate(currentDate.getDate() + days);
    const newDate = currentDate.getFullYear() + '-' + 
      String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
      String(currentDate.getDate()).padStart(2, '0');
    setSelectedDate(newDate);
  };

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-2">
        <button
          onClick={() => changeDate(-1)}
          className={cn(
            "p-2 rounded hover:bg-opacity-80",
            isDark 
              ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          )}
          aria-label="Previous day"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="relative">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={cn(
              "px-4 py-2 rounded cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-blue-500",
              isDark 
                ? "bg-gray-700 hover:bg-gray-600 text-gray-100" 
                : "bg-gray-100 hover:bg-gray-200 text-gray-900",
              "[&::-webkit-calendar-picker-indicator]{display:none}"
            )}
          />
        </div>
        <button
          onClick={() => changeDate(1)}
          className={cn(
            "p-2 rounded hover:bg-opacity-80",
            isDark 
              ? "bg-gray-700 hover:bg-gray-600 text-gray-200" 
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          )}
          aria-label="Next day"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setSelectedDate(formattedToday)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 whitespace-nowrap"
        >
          Today
        </button>
      </div>
    </div>
  );
};

export default DatePicker;