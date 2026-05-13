'use client';

import { useState, useEffect } from 'react';

// 1. Define the TypeScript type for our time blocks
type TimeBlock = {
  login: string;
  logout: string;
};

export default function WorkTimeCalculator() {
  // Configuration
  const [targetHours, setTargetHours] = useState<number | string>(8);

  // State for the collapsible details section
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  // Dynamic Array for Time Blocks
  // CHANGED: Initial login is now also empty when there is no local storage
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([
    { login: '', logout: '' },
  ]);

  // We track if the initial load from LocalStorage is done.
  const [isLoaded, setIsLoaded] = useState(false);

  // State to drive real-time minute-by-minute updates
  const [now, setNow] = useState<Date>(new Date());

  // ==========================================
  // REAL-TIME CLOCK: Ticks every 30 seconds
  // ==========================================
  useEffect(() => {
    // We removed the immediate setNow() because the state is already initialized with new Date().
    // Just start the interval to update it every 30 seconds from now on!
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // ==========================================
  // LOCAL STORAGE: Load Data (Runs once on mount)
  // ==========================================
  useEffect(() => {
    const timer = setTimeout(() => {
      const savedData = localStorage.getItem('workTimeTrackerData');

      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          const savedTimestamp = parsed.timestamp;
          const currentTimestamp = Date.now();

          // Calculate 12 hours in milliseconds (12 hours * 60 min * 60 sec * 1000 ms)
          const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

          // Check if the data is less than 12 hours old
          if (currentTimestamp - savedTimestamp < TWELVE_HOURS_MS) {
            setTargetHours(parsed.targetHours);
            setTimeBlocks(parsed.timeBlocks);
          } else {
            // If it's older than 12 hours, delete it
            localStorage.removeItem('workTimeTrackerData');
          }
        } catch (error) {
          console.error('Error parsing local storage data', error);
        }
      }

      // Mark as loaded to remove the loading spinner
      setIsLoaded(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // ==========================================
  // LOCAL STORAGE: Save Data (Runs when inputs change)
  // ==========================================
  useEffect(() => {
    // Only save to local storage IF we have already finished the initial load
    if (isLoaded) {
      const dataToSave = {
        targetHours,
        timeBlocks,
        timestamp: Date.now(), // Save the exact moment it was last updated
      };
      localStorage.setItem('workTimeTrackerData', JSON.stringify(dataToSave));
    }
  }, [targetHours, timeBlocks, isLoaded]);

  // Handlers for dynamic rows
  const addTimeBlock = () => {
    setTimeBlocks([...timeBlocks, { login: '', logout: '' }]);
  };

  const removeTimeBlock = (indexToRemove: number) => {
    setTimeBlocks(timeBlocks.filter((_, index) => index !== indexToRemove));
  };

  const updateTimeBlock = (
    index: number,
    field: keyof TimeBlock,
    value: string,
  ) => {
    const newBlocks = [...timeBlocks];
    newBlocks[index][field] = value;
    setTimeBlocks(newBlocks);
  };

  // Helper to convert "HH:MM" to total minutes
  const timeToMins = (t: string | null): number | null => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  // Helper to convert minutes to "Hh Mm" string
  const minsToTimeStr = (m: number): string => {
    const isNegative = m < 0;
    const absM = Math.abs(m);
    const hours = Math.floor(absM / 60);
    const mins = absM % 60;
    return `${isNegative ? '-' : ''}${hours}h ${mins}m`;
  };

  // ==========================================
  // Render Loading State (Prevents UI Flash)
  // ==========================================
  if (!isLoaded) {
    return (
      <div className='min-h-dvh bg-[linear-gradient(115deg,#94a3b8_0%,#cbd5e1_50%,#94a3b8_100%)] flex flex-col items-center justify-center p-4 font-sans'>
        <svg
          className='animate-spin h-10 w-10 text-white/80 mb-4'
          xmlns='http://www.w3.org/2000/svg'
          fill='none'
          viewBox='0 0 24 24'
        >
          <circle
            className='opacity-25'
            cx='12'
            cy='12'
            r='10'
            stroke='currentColor'
            strokeWidth='4'
          ></circle>
          <path
            className='opacity-75'
            fill='currentColor'
            d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
          ></path>
        </svg>
        <span className='text-white/90 font-medium tracking-wide animate-pulse'>
          Lade Arbeitszeiten...
        </span>
      </div>
    );
  }

  // ==========================================
  // CALCULATIONS (Derived directly during render)
  // ==========================================
  let rawWorked = 0;
  let totalManualGaps = 0;

  const currentMinsNow = now.getHours() * 60 + now.getMinutes();

  const validBlocks = [];
  for (const block of timeBlocks) {
    const inMins = timeToMins(block.login);
    const outMins = timeToMins(block.logout);
    // Even if logout is empty, if login exists, it's a valid active block
    if (inMins !== null) {
      validBlocks.push({ in: inMins, out: outMins, hasOut: outMins !== null });
    }
  }

  for (let i = 0; i < validBlocks.length; i++) {
    const block = validBlocks[i];

    if (block.hasOut && block.out !== null) {
      // Completed block
      let duration = block.out - block.in;
      if (duration < 0) duration += 24 * 60; // Overnight
      rawWorked += duration;
    } else {
      // CHANGED: Active block (real-time tracking)
      let duration = currentMinsNow - block.in;
      if (duration < 0) {
        duration += 24 * 60;
        // Safety heuristic: If duration indicates a 16+ hour shift because the user
        // accidentally typed a *future* time for today, ignore it until time catches up.
        if (duration > 16 * 60) duration = 0;
      }
      rawWorked += duration;
    }

    // Manual gaps calculation
    if (i > 0) {
      const prevBlock = validBlocks[i - 1];
      if (prevBlock.hasOut && prevBlock.out !== null) {
        let gap = block.in - prevBlock.out;
        if (gap < 0) gap += 24 * 60;
        if (gap > 0) totalManualGaps += gap;
      }
    }
  }

  let E = 0; // Effective Work
  let A = 0; // Auto Pauses
  let rem = rawWorked;

  // Waterfall distribution logic
  if (rem <= 360) {
    E = rem;
    rem = 0;
  } else {
    E = 360;
    rem -= 360;

    let currentTotalBreak = totalManualGaps + A;
    const shortfall = Math.max(0, 30 - currentTotalBreak);

    if (rem <= shortfall) {
      A += rem;
      rem = 0;
    } else {
      A += shortfall;
      rem -= shortfall;

      if (rem <= 120) {
        E += rem;
        rem = 0;
      } else {
        E += 120;
        rem -= 120;

        currentTotalBreak = totalManualGaps + A;
        const shortfall2 = Math.max(0, 45 - currentTotalBreak);

        if (rem <= shortfall2) {
          A += rem;
          rem = 0;
        } else {
          A += shortfall2;
          rem -= shortfall2;
          E += rem;
        }
      }
    }
  }

  const effectiveWorked = E;
  const autoPausesAppliedNow = A;

  // Safely parse the target hours, defaulting to 0 if the input is empty or invalid
  const numericTargetHours = Number(targetHours) || 0;
  const targetMins = numericTargetHours * 60;
  const remainingMins = Math.max(0, targetMins - effectiveWorked);

  let projectedRequiredBreak = 0;
  if (targetMins > 480) projectedRequiredBreak = 45;
  else if (targetMins > 360) projectedRequiredBreak = 30;

  const totalAutoPausesForTarget = Math.max(
    0,
    projectedRequiredBreak - totalManualGaps,
  );

  // Total logged-in time required minus what has *already* been worked (including real-time open shifts)
  const totalLoggedInTimeNeeded = targetMins + totalAutoPausesForTarget;
  const remainingLoggedInTime = totalLoggedInTimeNeeded - rawWorked;

  let expectedEndStr = '--:--';
  let isActiveShift = false;

  if (validBlocks.length > 0 && remainingMins > 0 && numericTargetHours > 0) {
    const lastBlock = validBlocks[validBlocks.length - 1];
    let expectedEndMins = 0;

    if (lastBlock.hasOut && lastBlock.out !== null) {
      expectedEndMins = lastBlock.out + remainingLoggedInTime;
    } else {
      // CHANGED: For active shifts, project from the *current* minute since rawWorked includes it
      expectedEndMins = currentMinsNow + remainingLoggedInTime;
      isActiveShift = true;
    }

    const expEndH = Math.floor(expectedEndMins / 60) % 24;
    const expEndM = expectedEndMins % 60;
    expectedEndStr = `${expEndH.toString().padStart(2, '0')}:${expEndM
      .toString()
      .padStart(2, '0')}`;
  } else if (
    remainingMins === 0 &&
    validBlocks.length > 0 &&
    numericTargetHours > 0
  ) {
    expectedEndStr = 'Feierabend! 🎉';
  }

  const workedTimeStr = minsToTimeStr(effectiveWorked);
  const remainingTimeStr = minsToTimeStr(remainingMins);
  const autoBreakStr = `${autoPausesAppliedNow}m`;

  return (
    <div className='min-h-dvh bg-[linear-gradient(115deg,#94a3b8_0%,#cbd5e1_50%,#94a3b8_100%)] flex items-center justify-center p-4 font-sans text-slate-900'>
      <div className='bg-white/85 backdrop-blur-md rounded-3xl shadow-2xl shadow-slate-300/40 p-6 md:p-8 w-full max-w-lg border border-slate-200 animate-in fade-in duration-500'>
        <h1 className='text-2xl font-bold mb-6 text-slate-900 tracking-tight'>
          Soll Arbeitsstunden
        </h1>

        <div className='space-y-6'>
          {/* Configuration Section */}
          <div className='bg-white/70 p-4 rounded-2xl border border-slate-200 shadow-sm'>
            <label className='block text-sm font-semibold text-slate-700 mb-2'>
              🗓️ Geplante Stunden
            </label>
            <input
              type='number'
              step='0.5'
              min='0'
              max='24'
              value={targetHours}
              onChange={(e) => setTargetHours(e.target.value)}
              className='w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none appearance-none'
            />
          </div>

          {/* Dynamic Time Blocks Section */}
          <div>
            {/* Headers row - dynamically sizes to match inputs below */}
            <div
              className={`grid gap-4 mb-2 px-1 ${timeBlocks.length > 1 ? 'grid-cols-[1fr_1fr_40px]' : 'grid-cols-2'}`}
            >
              <label className='block text-sm font-medium text-slate-600 text-center'>
                🕒 Log In
              </label>
              <label className='block text-sm font-medium text-slate-600 text-center'>
                🕒 Log Out
              </label>
              {timeBlocks.length > 1 && <div></div>}
            </div>

            <div className='space-y-3'>
              {timeBlocks.map((block, index) => (
                <div
                  key={index}
                  // CSS Grid fallback is fully robust on older iOS devices
                  className={`grid gap-4 items-center ${
                    timeBlocks.length > 1
                      ? 'grid-cols-[1fr_1fr_40px]'
                      : 'grid-cols-2'
                  }`}
                >
                  {/* Log In Column */}
                  <div className='relative w-full h-full'>
                    <input
                      type='time'
                      value={block.login}
                      onClick={(e) => {
                        if ('showPicker' in HTMLInputElement.prototype) {
                          e.currentTarget.showPicker();
                        }
                      }}
                      onChange={(e) =>
                        updateTimeBlock(index, 'login', e.target.value)
                      }
                      className='w-full text-center relative cursor-pointer appearance-none bg-white border border-slate-300 text-slate-900 rounded-xl px-2 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm 
                      [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:z-0'
                    />
                    {/* Clear Button */}
                    {block.login && (
                      <button
                        onClick={() => updateTimeBlock(index, 'login', '')}
                        className='absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-20 p-1 bg-white rounded-md'
                        aria-label='Clear time'
                      >
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          className='h-4 w-4'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M6 18L18 6M6 6l12 12'
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Log Out Column */}
                  <div className='relative w-full h-full'>
                    <input
                      type='time'
                      value={block.logout}
                      onClick={(e) => {
                        if ('showPicker' in HTMLInputElement.prototype) {
                          e.currentTarget.showPicker();
                        }
                      }}
                      onChange={(e) =>
                        updateTimeBlock(index, 'logout', e.target.value)
                      }
                      className='w-full text-center relative cursor-pointer appearance-none bg-white border border-slate-300 text-slate-900 rounded-xl px-2 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm 
                      [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:z-0'
                    />
                    {/* Clear Button */}
                    {block.logout && (
                      <button
                        onClick={() => updateTimeBlock(index, 'logout', '')}
                        className='absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-20 p-1 bg-white rounded-md'
                        aria-label='Clear time'
                      >
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          className='h-4 w-4'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M6 18L18 6M6 6l12 12'
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Delete Row Button */}
                  {timeBlocks.length > 1 && (
                    <button
                      onClick={() => removeTimeBlock(index)}
                      className='text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center h-10 w-10 mx-auto'
                      aria-label='Remove time block'
                    >
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        className='h-5 w-5'
                        fill='none'
                        viewBox='0 0 24 24'
                        stroke='currentColor'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addTimeBlock}
              className='mt-4 w-full py-3 border-2 border-dashed border-sky-300 text-sky-700 rounded-xl hover:bg-sky-50 hover:border-sky-400 font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z'
                  clipRule='evenodd'
                />
              </svg>
              Weitere Zeit hinzufügen
            </button>
          </div>

          {/* Output Display */}
          <div className='mt-8 space-y-3 pt-4 border-t border-slate-200'>
            {/* Main Primary Output: Always Visible */}
            <div
              className={`flex items-center p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-300/60 relative overflow-hidden ${remainingMins === 0 && numericTargetHours > 0 ? 'justify-center' : 'justify-between'}`}
            >
              {!(remainingMins === 0 && numericTargetHours > 0) && (
                <div className='flex flex-col relative z-10'>
                  <span className='text-sm font-medium text-indigo-100'>
                    Arbeitsende
                  </span>
                  <span className='text-xs text-indigo-200'>
                    {isActiveShift
                      ? 'Läuft: Projektion von Log In'
                      : 'Dynamisch berechnet'}
                  </span>
                </div>
              )}
              <span className='text-3xl font-extrabold tracking-tight relative z-10 '>
                {expectedEndStr}
              </span>
              {isActiveShift && (
                <div className='absolute top-0 right-0 w-full h-full bg-white opacity-5 rounded-2xl'></div>
              )}
            </div>

            {/* Collapse Toggle Button */}
            <button
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className='w-full flex items-center justify-between p-3 mt-2 text-sm font-medium text-slate-600 bg-white/50 hover:bg-white/80 border border-slate-200 rounded-xl transition-all'
            >
              <span>📋 Details zur Berechnung</span>
              <svg
                className={`w-5 h-5 transition-transform duration-300 ${isDetailsOpen ? 'rotate-180' : ''}`}
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            </button>

            {/* Collapsible Content Section */}
            {isDetailsOpen && (
              <div className='space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-300'>
                <div
                  className={`flex justify-between items-center p-4 rounded-2xl border shadow-sm ${remainingMins === 0 && numericTargetHours > 0 ? 'bg-emerald-50/80 border-emerald-100' : 'bg-white border-slate-200'}`}
                >
                  <span
                    className={`text-sm font-medium ${remainingMins === 0 && numericTargetHours > 0 ? 'text-emerald-800' : 'text-slate-600'}`}
                  >
                    Effektive Arbeitszeit
                  </span>
                  <span
                    className={`text-lg font-bold ${remainingMins === 0 && numericTargetHours > 0 ? 'text-emerald-700' : 'text-slate-800'}`}
                  >
                    {workedTimeStr}
                  </span>
                </div>

                <div
                  className={`flex justify-between items-center p-4 rounded-2xl border shadow-sm ${autoPausesAppliedNow === 0 ? 'bg-slate-100/80 border-slate-200' : 'bg-amber-50/80 border-amber-200'}`}
                >
                  <div className='flex flex-col'>
                    <span
                      className={`text-sm font-medium ${autoPausesAppliedNow === 0 ? 'text-slate-500' : 'text-amber-800'}`}
                    >
                      Automatische Pausen
                    </span>
                    <span
                      className={`text-xs ${autoPausesAppliedNow === 0 ? 'text-slate-400' : 'text-amber-600'}`}
                    >
                      (Abgezogen von effektiver Zeit)
                    </span>
                  </div>
                  <span
                    className={`text-lg font-bold ${autoPausesAppliedNow === 0 ? 'text-slate-400' : 'text-amber-700'}`}
                  >
                    {autoBreakStr}
                  </span>
                </div>

                <div
                  className={`flex justify-between items-center p-4 rounded-2xl border shadow-sm ${remainingMins === 0 && numericTargetHours > 0 ? 'bg-slate-100/80 border-slate-200' : 'bg-rose-50/80 border-rose-100'}`}
                >
                  <span
                    className={`text-sm font-medium ${remainingMins === 0 && numericTargetHours > 0 ? 'text-slate-400' : 'text-rose-800'}`}
                  >
                    Verbleibende Zeit
                  </span>
                  <span
                    className={`text-xl font-bold ${remainingMins === 0 && numericTargetHours > 0 ? 'text-slate-400' : 'text-rose-700'}`}
                  >
                    {remainingTimeStr}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
