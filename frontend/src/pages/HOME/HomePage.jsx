import { useAuth } from '../../context/AuthContext';
import './home.css';

export default function HomePage({ onNavigate }) {
  const { user, isAuthenticated } = useAuth();
  return (
    <section className="home-shell">
      <div className="home-hero">
        <header className="home-brand">
          <div className="home-brand-logo" aria-hidden="true">
            <svg viewBox="0 0 64 44" xmlns="http://www.w3.org/2000/svg" className="home-logo-svg">
              <path
                d="M32 6 C32 2.8, 36.5 2.5, 36.5 6 C36.5 8.2, 33.8 9.2, 32 11.2 L32 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M32 14 L8 28.5 C6.5 29.4, 7.2 31.5, 9 31.5 L55 31.5 C56.8 31.5, 57.5 29.4, 56 28.5 L32 14 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M24 38 L32 35 L40 38"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="home-brand-title">SAF MODA</h1>
          <p className="home-brand-subtitle">Boutique Femenina</p>
        </header>

        <div className="home-visual-frame">
          <div className="home-visual-inner">
            <svg
              className="home-visual-svg"
              viewBox="0 0 360 450"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="Editorial Saf Moda"
            >
              <defs>
                <linearGradient id="archGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#efe2d2" />
                  <stop offset="100%" stopColor="#c9a888" />
                </linearGradient>
              </defs>
              <rect width="360" height="450" fill="url(#archGrad)" />
              <circle cx="180" cy="155" r="74" fill="none" stroke="#5c4033" strokeWidth="1" opacity="0.35" />
              <path
                d="M180 95 C205 145, 225 195, 212 265 C202 315, 190 350, 180 370 C170 350, 158 315, 148 265 C135 195, 155 145, 180 95 Z"
                fill="#5c4033"
                opacity="0.16"
              />
              <path
                d="M145 215 Q180 190 215 215"
                fill="none"
                stroke="#5c4033"
                strokeWidth="1.2"
                opacity="0.45"
              />
              <text
                x="180"
                y="405"
                textAnchor="middle"
                fill="#5c4033"
                fontSize="11"
                letterSpacing="5"
                fontFamily="Georgia, serif"
              >
                ATELIER · COLLECTION
              </text>
            </svg>
          </div>
        </div>

        {isAuthenticated && (
          <div className="home-session-pill">
            <span>Sesión activa:</span>
            <strong>{user.name}</strong>
          </div>
        )}

        <button
          type="button"
          className="home-cta-btn"
          onClick={() => onNavigate(isAuthenticated ? 'admin.dashboard' : 'login')}
        >
          {isAuthenticated ? 'Ir al Panel' : 'Acceder'}
        </button>
      </div>
    </section>
  );
}
