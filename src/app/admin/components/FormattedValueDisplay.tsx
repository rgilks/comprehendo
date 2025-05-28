import React from 'react';

interface FormattedValueDisplayProps {
  valueKey: string;
  value: unknown;
}

const JsonObjectDisplay = ({ data }: { data: unknown }) => (
  <pre
    data-testid="json-object-display"
    className="bg-gray-100 p-2 rounded overflow-auto text-sm whitespace-pre-wrap break-words"
  >
    {JSON.stringify(data, null, 2)}
  </pre>
);

export const FormattedValueDisplay = ({ valueKey: key, value }: FormattedValueDisplayProps) => {
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
    } catch (error) {
      console.warn(`Failed to parse date string '${value}' for key '${key}':`, error);
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
        return <JsonObjectDisplay data={parsedJson} />;
      } catch (error) {
        console.warn(`Failed to parse JSON string '${value}' for key '${key}':`, error);
      }
    }
    return value;
  }

  if (typeof value === 'object') {
    return <JsonObjectDisplay data={value} />;
  }

  return '[Unsupported Type]';
};
