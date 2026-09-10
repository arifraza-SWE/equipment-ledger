import type { ReactNode, SVGProps } from 'react';

/**
 * The project carries no icon library and does not need one: a dozen line icons drawn inline cost
 * nothing to ship and stay consistent with each other. All are on a 24-unit grid so they line up.
 */
interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
}

function Glyph({ size = 16, children, ...svgProps }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...svgProps}
    >
      {children}
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </Glyph>
  );
}

export function ArrowDownLeftIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M17 7 7 17" />
      <path d="M16 17H7V8" />
    </Glyph>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Glyph>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </Glyph>
  );
}

export function FiltersIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </Glyph>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Glyph>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </Glyph>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m6 9 6 6 6-6" />
    </Glyph>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Glyph>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Glyph>
  );
}

export function PackageIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </Glyph>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Glyph>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4.5 21 19H3l9-14.5Z" />
      <path d="M12 10v4M12 16.5v.5" />
    </Glyph>
  );
}

export function WrenchIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M15.5 4.5a4.5 4.5 0 0 0-5.9 5.7L4 15.8V20h4.2l5.6-5.6a4.5 4.5 0 0 0 5.7-5.9l-2.7 2.7-2.6-.6-.6-2.6 2.6-2.7Z" />
    </Glyph>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6 4h12v16l-6-4-6 4V4Z" />
    </Glyph>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 13h4l1.5 3h5L16 13h4" />
      <path d="M5.5 5h13l1.5 8v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5l1.5-8Z" />
    </Glyph>
  );
}
