import { Link } from "react-router-dom";

function BrandMark({ compact = false }) {
  return (
    <Link to="/" className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-offset-4">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-black/10">P</span>
      <span className={`text-xl font-bold tracking-tight ${compact ? "text-slate-900" : "text-white"}`}>
        Park<span className={compact ? "text-blue-600" : "text-teal-300"}>It</span>
      </span>
    </Link>
  );
}

function AuthShell({ title, description, footer, children }) {
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <section className="relative isolate overflow-hidden bg-slate-900 px-6 py-7 text-white sm:px-10 sm:py-9 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-12 xl:px-20">
        <div className="pointer-events-none absolute -right-28 -top-32 -z-10 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 -z-10 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />

        <BrandMark />

        <div className="mx-auto mt-10 w-full max-w-xl lg:my-auto lg:py-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-teal-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            PARKING, MADE SIMPLE
          </div>
          <h1 className="mt-6 max-w-lg text-4xl font-bold leading-tight tracking-tight sm:text-5xl xl:text-6xl">
            See your parking options before you arrive.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">
            Find a nearby lot, reserve the right space for your vehicle, and keep your parking details in one place.
          </p>

          <div className="mt-9 rounded-2xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-slate-300">PARKING CARD PREVIEW</p>
                <h2 className="mt-2 text-lg font-semibold">Choose a lot near your destination</h2>
                <p className="mt-1 text-sm text-slate-300">Search locations to see current availability.</p>
              </div>
              <span className="rounded-xl bg-white/10 px-3 py-2 text-right">
                <span className="block text-sm font-bold text-white">LIVE</span>
                <span className="block text-[11px] font-medium text-slate-300">when you search</span>
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-200" aria-label="Parking status legend">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-300" />Available</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-amber-300" />Reserved</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-white/35" />Occupied</span>
            </div>
          </div>

          <div className="mt-7 grid gap-3 text-sm text-slate-200 sm:grid-cols-3">
            <p className="flex items-center gap-2"><span className="text-emerald-300">✓</span> Reserve ahead</p>
            <p className="flex items-center gap-2"><span className="text-emerald-300">✓</span> Know your space</p>
            <p className="flex items-center gap-2"><span className="text-emerald-300">✓</span> Track each visit</p>
          </div>
        </div>

        <p className="hidden text-xs text-slate-400 lg:block">A clearer start to every journey.</p>
      </section>

      <section className="flex min-h-[65vh] items-center justify-center bg-slate-50 px-5 py-12 sm:px-8 lg:min-h-screen lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-9 lg:hidden"><BrandMark compact /></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/[0.04] sm:p-9">
            <div className="mb-7">
              <p className="text-sm font-semibold text-blue-700">WELCOME TO PARKIT</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            </div>
            {children}
            {footer && <div className="mt-7 border-t border-slate-100 pt-6">{footer}</div>}
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">ParkIt · A smoother way to park</p>
        </div>
      </section>
    </main>
  );
}

export default AuthShell;
