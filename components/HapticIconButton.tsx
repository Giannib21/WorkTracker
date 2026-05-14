import { forwardRef, useRef } from 'react';
import { IconButton, type IconButtonProps } from 'react-native-paper';

import { hapticButton, hapticSelection } from '../utils/haptics';

type IconButtonRef = React.ComponentRef<typeof IconButton>;

type Props = IconButtonProps & {
  /** `light`: navigazione / controlli secondari (es. frecce mese). Default: pulsante più marcato. */
  haptic?: 'button' | 'light';
};

/** Come `IconButton` di Paper, con feedback aptico su press (solo iOS/Android). */
export const HapticIconButton = forwardRef<IconButtonRef, Props>(function HapticIconButton(
  { haptic = 'button', onPressIn, onPress, onPressOut, ...rest },
  ref,
) {
  const hapticDone = useRef(false);
  const fireHaptic = () => {
    if (hapticDone.current) return;
    hapticDone.current = true;
    if (haptic === 'light') {
      hapticSelection();
    } else {
      hapticButton();
    }
  };

  return (
    <IconButton
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
