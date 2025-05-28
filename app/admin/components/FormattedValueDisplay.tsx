import React from 'react';

interface FormattedValueDisplayProps {
  valueKey: string;
  value: unknown;
}

const JsonObjectDisplay = ({ data }: { data: unknown }) => (
  <pre
    data-testid="json-object-display"
    className="bg-gray-900 text-gray-300 p-3 rounded-md overflow-auto text-sm whitespace-pre-wrap break-words max-h-96 ring-1 ring-gray-700"
  >
    {JSON.stringify(data, null, 2)}
  </pre>
);

export const FormattedValueDisplay = ({ valueKey: key, value }: FormattedValueDisplayProps) => {
  if (value === null || value === undefined) {
    return <span className="text-gray-500 italic">NULL</span>;
  }

  if (typeof value === 'boolean') {
    return value ? (
      <span className="text-green-400 font-medium">True</span>
    ) : (
      <span className="text-red-400 font-medium">False</span>
    );
  }

  if (typeof value === 'number') {
    return <span className="text-blue-400">{String(value)}</span>;
  }

  if (typeof value === 'string' && (key.endsWith('_at') || key.endsWith('Date'))) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return (
          <span className="text-purple-400">
            {date.toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })}
          </span>
        );
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
        const parsedJson = JSON.parse(trimmedValue);
        return <JsonObjectDisplay data={parsedJson} />;
      } catch (error) {
        // Fall through to render as plain string if JSON parsing fails
        console.warn(`Attempted to parse JSON string for key '${key}' but failed:`, error);
      }
    }
    // For regular strings, especially potentially long ones like 'content'
    if (value.length > 200 || key === 'content') {
      // Heuristic for long content or specific keys
      return (
        <pre className="text-gray-300 p-2 rounded-md overflow-auto text-sm whitespace-pre-wrap break-words max-h-96 ring-1 ring-gray-700 bg-gray-900">
          {value}
        </pre>
      );
    }
    return <span className="text-gray-100">{value}</span>;
  }

  if (typeof value === 'object') {
    return <JsonObjectDisplay data={value} />;
  }

  return <span className="text-gray-500">[Unsupported Type]</span>;
};
