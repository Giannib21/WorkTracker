import { forwardRef } from 'react';
import { Button, type ButtonProps } from 'react-native-paper';

import { hapticButton } from '../utils/haptics';

type ButtonRef = React.ComponentRef<typeof Button>;

/** Come `Button` di Paper, con feedback aptico su press (solo iOS/Android). Compatibile con `Link asChild`. */
export const HapticButton = forwardRef<ButtonRef, ButtonProps>(function HapticButton({ onPressIn, ...rest }, ref) {
  return (
    <Button
      ref={ref}
      {...rest}
      onPressIn={(e) => {
        hapticButton();
        onPressIn?.(e);
      }}
    />
  );
});
