import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Utile sotto un’intestazione fissa: `{ flex: 1 }` sul `KeyboardAvoidingView`. */
  keyboardAvoidingViewStyle?: StyleProp<ViewStyle>;
};

export function KeyboardSafeScroll({ children, contentContainerStyle, keyboardAvoidingViewStyle }: Props) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, keyboardAvoidingViewStyle]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },
});
