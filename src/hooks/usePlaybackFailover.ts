'use client';

import { useEffect, useRef } from 'react';

import type { SearchResult } from '@/lib/types';

function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

function episodeNumber(label: string) {
  return /^(?:第|ep(?:isode)?)?0*(\d+)(?:集|话|話)?$/i.exec(normalize(label))?.[1];
}

export function isSamePlaybackEpisode(a: SearchResult, b: SearchResult, index: number) {
  if (a.source === b.source || !b.episodes[index] || b.episodes[index] === a.episodes[index]) return false;
  if (!/^\d{4}$/.test(a.year) || a.year !== b.year || normalize(a.title) !== normalize(b.title)) return false;
  if ((a.tmdb_id && b.tmdb_id && a.tmdb_id !== b.tmdb_id) ||
      (a.douban_id && b.douban_id && a.douban_id !== b.douban_id)) return false;

  const left = a.episodes_titles[index] || '';
  const right = b.episodes_titles[index] || '';
  const number = episodeNumber(left);
  if (number) return number === episodeNumber(right);
  if (left && normalize(left) === normalize(right)) return true;
  // Common film labels describe quality (HD vs 正片), not an episode.
  const filmLabel = /^(?:正片|高清|超清|蓝光|HD|BD|正片HD|HD中字|HD高清|1080P|720P|4K)?$/i;
  return a.episodes.length === 1 && b.episodes.length === 1 &&
    (filmLabel.test(left) || normalize(left) === normalize(a.title)) &&
    (filmLabel.test(right) || normalize(right) === normalize(b.title));
}

interface Options {
  current: SearchResult | null;
  episode: number;
  sources: SearchResult[];
  disabled: boolean;
  fatal: boolean;
  video: () => HTMLVideoElement | undefined;
  rank: (source: SearchResult) => number;
  switchTo: (source: SearchResult, time: number) => void;
  notify: (message: string) => void;
}

export function usePlaybackFailover(options: Options) {
  const latest = useRef(options);
  useEffect(() => { latest.current = options; });
  const generation = useRef(0);

  useEffect(() => {
    let version = -1;
    let route = '';
    let expectedRoute = '';
    let tried = new Set<string>();
    let anchor: number | null = null;
    let lastTime = 0;
    let stalledSince = 0;
    let warned = false;
    let userPaused = false;
    const onPause = (event: Event) => {
      const v = latest.current.video();
      if (v && event.target === v && !v.error && !v.ended && v.readyState >= 2) userPaused = true;
    };
    const onPlay = (event: Event) => {
      if (event.target === latest.current.video()) userPaused = false;
    };
    document.addEventListener('pause', onPause, true);
    document.addEventListener('play', onPlay, true);
    const tick = () => {
      const o = latest.current;
      const video = o.video();
      if (!o.current || o.disabled || !video || document.hidden) {
        stalledSince = 0;
        return;
      }
      const key = JSON.stringify([o.current.source, o.current.id, o.episode]);
      const now = performance.now();
      if (version !== generation.current || key !== route) {
        if (version !== generation.current || key !== expectedRoute) {
          tried = new Set();
          anchor = null;
        }
        userPaused = false;
        route = key;
        expectedRoute = '';
        version = generation.current;
        stalledSince = 0;
        lastTime = video.currentTime;
        warned = false;
      }

      const time = video.currentTime;
      const delta = time - lastTime;
      lastTime = time;
      if (!video.paused && !video.seeking && video.videoWidth && video.readyState >= 2 &&
          delta > 0.05 && delta <= Math.max(4, 3 * video.playbackRate) &&
          (anchor === null || time >= anchor - 2)) {
        if (anchor !== null) o.notify('已切换线路并恢复播放');
        anchor = null;
        stalledSince = 0;
        return;
      }

      // During a switch, canplay may fire more than once while seeking back to the anchor.
      const loading = video.readyState < 2;
      let bufferedAhead = 0;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= time && video.buffered.end(i) >= time) {
          bufferedAhead = video.buffered.end(i) - time;
          break;
        }
      }
      const recoverySeek = anchor !== null && Math.abs(time - anchor) < 2;
      if (userPaused || video.ended || (video.seeking && !recoverySeek) || (!o.fatal && (
        (video.paused && !(loading && time === 0)) || (bufferedAhead > 1.5 && !loading)
      ))) {
        stalledSince = 0;
        return;
      }
      if (!stalledSince) stalledSince = now;
      if (now - stalledSince < (anchor === null ? 8000 : 15000)) return;
      tried.add(o.current.source);
      const next = o.sources
        .filter(s => !tried.has(s.source) && isSamePlaybackEpisode(o.current!, s, o.episode))
        .sort((a, b) => o.rank(b) - o.rank(a))[0];
      if (!next || tried.size >= 3) {
        if (!warned) o.notify('没有更多匹配的备用线路，可在换源列表中手动选择');
        warned = true;
        return;
      }
      anchor = anchor ?? time;
      tried.add(next.source);
      expectedRoute = JSON.stringify([next.source, next.id, o.episode]);
      stalledSince = now;
      o.notify(`播放卡顿，正在尝试${next.source_name}`);
      o.switchTo(next, anchor);
    };
    const timer = window.setInterval(tick, 500);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('pause', onPause, true);
      document.removeEventListener('play', onPlay, true);
    };
  }, []);

  return () => { generation.current++; };
}
