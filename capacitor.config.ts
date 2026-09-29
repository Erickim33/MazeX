import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mazex.game',
  appName: 'MazeX',
  webDir: 'capacitor-web',
  server: {
    url: 'https://tanstack-start-ts-downloads-mazex-game-source-v2.mazex-game.workers.dev',
    cleartext: false
  }
};

export default config;
