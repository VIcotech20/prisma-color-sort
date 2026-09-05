import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidad")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-10 text-sm leading-relaxed text-fg">
      <p className="text-xs uppercase tracking-widest text-muted">PRISMA</p>
      <h1 className="font-display mt-2 text-3xl">Privacidad / Privacy</h1>
      <p className="mt-2 text-muted">Última actualización: 22 agosto 2026</p>

      <h2 className="font-display mt-8 text-xl">Español</h2>
      <p className="mt-3">
        PRISMA es un juego en el navegador. No pide cuenta, correo ni nombre. El
        progreso (nivel, vidas, pigmentos) se guarda solo en este dispositivo
        (almacenamiento local).
      </p>
      <p className="mt-3">
        Si juegas en Poki, CrazyGames o GameDistribution, esas plataformas
        pueden mostrar anuncios y usar cookies o identificadores según su
        propia política. PRISMA no vende tus datos ni crea un perfil fuera de
        ese almacenamiento local.
      </p>
      <p className="mt-3">
        Contacto del juego: el formulario del portal donde lo estés jugando.
      </p>

      <h2 className="font-display mt-8 text-xl">English</h2>
      <p className="mt-3">
        PRISMA is a browser game. It does not ask for an account, email, or
        name. Progress (level, lives, pigment) is stored only on this device
        (local storage).
      </p>
      <p className="mt-3">
        If you play on Poki, CrazyGames, or GameDistribution, those platforms
        may show ads and use cookies or identifiers under their own policies.
        PRISMA does not sell your data or build a profile beyond that local
        save.
      </p>
      <p className="mt-3">
        Contact: use the support form of the portal you are playing on.
      </p>

      <Link to="/" className="mt-10 inline-block text-accent">
        ← PRISMA
      </Link>
    </main>
  );
}
