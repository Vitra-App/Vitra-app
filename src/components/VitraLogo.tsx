import Image from 'next/image';
import logoSrc from '../../public/logo.png';

type VitraLogoProps = {
  /** 'sm' = header bar size, 'lg' = login/onboarding full size */
  size?: 'sm' | 'lg';
  className?: string;
};

export function VitraLogo({ size = 'lg', className = '' }: VitraLogoProps) {
  if (size === 'sm') {
    return (
      <Image
        src={logoSrc}
        alt="Vitra"
        width={32}
        height={32}
        className={className}
      />
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Image
        src={logoSrc}
        alt="Vitra"
        width={160}
        height={160}
        priority
      />
    </div>
  );
}
