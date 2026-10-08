import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

export default function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
