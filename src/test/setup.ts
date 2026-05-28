import '@testing-library/jest-dom/vitest'

// jsdom não implementa scrollIntoView (usado por SmartSelect ao destacar item).
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
