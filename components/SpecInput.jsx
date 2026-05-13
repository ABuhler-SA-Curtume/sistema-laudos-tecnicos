'use client';

import { useRef } from 'react';

const SYMBOLS = [
  { char: '≥', title: 'Maior ou igual' },
  { char: '≤', title: 'Menor ou igual' },
  { char: '>', title: 'Maior que' },
  { char: '<', title: 'Menor que' },
];

export default function SpecInput({ value, onChange, placeholder = 'Especificação (ex: ≥3.5)', className = '' }) {
  const inputRef = useRef(null);

  function insertChar(char) {
    const input = inputRef.current;
    if (!input) {
      onChange(value + char);
      return;
    }
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const newVal = value.slice(0, start) + char + value.slice(end);
    onChange(newVal);
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + char.length, start + char.length);
    }, 0);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
      <div className="flex gap-1 mt-1.5">
        {SYMBOLS.map(({ char, title }) => (
          <button
            key={char}
            type="button"
            title={title}
            onClick={() => insertChar(char)}
            className="px-2.5 py-1 text-sm font-mono rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white transition select-none"
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
}
