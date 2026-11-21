'use client';

import { useEffect, useRef, useState } from 'react';
import type { SearchResult } from '@/lib/types';

const cache = new Map<string, { label: string; until: number }>();
const pending = new Map<string, Promise<string>>();
const queue: Array<() => void> = [];
let active = 0;

async function readQuality(url: string) {
  const cached = cache.get(url);
  if (cached && cached.until > Date.now()) return cached.label;
  const running = pending.get(url);
  if (running) return running;
  const task = (async () => {
    if (active >= 3) await new Promise<void>(resolve => queue.push(resolve));
    active++;
    let label = '画质未知';
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), credentials: 'same-origin' });
      if (!response.ok) return label;
      const manifest = await response.text();
      if (!manifest.trimStart().startsWith('#EXTM3U')) return label;
      const heights = Array.from(manifest.matchAll(/^#EXT-X-STREAM-INF:.*?RESOLUTION=\d+x(\d+)/gmi), m => Number(m[1]));
      if (heights.length) label = Math.max(...heights) + 'p';
      return label;
    } catch {
      return label;
    } finally {
      if (cache.size >= 512) cache.delete(cache.keys().next().value!);
      cache.set(url, { label, until: Date.now() + (label === '画质未知' ? 60000 : 600000) });
      active--;
      queue.shift()?.();
      pending.delete(url);
    }
  })();
  pending.set(url, task);
  return task;
}

type Source = Pick<SearchResult, 'episodes' | 'proxyMode' | 'source' | 'source_name'>;

export default function SearchQuality({ sources }: { sources: Source[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [result, setResult] = useState({ key: '', text: '' });
  // 稳定的值标识避免搜索结果分批刷新时重启相同的探测。
  const key = JSON.stringify(sources.map(source => {
    const raw = source.episodes?.[0] || '';
    const url = /^https?:\/\//i.test(raw) && /\.m3u8(?:[?#]|$)/i.test(raw)
      ? source.proxyMode ? '/api/proxy/vod/m3u8?source=' + encodeURIComponent(source.source) + '&url=' + encodeURIComponent(raw) : raw
      : '';
    return [source.source_name, url];
  }));
  useEffect(() => {
    if (!ref.current) return;
    let mounted = true;
    const inspect = async () => {
      const entries: [string, string][] = JSON.parse(key);
      for (const [name, url] of entries) {
        if (!mounted) return;
        if (!url) continue;
        const label = await readQuality(url);
        if (!mounted) return;
        if (label !== '画质未知') {
          setResult({ key, text: name + ' · ' + label });
          return;
        }
      }
      if (mounted) setResult({ key, text: '画质未知' });
    };
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      observer.disconnect();
      void inspect();
    });
    observer.observe(ref.current);
    return () => { mounted = false; observer.disconnect(); };
  }, [key]);
  return <span ref={ref} className='text-xs text-gray-500 dark:text-gray-400' title='首集播放清单最高标称分辨率'>{result.key === key ? result.text : '检测画质中'}</span>;
}
