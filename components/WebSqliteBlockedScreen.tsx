import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

const DOCS_URL = 'https://docs.expo.dev/versions/latest/sdk/sqlite/';

function prefersEnglish(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (navigator.language || '').toLowerCase().startsWith('en');
}

export function WebSqliteBlockedScreen() {
  const en = prefersEnglish();

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.box}>
        <Text variant="headlineSmall" style={styles.title}>
          {en ? 'Web version needs HTTPS' : 'La versione web richiede HTTPS'}
        </Text>
        <Text variant="bodyMedium" style={styles.body}>
          {en
            ? 'The database uses browser storage that is only available on a secure connection (HTTPS or localhost). Opening the app with http:// and an IP address (for example http://10.0.0.1) is not supported and causes errors when saving or exporting.'
            : 'Il database usa lo spazio del browser disponibile solo su connessione sicura (HTTPS o localhost). Aprire l’app con http:// e un indirizzo IP (es. http://10.0.0.1) non è supportato e produce errori in salvataggio o export.'}
        </Text>
        <Text variant="titleSmall" style={styles.sub}>
          {en ? 'What you can do' : 'Cosa fare'}
        </Text>
        <Text variant="bodyMedium" style={styles.list}>
          {en
            ? '• Serve the app over HTTPS on your network (TLS certificate on the dev server or reverse proxy).\n• Or use Expo Go / the native build on the phone.\n• For local testing, use http://localhost:8081 (or the port shown by Expo).'
            : '• Pubblica l’app in HTTPS sulla rete (certificato sul server di sviluppo o reverse proxy).\n• Oppure usa Expo Go / l’app nativa sul telefono.\n• In locale, usa http://localhost:8081 (o la porta indicata da Expo).'}
        </Text>
        <Button mode="contained-tonal" onPress={() => void Linking.openURL(DOCS_URL)} style={styles.btn}>
          {en ? 'Expo SQLite docs' : 'Documentazione Expo SQLite'}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  box: {
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
    gap: 12,
  },
  title: { fontWeight: '700' },
  body: { opacity: 0.92, lineHeight: 22 },
  sub: { marginTop: 4, fontWeight: '600' },
  list: { opacity: 0.88, lineHeight: 22 },
  btn: { alignSelf: 'flex-start', marginTop: 8 },
});
