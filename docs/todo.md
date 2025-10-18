# TODO

### **Recently Completed** ✅

- [x] **UI Logic Extraction**: Extracted business logic from UI components to improve testability
  - Created utility files: `translation.ts`, `quiz.ts`, `ui.ts`
  - Refactored components to use extracted utilities
  - Impact: Better separation of concerns, improved maintainability

- [x] **Unit Test Coverage**: Added comprehensive unit tests for extracted logic
  - 57 unit tests covering all utility functions
  - Tests placed in same folders as code they test
  - Impact: Better code quality, easier refactoring

- [x] **E2E Test Fixes**: Fixed all failing end-to-end tests
  - Resolved Next.js image configuration issues
  - Updated test strategies for random good question loading
  - Impact: Reliable automated testing, CI/CD stability

- [x] **Fast Initial Load**: Implemented random good question loading
  - Application now loads pre-existing questions on first visit
  - Falls back to AI generation if no good questions available
  - Impact: Faster initial page load, better user experience

### **Accessibility Enhancements**

- [ ] **Screen Reader Support**: Improve compatibility with screen readers
  - Add proper ARIA labels for interactive elements
  - Ensure proper focus management
  - Impact: Better accessibility compliance

- [ ] **Keyboard Navigation**: Enhance keyboard-only navigation
  - Improve tab order and focus indicators
  - Add keyboard shortcuts for common actions
  - Impact: Better accessibility, power user experience

### **Internationalization**

- [ ] **RTL Language Support**: Add support for right-to-left languages
  - Implement Hebrew and Arabic text direction
  - Adjust UI layout for RTL languages
  - Impact: Broader language support, better UX for RTL users

- [ ] **Language Detection**: Implement automatic language detection
  - Detect user's preferred language from browser settings
  - Impact: Improved user onboarding experience

- [ ] **PWA Features**: Enhance Progressive Web App functionality
