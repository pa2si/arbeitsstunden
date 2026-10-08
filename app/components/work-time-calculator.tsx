'use client';

import { useMemo, useState } from 'react';
import LoadingScreen from './loading-screen';
import TimeBlockInputs from './time-block-inputs';
import WorkTimeResults from './work-time-results';
import calculateWorkTime from '../lib/work-time-calculator';
import useIsClient from '../hooks/use-is-client';
import useWorkTimeTracker from '../hooks/use-work-time-tracker';

function WorkTimeCalculatorContent() {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const {
    targetHours,
    setTargetHours,
    timeBlocks,
    addTimeBlock,
    removeTimeBlock,
    updateTimeBlock,
    now,
  } = useWorkTimeTracker();

  const calculation = useMemo(
    () => calculateWorkTime(timeBlocks, targetHours, now),
    [now, targetHours, timeBlocks],
  );

  return (
    <main className='min-h-dvh bg-[linear-gradient(115deg,#94a3b8_0%,#cbd5e1_50%,#94a3b8_100%)] flex items-center justify-center p-4 font-sans text-slate-900'>
      <section className='bg-white/85 backdrop-blur-md rounded-3xl shadow-2xl shadow-slate-300/40 p-6 md:p-8 w-full max-w-lg border border-slate-200 animate-in fade-in duration-500'>
        <h1 className='text-2xl font-bold mb-6 text-slate-900 tracking-tight'>
          Soll Arbeitsstunden
        </h1>

        <div className='space-y-6'>
          <TimeBlockInputs
            targetHours={targetHours}
            timeBlocks={timeBlocks}
            onTargetHoursChange={setTargetHours}
            onAddTimeBlock={addTimeBlock}
            onRemoveTimeBlock={removeTimeBlock}
            onUpdateTimeBlock={updateTimeBlock}
          />
          <WorkTimeResults
            calculation={calculation}
            isDetailsOpen={isDetailsOpen}
            onToggleDetails={() => setIsDetailsOpen((isOpen) => !isOpen)}
          />
        </div>
      </section>
    </main>
  );
}

export default function WorkTimeCalculator() {
  const isClient = useIsClient();

  // localStorage only exists in the browser, so render the stateful content client-side only.
  return isClient ? <WorkTimeCalculatorContent /> : <LoadingScreen />;
}
