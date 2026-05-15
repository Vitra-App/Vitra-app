import Image from 'next/image';

type VitraLogoProps = {
  /** 'sm' = header bar size, 'lg' = login/onboarding full size */
  size?: 'sm' | 'lg';
  className?: string;
};

export function VitraLogo({ size = 'lg', className = '' }: VitraLogoProps) {
  if (size === 'sm') {
    return (
      <Image
        src="/logo.png"
        alt="Vitra"
        width={32}
        height={32}
        unoptimized
        className={className}
      />
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Image
        src="/logo.png"
        alt="Vitra"
        width={160}
        height={160}
        unoptimized
        priority
      />
    </div>
  );
}
