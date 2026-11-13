import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 38,
          background: '#4f46e5',
        }}
      >
        <svg width="150" height="150" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g
            transform="translate(4 4)"
            stroke="#ffffff"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 8.5 12 4l10 4.5-10 4.5z" />
            <path d="M6 10.8V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.2M21 9v5" />
          </g>
        </svg>
      </div>
    ),
    size,
  )
}
