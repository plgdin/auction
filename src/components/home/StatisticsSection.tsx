export function StatisticsSection() {
  const stats = [
    { label: 'Registered Buyers', value: '50,000+' },
    { label: 'Active Sellers', value: '1,200+' },
    { label: 'Auctions Conducted', value: '15,000+' },
    { label: 'Total Value Transacted', value: '₹5,000 Cr+' },
  ];

  return (
    <section className="bg-primary py-16 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="absolute left-0 top-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" fill="none" stroke="currentColor">
          <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
          <rect width="100" height="100" fill="url(#grid)" />
        </svg>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-primary-400/30">
          {stats.map((stat, index) => (
            <div key={index} className="flex flex-col items-center justify-center p-4">
              <span className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-2 drop-shadow-sm">
                {stat.value}
              </span>
              <span className="text-primary-100 font-medium uppercase tracking-wider text-sm">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
