'use client';

import { ThemeToggle } from './ThemeToggle';
import { UpdateNotification } from './UpdateNotification';
import { UserMenu } from './UserMenu';

export default function AccountControls({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      role='group'
      aria-label='个人与外观'
      className={`flex shrink-0 items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900 ${collapsed ? 'flex-col-reverse [&>button:has(span)]:px-0.5' : ''}`}
    >
      <UserMenu />
      <ThemeToggle />
      <UpdateNotification />
    </div>
  );
}
