import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppLocale } from '../context/AppLocaleContext';
import { hapticButton, hapticSelection } from '../utils/haptics';

const BAR_BORDER = 'rgba(15, 23, 42, 0.08)';
const TAB_ICON_SIZE = 24;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function tabIconNameForRoute(routeName: string): IconName {
  switch (routeName) {
    case 'index':
      return 'calendar-month-outline';
    case 'spese':
      return 'cash-multiple';
    case 'profilo':
      return 'account-outline';
    case 'impostazioni':
      return 'cog-outline';
    default:
      return 'circle-small';
  }
}

function TabBarIconFallback({ routeName, color, size }: { routeName: string; color: string; size: number }) {
  return <MaterialCommunityIcons name={tabIconNameForRoute(routeName)} color={color} size={size} />;
}

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { messages } = useAppLocale();

  const bottomPad = Math.max(insets.bottom, 10);

  const onTabPress = (route: (typeof state.routes)[0], index: number) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (state.index !== index && !event.defaultPrevented) {
      navigation.dispatch(CommonActions.navigate({ name: route.name, params: route.params }));
    }
  };

  const labelFallbackForRoute = (routeName: string): string => {
    switch (routeName) {
      case 'index':
        return messages.tabHome;
      case 'spese':
        return messages.tabSpese;
      case 'profilo':
        return messages.tabProfilo;
      case 'impostazioni':
        return messages.tabImpostazioni;
      default:
        return routeName;
    }
  };

  const renderTab = (route: (typeof state.routes)[0], index: number) => {
    const { options } = descriptors[route.key];
    const label =
      (typeof options.tabBarLabel === 'string' ? options.tabBarLabel : null) ??
      (typeof options.title === 'string' ? options.title : null) ??
      labelFallbackForRoute(route.name);

    const isFocused = state.index === index;
    const color = isFocused ? theme.colors.primary : '#6b7280';
    let icon: ReactNode = options.tabBarIcon?.({
      focused: isFocused,
      color,
      size: TAB_ICON_SIZE,
    });
    if (icon == null) {
      icon = <TabBarIconFallback routeName={route.name} color={color} size={TAB_ICON_SIZE} />;
    }

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        onPress={() => onTabPress(route, index)}
        onPressIn={() => {
          hapticSelection();
        }}
        style={styles.tabSlot}
      >
        <View style={styles.tabInner}>
          <View style={styles.iconSlot}>{icon}</View>
          <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingBottom: bottomPad,
          borderTopColor: BAR_BORDER,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={styles.row}>
        {state.routes.slice(0, 2).map((route, i) => renderTab(route, i))}
        <View style={styles.exportSlot} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={messages.export}
            onPressIn={() => {
              hapticButton();
            }}
            onPress={() => router.push('/export')}
            style={[
              styles.exportFab,
              {
                backgroundColor: theme.colors.primary,
                ...(Platform.OS === 'android'
                  ? { elevation: 10 }
                  : {
                      shadowColor: theme.colors.primary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.35,
                      shadowRadius: 8,
                    }),
              },
            ]}
          >
            <MaterialCommunityIcons name="file-export-outline" size={26} color={theme.colors.onPrimary} />
          </Pressable>
          <Text style={[styles.exportLabel, { color: theme.colors.primary }]} numberOfLines={1}>
            {messages.export}
          </Text>
        </View>
        {state.routes.slice(2).map((route, i) => renderTab(route, i + 2))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  tabSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconSlot: {
    minWidth: TAB_ICON_SIZE,
    minHeight: TAB_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  exportSlot: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 2,
    marginTop: -22,
    zIndex: 2,
  },
  exportFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  exportLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
});
