import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './home.css';

export default function LoginPage({ onNavigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    login({
      email,
      name: email === 'admin' ? 'Super Admin' : email,
      role: 'SUPER_ADMIN',
    });
    onNavigate('admin.dashboard');
  };

  return (
    <section className="login-shell">
      <div className="login-card">
        <aside className="login-aside">
          <span className="login-aside-badge">Atelier Privado</span>

          <div className="login-aside-copy">
            <h2>Elegancia en cada detalle.</h2>
            <p>
              Ingresa a tu espacio de gestión y punto de venta para dar vida a la
              colección de temporada.
            </p>
          </div>

          <span className="login-aside-footer">Saf Moda · Sistema</span>
        </aside>

        <div className="login-form-panel">
          <div className="login-top-bar">
            <button
              type="button"
              className="login-back-btn"
              onClick={() => onNavigate('home')}
            >
              ← Volver
            </button>
            <span className="login-season-tag">Acceso</span>
          </div>

          <header className="login-header">
            <h1>Bienvenida</h1>
            <p>Introduce tus credenciales para continuar.</p>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label" htmlFor="login-email">
                Correo electrónico
              </label>
              <div className="login-input-wrap">
                <input
                  id="login-email"
                  type="text"
                  className="login-input"
                  placeholder="admin o nombre@safmoda.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">
                Contraseña
              </label>
              <div className="login-input-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-toggle-pass"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit-btn">
              Ingresar al Atelier
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
