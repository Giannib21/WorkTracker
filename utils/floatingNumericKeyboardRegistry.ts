export type FloatingNumericLifecycle = {
  onNumericFocusIntent: () => void;
  onNumericBlurIntent: () => void;
};

let impl: FloatingNumericLifecycle | null = null;

export function registerFloatingNumericKeyboardLifecycle(next: FloatingNumericLifecycle | null) {
  impl = next;
}

export function notifyFloatingNumericKeyboardFocus() {
  impl?.onNumericFocusIntent();
}

export function notifyFloatingNumericKeyboardBlur() {
  impl?.onNumericBlurIntent();
}
