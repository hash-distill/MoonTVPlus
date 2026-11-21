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

export default function SearchQuality({ source }: { source: SearchResult }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [result, setResult] = useState({ url: '', label: '' });
  const raw = source.episodes?.[0] || '';
  const url = /^https?:\/\//i.test(raw) && /\.m3u8(?:[?#]|$)/i.test(raw)
    ? source.proxyMode ? '/api/proxy/vod/m3u8?source=' + encodeURIComponent(source.source) + '&url=' + encodeURIComponent(raw) : raw
    : '';
  useEffect(() => {
    if (!url || !ref.current) return;
    let mounted = true;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      observer.disconnect();
      readQuality(url).then(label => { if (mounted) setResult({ url, label }); });
    });
    observer.observe(ref.current);
    return () => { mounted = false; observer.disconnect(); };
  }, [url]);
  return <span ref={ref} className='text-xs text-gray-500 dark:text-gray-400' title={source.source_name + ' · 首集播放清单最高标称分辨率'}>{source.source_name} · {url && result.url === url ? result.label : url ? '检测画质中' : '画质未知'}</span>;
}
