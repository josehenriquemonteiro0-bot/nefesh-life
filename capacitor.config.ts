import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App nativa (iPhone) feita com o Capacitor: usa o mesmo código React da versão web.
 * A pasta dist-native é gerada por `npm run build:native` (caminhos relativos, sem service worker).
 * O identificador (appId) ainda pode mudar até ao primeiro envio para a App Store.
 */
const config: CapacitorConfig = {
  appId: 'com.nefesh.life',
  appName: 'NEFESH Life',
  webDir: 'dist-native',
  backgroundColor: '#060d0e',
  ios: {
    // a app já trata das margens do ecrã (viewport-fit=cover + safe-area-inset no CSS)
    contentInset: 'never',
    backgroundColor: '#060d0e',
    // vídeos dos exercícios e meditação a tocar dentro da app, sem abrir o ecrã inteiro
    allowsLinkPreview: false,
  },
};

export default config;
