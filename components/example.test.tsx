import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// This is just a sample test to verify the test configuration works
describe('Example test', () => {
  it('demonstrates that the test configuration works', () => {
    // Arrange
    document.body.innerHTML = '<div>Example test content</div>';

    // Act
    const element = screen.getByText('Example test content');

    // Assert
    expect(element).toBeInTheDocument();
  });
});
