import type { AdminConfig } from './admin.types';
import type { ApiSite } from './config';
import { searchFromApi } from './downstream';
import { searchTMDBMulti } from './tmdb.client';
import { yellowWords } from './yellow';

export async function searchChineseAlias(query: string, sites: ApiSite[], config: AdminConfig) {
  const { TMDBApiKey, TMDBProxy, TMDBReverseProxy, DisableYellowFilter } = config.SiteConfig;
  if (!sites.length || !TMDBApiKey || !/[a-z]/i.test(query) || /[^\x20-\x7e]/.test(query)) return [];

  const normalize = (text: string) => text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = normalize(query);
  const { results } = await searchTMDBMulti(TMDBApiKey, query, TMDBProxy, TMDBReverseProxy);
  const aliases = new Set<string>();
  for (const item of results) {
    if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;
    const original = item.original_title || item.original_name || '';
    const localized = item.title || item.name || '';
    if (normalize(original) === key && /[\u3400-\u9fff]/.test(localized)) aliases.add(localized);
    if (aliases.size === 3) break;
  }
  return Promise.all(sites.map(async site => {
    const found = new Map<string, Awaited<ReturnType<typeof searchFromApi>>[number]>();
    for (const alias of Array.from(aliases)) {
      for (const result of await searchFromApi(site, alias)) {
        if (DisableYellowFilter || !yellowWords.some(word => result.type_name?.includes(word))) {
          found.set(result.id, { ...result, matchedAlias: alias, weight: config.SourceConfig.find(entry => entry.key === site.key)?.weight ?? 0 });
        }
      }
    }
    return { source: site.key, sourceName: site.name, results: Array.from(found.values()) };
  }));
}
