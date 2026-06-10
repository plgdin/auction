import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Gavel, FileText, ArrowRight } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300 pt-16 pb-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-white rounded-md flex items-center justify-center font-bold text-lg">
                M
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                Auction e-Procurement
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed mt-4">
              The premier enterprise platform for secure, transparent, and efficient e-procurement and online auctions. Empowering businesses globally.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">Services</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/auctions" className="hover:text-primary transition-colors flex items-center gap-2 text-sm">
                  <Gavel size={16} /> Live Auctions
                </Link>
              </li>
              <li>
                <Link to="/tenders" className="hover:text-primary transition-colors flex items-center gap-2 text-sm">
                  <FileText size={16} /> Open Tenders
                </Link>
              </li>
              <li>
                <Link to="/notices" className="hover:text-primary transition-colors flex items-center gap-2 text-sm">
                  <ArrowRight size={16} /> Official Notices
                </Link>
              </li>
              <li>
                <Link to="/news" className="hover:text-primary transition-colors flex items-center gap-2 text-sm">
                  <ArrowRight size={16} /> News & Updates
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
                <a href="#" className="hover:text-primary transition-colors">Terms & Conditions</a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
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
                  123 Enterprise Tower, Sector 4<br />
                  Business District, NY 10001
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="text-primary shrink-0" size={20} />
                <span className="text-slate-400">+1 (800) 123-4567</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="text-primary shrink-0" size={20} />
                <a href="mailto:support@auction-platform.com" className="text-slate-400 hover:text-white transition-colors">
                  support@auction-platform.com
                </a>
              </li>
            </ul>
          </div>
          
        </div>

        <div className="border-t border-slate-800 pt-8 mt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Auction-Platform. All rights reserved. Not affiliated with Auction Limited.
          </p>
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
