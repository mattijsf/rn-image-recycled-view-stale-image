/**
 * Reproducer: iOS (Fabric) <Image> shows another Image's picture after its
 * native view is recycled.
 *
 * Each round mounts a grid of "old" images (red, 96x96, unique URLs so they
 * are never cached). As soon as the first one has loaded, all of them are
 * replaced with "new" images (green, 64x64, one URL that is prefetched and
 * cached). The other red requests were started at the same time, so they
 * finish around the swap.
 *
 * Old and new are different <Image> elements (different keys), so the old
 * native views are deleted and the new ones are created in the same commit.
 * Deletes run before creates, so the new images reuse the recycled views.
 *
 * Expected: during the green phase every tile is green.
 * Bug: some green tiles show a red image. onLoad on those tiles reports the
 * red image's size (96) even though their source is the 64x64 green image.
 *
 * A run stops by itself after ROUNDS rounds (about a minute) and leaves the
 * last round's green grid on screen.
 *
 * @format
 */

import { useEffect, useRef, useState } from 'react';
import {
  Image,
  type ImageLoadEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const TILES = 64;
const ROUNDS = 50;
const NEW_URI = 'https://placehold.co/64x64/2e7d32/ffffff/png?text=new';
const oldUri = (run: number, round: number, i: number) =>
  `https://placehold.co/96x96/c62828/ffffff/png?text=old+${i}&r=${run}-${round}`;

type Stats = { rounds: number; roundsWithBug: number; wrong: number };
const EMPTY_STATS: Stats = { rounds: 0, roundsWithBug: 0, wrong: 0 };

function App() {
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState(0);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<'old' | 'new'>('old');
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const wrongThisRound = useRef(0);

  useEffect(() => {
    // Promise.resolve: the jest mock of Image.prefetch returns undefined
    Promise.resolve(Image.prefetch(NEW_URI))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!running) {
      return undefined;
    }
    if (phase === 'old') {
      // fallback in case the red images do not load
      const fallback = setTimeout(() => setPhase('new'), 4000);
      return () => clearTimeout(fallback);
    }
    const timer = setTimeout(() => {
      const hit = wrongThisRound.current > 0;
      wrongThisRound.current = 0;
      setStats(s => ({
        ...s,
        rounds: s.rounds + 1,
        roundsWithBug: s.roundsWithBug + (hit ? 1 : 0),
      }));
      if (round + 1 >= ROUNDS) {
        setRunning(false);
        return;
      }
      setRound(round + 1);
      setPhase('old');
    }, 600);
    return () => clearTimeout(timer);
  }, [running, phase, round]);

  const start = () => {
    setStats(EMPTY_STATS);
    wrongThisRound.current = 0;
    setRun(r => r + 1);
    setRound(0);
    setPhase('old');
    setRunning(true);
  };

  const onOldLoad = () => {
    if (running && phase === 'old') {
      setPhase('new');
    }
  };

  const onNewLoad = (e: ImageLoadEvent) => {
    if (e.nativeEvent.source.width !== 64) {
      wrongThisRound.current += 1;
      setStats(s => ({ ...s, wrong: s.wrong + 1 }));
    }
  };

  // after a run the last (green) round stays on screen, so red tiles can be inspected
  const tiles = [];
  if (run > 0) {
    for (let i = 0; i < TILES; i++) {
      tiles.push(
        phase === 'old' ? (
          <Image
            key={`old-${run}-${round}-${i}`}
            source={{ uri: oldUri(run, round, i) }}
            style={styles.tile}
            onLoad={onOldLoad}
          />
        ) : (
          <Image
            key={`new-${run}-${round}-${i}`}
            source={{ uri: NEW_URI }}
            style={styles.tile}
            onLoad={onNewLoad}
          />
        ),
      );
    }
  }

  const rate = stats.rounds
    ? Math.round((100 * stats.roundsWithBug) / stats.rounds)
    : 0;
  const disabled = !ready || running;

  return (
    <View style={styles.screen}>
      <Text style={styles.stats}>
        rounds {stats.rounds}/{ROUNDS} · rounds with a wrong image{' '}
        {stats.roundsWithBug} ({rate}%) · wrong images {stats.wrong}
      </Text>
      <Pressable
        disabled={disabled}
        onPress={start}
        style={[styles.button, disabled && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>
          {!ready ? 'Loading…' : running ? 'Running…' : 'Start'}
        </Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.grid}>{tiles}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    alignItems: 'center',
  },
  stats: {
    fontSize: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  button: {
    backgroundColor: '#1f5eff',
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 15 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingBottom: 40,
  },
  tile: { width: 36, height: 36, backgroundColor: '#eee' },
});

export default App;
