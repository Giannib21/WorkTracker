import { Stack } from 'expo-router';

/**
 * Stack separato: quando si cambia solo `data`, il native stack tende a usare sempre la stessa
 * animazione “avanti”; qui la spegniamo e lasci solo la slide gestita in `[data].tsx`.
 */
export default function GiornoSegmentLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}
