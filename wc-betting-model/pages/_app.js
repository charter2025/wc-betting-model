// pages/_app.js
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>WC 2026 Quant Model</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="World Cup 2026 Quantitative Betting Model — Poisson + Monte Carlo + AI edge analysis, refreshed every 24 hours." />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html { background: #06080f; }
          body { background: #06080f; -webkit-font-smoothing: antialiased; }
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: #0d1220; }
          ::-webkit-scrollbar-thumb { background: #1a2640; border-radius: 2px; }
          button:focus { outline: none; }
          a { color: inherit; text-decoration: none; }
        `}</style>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
