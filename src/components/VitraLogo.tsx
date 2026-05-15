/**
 * Text-based logo component — no image file dependency.
 */

type VitraLogoProps = {
  /** 'sm' = header bar size, 'lg' = login/onboarding full size */
  size?: 'sm' | 'lg';
  className?: string;
};

export function VitraLogo({ size = 'lg', className = '' }: VitraLogoProps) {
  if (size === 'sm') {
    return (
      <span
        className={`font-extrabold tracking-tight text-xl text-brand-600 dark:text-brand-400 ${className}`}
        aria-label="Vitra"
      >
        Vitra
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="w-20 h-20 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg mb-2">
        <span className="text-white font-extrabold text-3xl tracking-tight">V</span>
      </div>
      <span className="font-extrabold text-2xl tracking-tight text-brand-600 dark:text-brand-400">
        Vitra
      </span>
    </div>
  );
}
