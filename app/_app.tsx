import { appWithTranslation } from './i18n';
import type { AppProps } from 'next/app';

function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default appWithTranslation(App);
