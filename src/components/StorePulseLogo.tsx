interface StorePulseLogoProps {
  className?: string;
}

export function StorePulseLogo({ className = 'w-7 h-7' }: StorePulseLogoProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <rect width="36" height="36" rx="9" fill="#0F5132" />
      <path
        d="M9.5 25V16.5C9.5 11.8056 13.3056 8 18 8C22.6944 8 26.5 11.8056 26.5 16.5V25"
        stroke="#F6F7F5"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12.5 20.5H15.25L17 16.5L19.25 23L21 19H23.5"
        stroke="#F6F7F5"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 25.5H28"
        stroke="#F6F7F5"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
