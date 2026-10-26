/** Marca de Prompt Vault: la puerta de una cámara acorazada con el cursor de un prompt dentro. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Prompt Vault">
      <rect width="64" height="64" rx="15" fill="var(--accent)" />
      <circle cx="32" cy="32" r="17.5" fill="none" stroke="var(--on-accent)" strokeWidth="3.5" />
      <path
        d="M26 25.5 33 32l-7 6.5"
        fill="none"
        stroke="var(--on-accent)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M36.5 39h5.5" stroke="var(--on-accent)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}
