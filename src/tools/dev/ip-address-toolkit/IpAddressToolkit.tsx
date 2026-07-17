import { IP_TOOLS } from '../../../lib/ipTools';

export default function IpAddressToolkit() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Pick a tool for IPv4 or IPv6 work. Every calculation runs in your browser. Nothing is
        uploaded. WHOIS, geolocation, and reverse DNS need the network and live under Special
        Ranges as external links.
      </p>

      <section aria-label="IP tools">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
          IP address tools
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {IP_TOOLS.map((t) => (
            <a
              key={t.id}
              href={t.path}
              className="card group flex flex-col gap-2 hover:ring-brand-500 dark:hover:ring-brand-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl" aria-hidden="true">
                  {t.icon}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {t.badge}
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                {t.name}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t.shortNote}</p>
              <span className="mt-auto pt-1 text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100 dark:text-brand-400">
                Open tool →
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
