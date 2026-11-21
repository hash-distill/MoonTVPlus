'use client';

import { ThemeToggle } from './ThemeToggle';
import { UpdateNotification } from './UpdateNotification';
import { UserMenu } from './UserMenu';

export default function AccountControls({ collapsed = false }: { collapsed?: boolean }) {
  const layout = collapsed
    ? 'min-h-[3rem] flex-col justify-center gap-1 text-xs'
    : 'min-h-[2.25rem] gap-2 px-2 text-xs md:min-h-10 md:gap-3 md:px-4 md:text-sm';
  const actionClass = `flex w-full items-center whitespace-nowrap rounded-lg text-gray-700 transition-colors hover:bg-gray-100 hover:text-green-600 focus-visible:outline-green-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-green-400 ${layout}`;

  return (
    <div
      role='group'
      aria-label='个人与外观'
      className='flex shrink-0 flex-col gap-1'
    >
      <UserMenu className={actionClass} />
      <ThemeToggle className={actionClass} showLabel />
      <UpdateNotification />
    </div>
  );
}
