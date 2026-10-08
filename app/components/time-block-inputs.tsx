'use client';

import type { TimeBlock } from '../lib/work-time-types';

type TimeBlockInputsProps = {
  targetHours: number | string;
  timeBlocks: TimeBlock[];
  onTargetHoursChange: (value: string) => void;
  onAddTimeBlock: () => void;
  onRemoveTimeBlock: (index: number) => void;
  onUpdateTimeBlock: (
    index: number,
    field: keyof TimeBlock,
    value: string,
  ) => void;
};

function TimeInput({
  value,
  label,
  onChange,
  onClear,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className='relative w-full h-full'>
      <input
        type='time'
        value={value}
        aria-label={label}
        onClick={(event) => {
          if (typeof event.currentTarget.showPicker === 'function') {
            event.currentTarget.showPicker();
          }
        }}
        onChange={(event) => onChange(event.target.value)}
        className='w-full text-center relative cursor-pointer appearance-none bg-white border border-slate-300 text-slate-900 rounded-xl px-2 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:z-0'
      />
      {value && (
        <button
          type='button'
          onClick={onClear}
          className='absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-20 p-1 bg-white rounded-md'
          aria-label={`Clear ${label.toLowerCase()}`}
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
  );
}

export default function TimeBlockInputs({
  targetHours,
  timeBlocks,
  onTargetHoursChange,
  onAddTimeBlock,
  onRemoveTimeBlock,
  onUpdateTimeBlock,
}: TimeBlockInputsProps) {
  const hasMultipleBlocks = timeBlocks.length > 1;
  const gridColumns = hasMultipleBlocks
    ? 'grid-cols-[28px_1fr_1fr_40px]'
    : 'grid-cols-[28px_1fr_1fr]';

  return (
    <>
      <div className='bg-white/70 p-4 rounded-2xl border border-slate-200 shadow-sm'>
        <label
          htmlFor='target-hours'
          className='block text-sm font-semibold text-slate-700 mb-2'
        >
          🗓️ Geplante Stunden
        </label>
        <input
          id='target-hours'
          type='number'
          step='0.5'
          min='0'
          max='24'
          value={targetHours}
          onChange={(event) => onTargetHoursChange(event.target.value)}
          className='w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none appearance-none'
        />
      </div>

      <div>
        <div
          className={`grid gap-3 mb-2 px-1 ${gridColumns} items-center`}
        >
          <div />
          <label className='block text-sm font-medium text-slate-600 text-center'>
            🕒 Log In
          </label>
          <label className='block text-sm font-medium text-slate-600 text-center'>
            🕒 Log Out
          </label>
          {hasMultipleBlocks && <div />}
        </div>

        <div className='space-y-3'>
          {timeBlocks.map((block, index) => (
            <div
              key={index}
              className={`grid gap-3 items-center ${gridColumns}`}
            >
              <div className='flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full h-7 w-7 text-xs font-bold shadow-sm'>
                {index + 1}
              </div>
              <TimeInput
                value={block.login}
                label={`Log In ${index + 1}`}
                onChange={(value) =>
                  onUpdateTimeBlock(index, 'login', value)
                }
                onClear={() => onUpdateTimeBlock(index, 'login', '')}
              />
              <TimeInput
                value={block.logout}
                label={`Log Out ${index + 1}`}
                onChange={(value) =>
                  onUpdateTimeBlock(index, 'logout', value)
                }
                onClear={() => onUpdateTimeBlock(index, 'logout', '')}
              />
              {hasMultipleBlocks && (
                <button
                  type='button'
                  onClick={() => onRemoveTimeBlock(index)}
                  className='text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center h-10 w-10 mx-auto'
                  aria-label={`Remove time block ${index + 1}`}
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
          type='button'
          onClick={onAddTimeBlock}
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
    </>
  );
}
