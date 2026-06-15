export function TonLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={className} aria-hidden="true">
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path
        d="M17.7 19.4C18.2 18.5 19.1 18 20.1 18H35.9C36.9 18 37.8 18.5 38.3 19.4C38.8 20.3 38.7 21.3 38.1 22.1L29.9 36.4C29.5 37.1 28.8 37.5 28 37.5C27.2 37.5 26.5 37.1 26.1 36.4L17.9 22.1C17.3 21.3 17.2 20.3 17.7 19.4Z"
        fill="white"
      />
      <path d="M20.4 21.1H26.5V31.5L20.4 21.1ZM29.5 21.1H35.6L29.5 31.5V21.1Z" fill="#0098EA" />
    </svg>
  );
}

export function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M4 10.8L12 4l8 6.8V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.2Z" stroke={active ? '#0098EA' : 'currentColor'} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function RocketIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M14.5 4.5C17.2 3.5 20 4 20 4s.5 2.8-.5 5.5c-.9 2.5-3 5-6.6 7.2L8 11.8c2.2-3.6 4.7-5.7 6.5-7.3Z" stroke={active ? '#0098EA' : 'currentColor'} strokeWidth="2" strokeLinejoin="round" />
      <path d="M8.2 12.2L5.5 12 4 13.5l3.2 1.2M11.8 15.8l.2 2.7L10.5 20l-1.2-3.2M15 9h.01" stroke={active ? '#0098EA' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M10.8 18.1a7.3 7.3 0 1 1 0-14.6 7.3 7.3 0 0 1 0 14.6ZM16.2 16.2 21 21" stroke={active ? '#0098EA' : 'currentColor'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ProfileIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0" stroke={active ? '#0098EA' : 'currentColor'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
