/* Phase 1 smoke page: a server component that renders live markets through the
   ported data layer. Its job is to prove the migration works end to end — the
   real terminal UI is rebuilt in phase 3. */
import { memeMarkets, rwaMarkets, featuredMarket } from '@/lib/market-data';
import { featuredAddress } from '@/lib/featured';
import type { Market } from '@/lib/types';

// Live prices: re-render at most once a minute, matching the static site's
// refresh interval instead of caching the build output forever.
export const revalidate = 60;

async function loadMarkets(): Promise<{ markets: Market[]; errors: string[] }> {
  const [meme, rwa] = await Promise.allSettled([memeMarkets(), rwaMarkets()]);
  const errors: string[] = [];
  if (meme.status === 'rejected') errors.push(`meme: ${String(meme.reason?.message ?? meme.reason)}`);
  if (rwa.status === 'rejected') errors.push(`rwa: ${String(rwa.reason?.message ?? rwa.reason)}`);

  const markets = [
    ...(meme.status === 'fulfilled' ? meme.value : []),
    ...(rwa.status === 'fulfilled' ? rwa.value : []),
  ];

  try {
    const featured = await featuredMarket(featuredAddress() ?? undefined);
    if (featured) {
      return { markets: [featured, ...markets.filter(m => m.id !== featured.id)], errors };
    }
  } catch {
    /* featured token not configured or not indexed yet */
  }
  return { markets, errors };
}

function Change({ value }: { value: number }) {
  const sign = value > 0 ? '+' : '';
  return (
    <span className={value >= 0 ? 'up' : 'down'}>
      {sign}
      {value.toFixed(2)}%
    </span>
  );
}

function MarketTable({ rows, caption }: { rows: Market[]; caption: string }) {
  if (!rows.length) return null;
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Market</th>
          <th scope="col">Price</th>
          <th scope="col">24h</th>
          <th scope="col">Volume</th>
          <th scope="col">Liquidity</th>
          <th scope="col">Turbo Score</th>
          <th scope="col">Age</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(market => (
          <tr key={`${market.kind}:${market.id}`}>
            <td>
              <span className="sym">{market.symbol}</span>{' '}
              <span className="chain">{market.source}</span>
            </td>
            <td>${market.price}</td>
            <td><Change value={market.change} /></td>
            <td>${market.volume}</td>
            <td>{market.liquidityRaw ? `$${market.liquidity}` : '—'}</td>
            <td>{market.score ?? '—'}</td>
            <td>{market.ageLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function Home() {
  const { markets, errors } = await loadMarkets();
  const meme = markets.filter(m => m.kind === 'meme');
  const rwa = markets.filter(m => m.kind === 'rwa');

  return (
    <main>
      <h1>TurboPad</h1>
      <p className="sub">
        Terminal &amp; launchpad on Robinhood Chain · rendered on the server from live market data
      </p>

      <p className="notice">
        Phase 1 of the Next.js migration. The data, chain, swap and deploy layers are ported and
        running; the full terminal UI is still served by the static build in <code>Web/dist</code>.
      </p>

      {errors.length > 0 && (
        <p className="error">Some sources failed: {errors.join(' · ')}</p>
      )}

      {markets.length === 0 && errors.length === 0 && (
        <p className="error">No markets returned.</p>
      )}

      <MarketTable rows={meme} caption={`Meme markets — ${meme.length} live, Turbo Score high to low`} />
      <MarketTable rows={rwa} caption={`RWA basket — ${rwa.length} of 8 CoinGecko ids resolved`} />
    </main>
  );
}
