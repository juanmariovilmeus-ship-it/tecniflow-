import React from 'react';

export interface TecniFlowLogoProps {
  /**
   * Layout format of the brand logo:
   * - 'full': Stacked TF monogram + TecniFlow wordmark (ideal for auth / splash)
   * - 'horizontal': Inline TF monogram + TecniFlow wordmark (ideal for headers / nav)
   * - 'icon': Just the TF monogram (compact, buttons, avatar badges, loader)
   */
  variant?: 'full' | 'horizontal' | 'icon';
  /**
   * Size presets:
   * - 'xs': Compact (e.g. 24px height / small mobile)
   * - 'sm': Small (e.g. 32px height / desktop header)
   * - 'md': Medium (e.g. 40px - 48px height / standard)
   * - 'lg': Large (e.g. 64px - 72px height / auth screens)
   * - 'xl': Extra large (e.g. 88px+ height / prominent showcase)
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * When true, wraps the logo in a clean, elevated white surface badge
   * with subtle border to ensure 100% contrast for dark backgrounds (slate-900 / dark mode).
   */
  withBadge?: boolean;
  /**
   * Custom additional classes applied to the root container or image.
   */
  className?: string;
  /**
   * Accessible alt text for screen readers.
   */
  alt?: string;
}

export const TecniFlowLogo: React.FC<TecniFlowLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  withBadge = false,
  className = '',
  alt = 'TecniFlow',
}) => {
  // Map dimensions according to variant and size
  let imgPath = '/brand/tecniflow-horizontal-white.png';
  let sizeClasses = 'h-8 w-auto';

  if (variant === 'full') {
    imgPath = withBadge ? '/brand/tecniflow-logo-160.png' : '/brand/tecniflow-full-transparent.png';
    switch (size) {
      case 'xs':
        sizeClasses = 'h-9 w-auto';
        break;
      case 'sm':
        sizeClasses = 'h-12 w-auto';
        break;
      case 'md':
        sizeClasses = 'h-16 w-auto';
        break;
      case 'lg':
        sizeClasses = 'h-20 w-auto';
        break;
      case 'xl':
        sizeClasses = 'h-28 w-auto';
        break;
    }
  } else if (variant === 'icon') {
    imgPath = withBadge ? '/brand/tecniflow-monogram-64.png' : '/brand/tecniflow-monogram-64-trans.png';
    switch (size) {
      case 'xs':
        sizeClasses = 'h-5 w-auto';
        break;
      case 'sm':
        sizeClasses = 'h-7 w-auto';
        break;
      case 'md':
        sizeClasses = 'h-9 w-auto';
        break;
      case 'lg':
        sizeClasses = 'h-12 w-auto';
        break;
      case 'xl':
        sizeClasses = 'h-16 w-auto';
        break;
    }
  } else {
    // horizontal
    imgPath = withBadge ? '/brand/tecniflow-horizontal-white.png' : '/brand/tecniflow-horizontal-64-trans.png';
    switch (size) {
      case 'xs':
        sizeClasses = 'h-6 w-auto';
        break;
      case 'sm':
        sizeClasses = 'h-8 w-auto';
        break;
      case 'md':
        sizeClasses = 'h-10 w-auto';
        break;
      case 'lg':
        sizeClasses = 'h-12 w-auto';
        break;
      case 'xl':
        sizeClasses = 'h-16 w-auto';
        break;
    }
  }

  const imageElement = (
    <img
      src={imgPath}
      alt={alt}
      className={`object-contain select-none shrink-0 ${sizeClasses} ${withBadge ? '' : className}`}
      loading="eager"
      decoding="async"
    />
  );

  if (withBadge) {
    const badgePadding =
      size === 'xs' ? 'p-1' : size === 'sm' ? 'px-2 py-1' : size === 'md' ? 'px-2.5 py-1.5' : 'px-3 py-2';
    const badgeRadius = size === 'xs' || size === 'sm' ? 'rounded-lg' : 'rounded-xl';

    return (
      <div
        className={`inline-flex items-center justify-center bg-white border border-slate-700/40 shadow-xs ${badgeRadius} ${badgePadding} ${className}`}
      >
        {imageElement}
      </div>
    );
  }

  return imageElement;
};

export default TecniFlowLogo;
