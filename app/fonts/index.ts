import localFont from 'next/font/local'

export const publicSans = localFont({
  src: [
    { path: './PublicSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: './PublicSans-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: './PublicSans-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
})

export const plexMono = localFont({
  src: [{ path: './PlexMono-Regular.woff2', weight: '400', style: 'normal' }],
  variable: '--font-mono',
  display: 'swap',
})
