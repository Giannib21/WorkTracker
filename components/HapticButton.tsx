import { forwardRef, useRef } from 'react';
import { Button, type ButtonProps } from 'react-native-paper';

import { hapticButton } from '../utils/haptics';

type ButtonRef = React.ComponentRef<typeof Button>;

/** Come `Button` di Paper, con feedback aptico su press (solo iOS/Android). Compatibile con `Link asChild`. */
export const HapticButton = forwardRef<ButtonRef, ButtonProps>(function HapticButton(
  { onPressIn, onPress, onPressOut, ...rest },
  ref,
) {
  const hapticDone = useRef(false);
  const fireHaptic = () => {
    if (hapticDone.current) return;
    hapticDone.current = true;
    hapticButton();
  };

  return (
    <Button
      ref={ref}
      {...rest}
      onPressIn={(e) => {
        fireHaptic();
        onPressIn?.(e);
      }}
      onPress={(e) => {
        fireHaptic();
        onPress?.(e);
      }}
      onPressOut={(e) => {
        hapticDone.current = false;
        onPressOut?.(e);
      }}
    />
  );
});
