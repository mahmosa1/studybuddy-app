// app/image-viewer.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ImageViewerScreen() {
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const router = useRouter();

  if (!url) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'white' }}>No image url provided</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      {title ? <Text style={styles.title}>{title}</Text> : null}

      <Image
        source={{ uri: url }}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'black',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: 'white',
    fontSize: 18,
  },
  title: {
    marginTop: 60,
    textAlign: 'center',
    color: 'white',
    fontSize: 16,
  },
  image: {
    flex: 1,
    marginTop: 20,
  },
});
