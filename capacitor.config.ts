import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jianzhang.tracker',
  appName: '简账',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
