'use client';

import { useState, useEffect } from 'react';

type TimeBlock = {
  login: string;
  logout: string;
};

export default function WorkTimeCalculator() {
  const [targetHours, setTargetHours] = useState<number | string>(8);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([
    { login: '', logout: '' },
  ]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  // Real-time minute updates
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load Data
  useEffect(() => {
    const timer = setTimeout(() => {
      const savedData = localStorage.getItem('workTimeTrackerData');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          const savedTimestamp = parsed.timestamp;
          const currentTimestamp = Date.now();
          const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

          if (currentTimestamp - savedTimestamp < TWELVE_HOURS_MS) {
            setTargetHours(parsed.targetHours);
            setTimeBlocks(parsed.timeBlocks);
          } else {
            localStorage.removeItem('workTimeTrackerData');
          }
        } catch (error) {
          console.error('Error parsing local storage data', error);
        }
      }
      setIsLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Save Data
  useEffect(() => {
    if (isLoaded) {
      const dataToSave = {
        targetHours,
        timeBlocks,
        timestamp: Date.now(),
      };
      localStorage.setItem('workTimeTrackerData', JSON.stringify(dataToSave));
    }
  }, [targetHours, timeBlocks, isLoaded]);

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

  const timeToMins = (t: string | null): number | null => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const minsToTimeStr = (m: number): string => {
    const isNegative = m < 0;
    const absM = Math.abs(m);
    const hours = Math.floor(absM / 60);
    const mins = absM % 60;
    return `${isNegative ? '-' : ''}${hours}h ${mins}m`;
  };

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
  // CALCULATIONS: Sequential Engine
  // ==========================================
  const currentMinsNow = now.getHours() * 60 + now.getMinutes();
  const validBlocks = timeBlocks
    .map((block) => ({
      in: timeToMins(block.login),
      out: timeToMins(block.logout),
      hasOut: block.logout !== '',
    }))
    .filter((b) => b.in !== null);

  let effectiveWorked = 0;
  let totalManualGaps = 0;
  let totalBreakRecognized = 0;

  const gapDetails: { afterBlock: number; amount: number }[] = [];
  const autoDetails: { inBlock: number; amount: number }[] = [];

  for (let i = 0; i < validBlocks.length; i++) {
    const block = validBlocks[i];
    let duration = 0;

    if (block.hasOut && block.out !== null) {
      duration = block.out - block.in!;
      if (duration < 0) duration += 24 * 60;
    } else {
      duration = currentMinsNow - block.in!;
      if (duration < 0) {
        duration += 24 * 60;
        if (duration > 16 * 60) duration = 0;
      }
    }

    // Process this block's duration
    let blockAutoDeduction = 0;
    let remainingDuration = duration;

    // 1. Up to 6 hours
    const t1 = Math.max(0, Math.min(remainingDuration, 360 - effectiveWorked));
    effectiveWorked += t1;
    remainingDuration -= t1;

    // 2. Threshold: 6 hours requires 30m break
    if (effectiveWorked === 360 && remainingDuration > 0) {
      const shortfall = Math.max(0, 30 - totalBreakRecognized);
      const deduction = Math.min(remainingDuration, shortfall);
      blockAutoDeduction += deduction;
      totalBreakRecognized += deduction;
      remainingDuration -= deduction;
    }

    // 3. Between 6 and 9 hours
    const t2 = Math.max(0, Math.min(remainingDuration, 540 - effectiveWorked));
    effectiveWorked += t2;
    remainingDuration -= t2;

    // 4. Threshold: 9 hours requires total 45m break
    if (effectiveWorked === 540 && remainingDuration > 0) {
      const shortfall = Math.max(0, 45 - totalBreakRecognized);
      const deduction = Math.min(remainingDuration, shortfall);
      blockAutoDeduction += deduction;
      totalBreakRecognized += deduction;
      remainingDuration -= deduction;
    }

    // 5. Beyond 9 hours
    effectiveWorked += remainingDuration;

    // Log auto deductions for this specific block
    if (blockAutoDeduction > 0) {
      autoDetails.push({ inBlock: i + 1, amount: blockAutoDeduction });
    }

    // Calculate manual gap to the NEXT block
    if (i < validBlocks.length - 1) {
      const nextBlock = validBlocks[i + 1];
      if (block.hasOut && block.out !== null) {
        let gap = nextBlock.in! - block.out;
        if (gap < 0) gap += 24 * 60;
        if (gap > 0) {
          totalManualGaps += gap;
          totalBreakRecognized += gap;
          gapDetails.push({ afterBlock: i + 1, amount: gap });
        }
      }
    }
  }

  // ==========================================
  // FUTURE SIMULATOR & EXPECTED BREAKS
  // ==========================================
  const numericTargetHours = Number(targetHours) || 0;
  const targetMins = numericTargetHours * 60;
  const remainingMins = Math.max(0, targetMins - effectiveWorked);

  // We determine the legal break requirement based on whichever is higher: target vs actual
  let expectedLegalBreak = 0;
  if (effectiveWorked >= 540 || targetMins > 540) expectedLegalBreak = 45;
  else if (effectiveWorked >= 360 || targetMins > 360) expectedLegalBreak = 30;

  // Simulator to find exactly how many MORE minutes we need to hit the target
  let remainingLoggedInTime = 0;
  if (targetMins > effectiveWorked) {
    let simE = effectiveWorked;
    let simBreakRec = totalBreakRecognized;

    while (simE < targetMins) {
      remainingLoggedInTime++;

      if (simE === 360 && simBreakRec < 30) {
        simBreakRec++;
      } else if (simE === 540 && simBreakRec < 45) {
        simBreakRec++;
      } else {
        simE++;
      }
    }
  }

  // Determine End Time String
  let expectedEndStr = '--:--';
  let isActiveShift = false;

  if (validBlocks.length > 0 && remainingMins > 0 && numericTargetHours > 0) {
    const lastBlock = validBlocks[validBlocks.length - 1];
    let expectedEndMins = 0;

    if (lastBlock.hasOut && lastBlock.out !== null) {
      expectedEndMins = lastBlock.out + remainingLoggedInTime;
    } else {
      expectedEndMins = currentMinsNow + remainingLoggedInTime;
      isActiveShift = true;
    }

    const expEndH = Math.floor(expectedEndMins / 60) % 24;
    const expEndM = expectedEndMins % 60;
    expectedEndStr = `${expEndH.toString().padStart(2, '0')}:${expEndM.toString().padStart(2, '0')}`;
  } else if (
    remainingMins === 0 &&
    validBlocks.length > 0 &&
    numericTargetHours > 0
  ) {
    expectedEndStr = 'Feierabend! 🎉';
  }

  const workedTimeStr = minsToTimeStr(effectiveWorked);
  const remainingTimeStr = minsToTimeStr(remainingMins);
  const hasOpenBlock = validBlocks.some((block) => !block.hasOut);
  const shouldMuteRemainingTime =
    numericTargetHours === 0 || (remainingMins === 0 && numericTargetHours > 0);

  // ==========================================
  // BREAK BREAKDOWN LOGIC (Sequential Timeline)
  // ==========================================
  const breakBreakdown = [];
  let accountedBreak = 0;

  // Iterate through the timeline:
  // 1. Check for Auto deductions in the current block
  // 2. Check for Manual gap AFTER the current block
  for (let i = 0; i < validBlocks.length; i++) {
    const blockIndex = i + 1;
    const remainingBreakNeeded = Math.max(
      0,
      expectedLegalBreak - accountedBreak,
    );

    // 1. Auto deductions for this specific block
    const autoForBlock = autoDetails.find((a) => a.inBlock === blockIndex);
    if (autoForBlock && remainingBreakNeeded > 0) {
      const applied = Math.min(autoForBlock.amount, remainingBreakNeeded);
      breakBreakdown.push({
        label: `Abzug in Log-In ${blockIndex}`,
        amount: applied,
        type: 'auto',
      });
      accountedBreak += applied;
    }

    // 2. Manual gaps after this block
    const manualForBlock = gapDetails.find((g) => g.afterBlock === blockIndex);
    if (manualForBlock && accountedBreak < expectedLegalBreak) {
      const needed = expectedLegalBreak - accountedBreak;
      const applied = Math.min(manualForBlock.amount, needed);
      if (applied > 0) {
        breakBreakdown.push({
          label: `Abzug Log-Out Zeit nach Log-In ${blockIndex}`,
          amount: applied,
          type: 'manual',
        });
        accountedBreak += applied;
      }
    }
  }

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
            <div
              className={`grid gap-3 mb-2 px-1 ${timeBlocks.length > 1 ? 'grid-cols-[28px_1fr_1fr_40px]' : 'grid-cols-[28px_1fr_1fr]'} items-center`}
            >
              <div></div>
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
                  className={`grid gap-3 items-center ${timeBlocks.length > 1 ? 'grid-cols-[28px_1fr_1fr_40px]' : 'grid-cols-[28px_1fr_1fr]'}`}
                >
                  {/* Row Badge */}
                  <div className='flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full h-7 w-7 text-xs font-bold shadow-sm'>
                    {index + 1}
                  </div>

                  {/* Log In Column */}
                  <div className='relative w-full h-full'>
                    <input
                      type='time'
                      value={block.login}
                      onClick={(e) => {
                        if ('showPicker' in HTMLInputElement.prototype)
                          e.currentTarget.showPicker();
                      }}
                      onChange={(e) =>
                        updateTimeBlock(index, 'login', e.target.value)
                      }
                      className='w-full text-center relative cursor-pointer appearance-none bg-white border border-slate-300 text-slate-900 rounded-xl px-2 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm 
                      [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:z-0'
                    />
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
                        if ('showPicker' in HTMLInputElement.prototype)
                          e.currentTarget.showPicker();
                      }}
                      onChange={(e) =>
                        updateTimeBlock(index, 'logout', e.target.value)
                      }
                      className='w-full text-center relative cursor-pointer appearance-none bg-white border border-slate-300 text-slate-900 rounded-xl px-2 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm 
                      [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:z-0'
                    />
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

                  {/* Delete Button */}
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
                {/* 1. Effektive Arbeitszeit */}
                <div
                  className={`flex justify-between items-center p-4 rounded-2xl border shadow-sm ${remainingMins === 0 && numericTargetHours > 0 ? 'bg-emerald-50/80 border-emerald-100' : 'bg-white border-slate-200'}`}
                >
                  <span
                    className={`text-sm font-medium ${remainingMins === 0 && numericTargetHours > 0 ? 'text-emerald-800' : 'text-slate-600'}`}
                  >
                    Effektive Arbeitszeit {hasOpenBlock ? '(bisher)' : ''}
                  </span>
                  <span
                    className={`text-lg font-bold ${remainingMins === 0 && numericTargetHours > 0 ? 'text-emerald-700' : 'text-slate-800'}`}
                  >
                    {workedTimeStr}
                  </span>
                </div>

                {/* 2. Erfasste Pausen (Log-Out) - Shows all manual raw gaps */}
                {gapDetails.length > 0 && (
                  <div className='bg-sky-50/80 border border-sky-100 p-4 rounded-2xl shadow-sm space-y-3'>
                    <div className='flex items-center text-sm font-semibold text-sky-800 mb-1'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        className='h-4 w-4 mr-1.5'
                        viewBox='0 0 20 20'
                        fill='currentColor'
                      >
                        <path
                          fillRule='evenodd'
                          d='M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z'
                          clipRule='evenodd'
                        />
                      </svg>
                      Gesamte erfasste Log-Out Zeit
                    </div>
                    {gapDetails.map((gap, i) => (
                      <div
                        key={i}
                        className='flex justify-between items-center text-sm'
                      >
                        <span className='text-sky-700'>
                          Nach Log-In {gap.afterBlock}
                        </span>
                        <span className='font-bold text-sky-700'>
                          {minsToTimeStr(gap.amount)}
                        </span>
                      </div>
                    ))}
                    {gapDetails.length > 1 && (
                      <div className='flex justify-between items-center pt-2 border-t border-sky-200/60'>
                        <span className='text-sm font-medium text-sky-800'>
                          Gesamte Log-Out Pause
                        </span>
                        <span className='font-bold text-sky-800'>
                          {minsToTimeStr(totalManualGaps)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Gesetzliche Pausen (Anrechnung) - Maps out exactly how 30m/45m was fulfilled */}
                <div className='bg-amber-50/80 border border-amber-200 p-4 rounded-2xl shadow-sm space-y-3'>
                  <div className='flex items-center justify-between text-sm font-semibold text-amber-800 mb-1'>
                    <div className='flex items-center'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        className='h-4 w-4 mr-1.5'
                        viewBox='0 0 20 20'
                        fill='currentColor'
                      >
                        <path
                          fillRule='evenodd'
                          d='M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.415-1.414L6.524 5.11a6 6 0 018.368 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z'
                          clipRule='evenodd'
                        />
                      </svg>
                      Anrechnung Gesetzliche Pause
                    </div>
                    {expectedLegalBreak > 0 && (
                      <span className='text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200'>
                        Ziel: {expectedLegalBreak}m
                      </span>
                    )}
                  </div>

                  {breakBreakdown.map((item, i) => (
                    <div
                      key={i}
                      className='flex justify-between items-center text-sm'
                    >
                      <span className='text-amber-700'>{item.label}</span>
                      <span className='font-bold text-amber-700'>
                        {item.amount}m
                      </span>
                    </div>
                  ))}

                  {breakBreakdown.length > 1 && (
                    <div className='flex justify-between items-center pt-2 border-t border-amber-200/60'>
                      <span className='text-sm font-medium text-amber-800'>
                        Gesamte abgezogene Pausenzeit
                      </span>
                      <span className='font-bold text-amber-800'>
                        {accountedBreak}m
                      </span>
                    </div>
                  )}

                  {breakBreakdown.length === 0 && (
                    <div className='flex justify-between items-center text-sm'>
                      <span className='text-amber-700'>
                        Kein Abzug notwendig
                      </span>
                      <span className='font-bold text-amber-700'>0m</span>
                    </div>
                  )}
                </div>

                {/* 4. Verbleibende Zeit */}
                <div
                  className={`flex justify-between items-center p-4 rounded-2xl border shadow-sm ${shouldMuteRemainingTime ? 'bg-slate-100/80 border-slate-200' : 'bg-rose-50/80 border-rose-100'}`}
                >
                  <span
                    className={`text-sm font-medium ${shouldMuteRemainingTime ? 'text-slate-400' : 'text-rose-800'}`}
                  >
                    Verbleibende Zeit
                  </span>
                  <span
                    className={`text-xl font-bold ${shouldMuteRemainingTime ? 'text-slate-400' : 'text-rose-700'}`}
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
