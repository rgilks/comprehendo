import React from 'react';

interface FormattedValueDisplayProps {
  valueKey: string;
  value: unknown;
}

export const FormattedValueDisplay: React.FC<FormattedValueDisplayProps> = ({
  valueKey: key,
  value,
}) => {
  if (value === null || value === undefined) {
    return <span className="text-gray-500 italic">NULL</span>;
  }

  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string' && (key === 'created_at' || key === 'updated_at')) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'medium',
        });
      }
    } catch {
      // Intentionally empty
    }
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (
      (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
      (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'))
    ) {
      try {
        const parsedJson = JSON.parse(trimmedValue) as Record<string, unknown>;
        return (
          <pre className="bg-gray-100 p-2 rounded overflow-auto text-sm whitespace-pre-wrap break-words">
            {JSON.stringify(parsedJson, null, 2)}
          </pre>
        );
      } catch {
        // Intentionally empty
      }
    }
    return value;
  }

  if (typeof value === 'object') {
    return (
      <pre className="bg-gray-100 p-2 rounded overflow-auto text-sm whitespace-pre-wrap break-words">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  // Fallback for other types
  return '[Unsupported Value]';
};
