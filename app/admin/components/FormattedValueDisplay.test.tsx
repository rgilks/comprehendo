import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FormattedValueDisplay } from './FormattedValueDisplay';

describe('FormattedValueDisplay', () => {
  const defaultKey = 'testKey';

  it('renders NULL for null value', () => {
    render(<FormattedValueDisplay valueKey={defaultKey} value={null} />);
    expect(screen.getByText('NULL')).toBeInTheDocument();
    expect(screen.getByText('NULL')).toHaveClass('text-gray-500 italic');
  });

  it('renders NULL for undefined value', () => {
    render(<FormattedValueDisplay valueKey={defaultKey} value={undefined} />);
    expect(screen.getByText('NULL')).toBeInTheDocument();
  });

  it('renders True for boolean true value', () => {
    render(<FormattedValueDisplay valueKey={defaultKey} value={true} />);
    expect(screen.getByText('True')).toBeInTheDocument();
  });

  it('renders False for boolean false value', () => {
    render(<FormattedValueDisplay valueKey={defaultKey} value={false} />);
    expect(screen.getByText('False')).toBeInTheDocument();
  });

  it('renders number as string', () => {
    render(<FormattedValueDisplay valueKey={defaultKey} value={123.45} />);
    expect(screen.getByText('123.45')).toBeInTheDocument();
  });

  it('renders date string for created_at key', () => {
    const date = new Date();
    render(<FormattedValueDisplay valueKey="created_at" value={date.toISOString()} />);
    expect(
      screen.getByText(date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' }))
    ).toBeInTheDocument();
  });

  it('renders date string for updated_at key', () => {
    const date = new Date();
    render(<FormattedValueDisplay valueKey="updated_at" value={date.toISOString()} />);
    expect(
      screen.getByText(date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' }))
    ).toBeInTheDocument();
  });

  it('renders original string if date parsing fails', () => {
    const invalidDateString = 'not a date';
    render(<FormattedValueDisplay valueKey="created_at" value={invalidDateString} />);
    expect(screen.getByText(invalidDateString)).toBeInTheDocument();
  });

  it('renders formatted JSON for object string', () => {
    const obj = { a: 1, b: 'test' };
    render(<FormattedValueDisplay valueKey={defaultKey} value={JSON.stringify(obj)} />);
    const preElement = screen.getByTestId('json-object-display');
    expect(preElement).toBeInTheDocument();
    expect(preElement.textContent).toBe(JSON.stringify(obj, null, 2));
  });

  it('renders formatted JSON for array string', () => {
    const arr = [1, 'test', true];
    render(<FormattedValueDisplay valueKey={defaultKey} value={JSON.stringify(arr)} />);
    const preElement = screen.getByTestId('json-object-display');
    expect(preElement).toBeInTheDocument();
    expect(preElement.textContent).toBe(JSON.stringify(arr, null, 2));
  });

  it('renders original string if JSON parsing fails', () => {
    const invalidJsonString = '{ a: 1, '; // Intentionally invalid JSON
    const { container } = render(
      <FormattedValueDisplay valueKey={defaultKey} value={invalidJsonString} />
    );
    // Check that the container's text content matches the invalid string
    expect(container.textContent).toBe(invalidJsonString);
    // Check that the JSON display component is NOT rendered
    expect(screen.queryByTestId('json-object-display')).not.toBeInTheDocument();
  });

  it('renders formatted JSON for direct object value', () => {
    const obj = { nested: { key: 'value' } };
    render(<FormattedValueDisplay valueKey={defaultKey} value={obj} />);
    const preElement = screen.getByTestId('json-object-display');
    expect(preElement).toBeInTheDocument();
    expect(preElement.textContent).toBe(JSON.stringify(obj, null, 2));
  });

  it('renders plain string value', () => {
    const text = 'This is a plain string.';
    render(<FormattedValueDisplay valueKey={defaultKey} value={text} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('renders unsupported type message for unsupported values', () => {
    const symbolValue = Symbol('testSymbol');
    render(<FormattedValueDisplay valueKey={defaultKey} value={symbolValue} />);
    expect(screen.getByText('[Unsupported Type]')).toBeInTheDocument();
  });
});
