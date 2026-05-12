'use client';

import { useState } from 'react';

// 1. Define the TypeScript type for our time blocks
type TimeBlock = {
  login: string;
  logout: string;
};

export default function WorkTimeCalculator() {
  // Configuration - allow string so the user can completely clear the input
  const [targetHours, setTargetHours] = useState<number | string>(8);

  // State for the collapsible details section
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  // Dynamic Array for Time Blocks
  // Initial logout is empty so it calculates the end time automatically
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([
    { login: '08:00', logout: '' },
  ]);

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
  // CALCULATIONS (Derived directly during render)
  // ==========================================

  let rawWorked = 0;
  let totalManualGaps = 0;

  const validBlocks = [];
  for (const block of timeBlocks) {
    const inMins = timeToMins(block.login);
    const outMins = timeToMins(block.logout);
    if (inMins !== null) {
      validBlocks.push({ in: inMins, out: outMins, hasOut: outMins !== null });
    }
  }

  for (let i = 0; i < validBlocks.length; i++) {
    const block = validBlocks[i];
    if (block.hasOut && block.out !== null) {
      let duration = block.out - block.in;
      if (duration < 0) duration += 24 * 60;
      rawWorked += duration;
    }
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
      expectedEndMins = lastBlock.in + remainingLoggedInTime;
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
      <div className='bg-white/85 backdrop-blur-md rounded-3xl shadow-2xl shadow-slate-300/40 p-6 md:p-8 w-full max-w-lg border border-slate-200'>
        <h1 className='text-2xl font-bold mb-6 text-slate-900 tracking-tight'>
          Soll Arbeitsstunden
        </h1>

        <div className='space-y-6'>
          {/* Configuration Section */}
          <div className='bg-white/70 p-4 rounded-2xl border border-slate-200 shadow-sm'>
            <label className='block text-sm font-semibold text-slate-700 mb-2'>
              Zielarbeitsstunden
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
                Log In
              </label>
              <label className='block text-sm font-medium text-slate-600 text-center'>
                Log Out
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
            <div className='flex justify-between items-center p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-300/60 relative overflow-hidden'>
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
              <span>Details zur Berechnung</span>
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
                <div className='flex justify-between items-center p-4 bg-white border border-slate-200 shadow-sm rounded-2xl'>
                  <span className='text-sm font-medium text-slate-600'>
                    Effektive Arbeitszeit
                  </span>
                  <span className='text-lg font-bold text-slate-800'>
                    {workedTimeStr}
                  </span>
                </div>

                <div className='flex justify-between items-center p-4 bg-rose-50/80 rounded-2xl border border-rose-100 shadow-sm'>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium text-rose-800'>
                      Automatische Pausen
                    </span>
                    <span className='text-xs text-rose-600'>
                      (Abgezogen von effektiver Zeit)
                    </span>
                  </div>
                  <span className='text-lg font-bold text-rose-700'>
                    {autoBreakStr}
                  </span>
                </div>

                <div className='flex justify-between items-center p-4 bg-emerald-50/80 rounded-2xl border border-emerald-100 shadow-sm'>
                  <span className='text-sm font-medium text-emerald-800'>
                    Verbleibende Zeit
                  </span>
                  <span className='text-xl font-bold text-emerald-700'>
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
