import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export default function Input({ label, error, id, ...props }: InputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}{props.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        className={`w-full h-[38px] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
        {...props}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
