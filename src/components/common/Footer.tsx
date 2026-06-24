import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Gavel, ArrowRight } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative bg-slate-900 text-slate-300 pt-16 pb-8 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-slate-900 mix-blend-multiply" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-800/20 to-transparent" />
      </div>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center">
              <img src="/png_lelam_1.webp" alt="Lelam Logo" className="h-8 w-auto object-contain brightness-0 invert" />
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed mt-4">
              An independent, data-driven assistive intelligence platform for registered MSTC auction buyers. Track market prices, analyze trends, and estimate bids.
            </p>
            <p className="text-xs text-slate-500 italic mt-2">
              Disclaimer: Lelam is an independent assistive tool and is not affiliated with MSTC or any government agency.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">Platform</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/auctions" className="hover:text-primary transition-colors flex items-center gap-2 text-sm">
                  <Gavel size={16} /> MSTC Catalog
                </Link>
              </li>
              <li>
                <Link to="/news" className="hover:text-primary transition-colors flex items-center gap-2 text-sm">
                  <ArrowRight size={16} /> Market Trends
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">Support</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/faq" className="hover:text-primary transition-colors">Frequently Asked Questions</Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-primary transition-colors">About Us</Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-primary transition-colors">Contact Support</Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-primary transition-colors">Terms & Conditions</Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:text-primary transition-colors">Cookie Policy</Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">Contact Us</h3>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="text-primary shrink-0" size={20} />
                <span className="text-slate-400">
                  No: 2, 20th Cross Lakshimpuram,<br />
                  Halasuru, Bangalore 560008
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="text-primary shrink-0" size={20} />
                <span className="text-slate-400">+91 94477 53889</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="text-primary shrink-0" size={20} />
                <a href="mailto:Support@lelam.co" className="text-slate-400 hover:text-white transition-colors">
                  Support@lelam.co
                </a>
              </li>
            </ul>
          </div>
          
        </div>

        <div className="border-t border-slate-800 pt-8 mt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-slate-500 flex items-center">
              &copy; {new Date().getFullYear()} Lelam. All rights reserved.
              <span className="ml-3 px-2 py-0.5 rounded-md bg-slate-800 text-xs text-slate-400 font-medium">v1.0</span>
            </p>
            <p className="text-[11px] text-slate-650 max-w-lg">
              Lelam Company is an independent assistive platform and is not affiliated with MSTC Limited.
            </p>
          </div>
          <div className="flex space-x-4">
            {/* Social Icons Placeholder */}
            <div className="w-8 h-8 rounded-full bg-slate-800 hover:bg-primary transition-colors flex items-center justify-center cursor-pointer">
               <span className="text-xs font-bold text-white">in</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800 hover:bg-primary transition-colors flex items-center justify-center cursor-pointer">
               <span className="text-xs font-bold text-white">X</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
