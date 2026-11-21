import 'server-only';

import type { WatchRoomConfig } from '@/types/watch-room';

export function getPublicWatchRoomConfig(): Pick<
  WatchRoomConfig, 'enabled' | 'serverType' | 'externalServerUrl'
> {
  if (process.env.MOONTV_LITE === 'true') {
    return { enabled: false, serverType: 'external' };
  }

  return {
    enabled: process.env.WATCH_ROOM_ENABLED === 'true',
    serverType: process.env.WATCH_ROOM_SERVER_TYPE === 'external' ? 'external' : 'internal',
    externalServerUrl: process.env.WATCH_ROOM_EXTERNAL_SERVER_URL,
  };
}
