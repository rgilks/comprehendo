import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { renderTableCellValue } from './rendering';

describe('renderTableCellValue', () => {
  it('should render null as italic NULL', () => {
    const { getByText } = render(renderTableCellValue(null));
    expect(getByText('NULL')).toHaveClass('text-gray-500 italic');
  });

  it('should render undefined as italic NULL', () => {
    const { getByText } = render(renderTableCellValue(undefined));
    expect(getByText('NULL')).toHaveClass('text-gray-500 italic');
  });

  it('should render short strings directly', () => {
    const { getByText } = render(renderTableCellValue('Hello'));
    expect(getByText('Hello')).toBeInTheDocument();
  });

  it('should truncate long strings', () => {
    const longString = 'a'.repeat(101);
    const expectedString = `${longString.substring(0, 100)}...`;
    const { getByText } = render(renderTableCellValue(longString));
    expect(getByText(expectedString)).toBeInTheDocument();
  });

  it('should render booleans as strings', () => {
    const { getByText: getByTextTrue } = render(renderTableCellValue(true));
    expect(getByTextTrue('true')).toBeInTheDocument();
    const { getByText: getByTextFalse } = render(renderTableCellValue(false));
    expect(getByTextFalse('false')).toBeInTheDocument();
  });

  it('should render numbers as strings', () => {
    const { getByText: getByTextInt } = render(renderTableCellValue(123));
    expect(getByTextInt('123')).toBeInTheDocument();
    const { getByText: getByTextFloat } = render(renderTableCellValue(123.45));
    expect(getByTextFloat('123.45')).toBeInTheDocument();
  });

  it('should render simple objects as JSON strings', () => {
    const obj = { a: 1, b: 'test' };
    const { getByText } = render(renderTableCellValue(obj));
    expect(getByText(JSON.stringify(obj))).toBeInTheDocument();
  });

  it('should truncate long JSON strings', () => {
    const longObj = { key: 'a'.repeat(100) }; // Stringify will add {"key":""...""}
    const stringified = JSON.stringify(longObj);
    const expectedString = `${stringified.substring(0, 100)}...`;
    const { getByText } = render(renderTableCellValue(longObj));
    expect(getByText(expectedString)).toBeInTheDocument();
  });

  // Note: Directly testing the catch block for JSON.stringify is hard.
  // We trust the fallback mechanism here.

  it('should render function types with a fallback', () => {
    // Functions are not typically expected in JSON-like data for tables
    const func = () => {};
    const { getByText } = render(renderTableCellValue(func));
    expect(getByText('[Unsupported Value]')).toBeInTheDocument();
  });

  it('should render symbol types with a fallback', () => {
    // Symbols are also unsupported
    const sym = Symbol('test');
    const { getByText } = render(renderTableCellValue(sym));
    expect(getByText('[Unsupported Value]')).toBeInTheDocument();
  });
});
