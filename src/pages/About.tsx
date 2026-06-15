import { Shield, Globe, Award } from 'lucide-react';

export function About() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <div className="bg-slate-900 py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/50 to-slate-900 z-0"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-6">About Lelam e-Procurement</h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Revolutionizing enterprise asset disposal and public procurement through transparent, highly secure, and globally accessible forward and reverse auction technologies.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">Our Mission</h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-6">
                We are committed to providing a state-of-the-art electronic platform that bridges the gap between massive institutional sellers and global buyers. By leveraging real-time bidding infrastructure, we ensure fair market valuation for scrap, surplus, and prime assets.
              </p>
              <p className="text-lg text-slate-600 leading-relaxed">
                Operating with absolute integrity, our platform ensures every bid, tender, and transaction is cryptographically logged and fully compliant with international procurement standards.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <Shield className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Unmatched Security</h3>
                <p className="text-slate-600">Bank-grade encryption protecting financial data and competitive bidding strategies.</p>
              </div>
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 mt-0 sm:mt-12">
                <Globe className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Global Reach</h3>
                <p className="text-slate-600">Connecting local sellers with an international network of verified institutional buyers.</p>
              </div>
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <Award className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Proven Excellence</h3>
                <p className="text-slate-600">Over a decade of orchestrating multi-million dollar asset liquidations successfully.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
