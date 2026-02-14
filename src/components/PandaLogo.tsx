import Image from 'next/image'

interface PandaLogoProps {
  size?: number | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  variant?: 'default' | 'happy' | 'sad' | 'excited' | 'thinking' | 'cool'
}

const sizeMap = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
}

const variantMap = {
  default: '/2.png',  // Smiling
  happy: '/5.png',    // Happy
  sad: '/6.png',      // Sad
  excited: '/7.png',  // Excited
  thinking: '/3.png', // Thinking
  cool: '/4.png',     // Cool
}

export default function PandaLogo({ size = 'md', className = '', variant = 'default' }: PandaLogoProps) {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size]
  const src = variantMap[variant]

  return (
    <Image
      src={src}
      alt="옛설판다"
      width={pixelSize}
      height={pixelSize}
      className={className}
      priority
    />
  )
}
