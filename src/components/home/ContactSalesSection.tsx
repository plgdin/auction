import { useState } from 'react';
import { Mail, Phone, Building2, Send, CheckCircle2, ShieldCheck, Zap, Headphones } from 'lucide-react';
import { publicService } from '../../services/publicService';

export function ContactSalesSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setErrorMessage('Please fill in your name, email, and phone number.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await publicService.submitContactForm({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject: `[Sales Inquiry] ${formData.company ? `${formData.company} - ` : ''}Landing Page Contact`,
        message: `Company: ${formData.company || 'N/A'}\nPhone: ${formData.phone}\n\nMessage:\n${formData.message || 'No additional notes provided.'}`,
      });

      setIsSubmitted(true);
      setFormData({ name: '', email: '', phone: '', company: '', message: '' });
    } catch (err) {
      console.error('Failed to submit sales inquiry:', err);
      setErrorMessage('Failed to send request. Please try again or contact us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-20 lg:py-28 bg-slate-900 text-white relative overflow-hidden border-t border-slate-800">
      {/* Background Decorative Blur Elements */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#007ec7]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Info & Value Props */}
          <div className="lg:col-span-6 space-y-8 text-left">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#007ec7]/15 border border-[#007ec7]/30 text-xs font-extrabold text-[#38bdf8] uppercase tracking-wider mb-4">
                <Building2 className="w-3.5 h-3.5" />
                Enterprise & B2B Solutions
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
                Ready to scale your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38bdf8] to-[#007ec7]">MSTC eAuction</span> operations?
              </h2>
              <p className="mt-4 text-slate-300 text-base sm:text-lg leading-relaxed font-light">
                Talk to our dedicated sales and auction operations team to unlock custom catalog integrations, enterprise ROI calculators, and priority support.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#007ec7]/20 border border-[#007ec7]/40 flex items-center justify-center shrink-0 text-[#38bdf8] mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Dedicated MSTC Catalog Specialist</h3>
                  <p className="text-slate-400 text-sm mt-0.5">Get personalized assistance for complex lot valuation, EMD refunds, and document verification.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#007ec7]/20 border border-[#007ec7]/40 flex items-center justify-center shrink-0 text-[#38bdf8] mt-0.5">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Bulk Lot Analytics & Alerts</h3>
                  <p className="text-slate-400 text-sm mt-0.5">Automated SMS, Email & WhatsApp notifications for your target scrap categories and locations.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#007ec7]/20 border border-[#007ec7]/40 flex items-center justify-center shrink-0 text-[#38bdf8] mt-0.5">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Priority Business Support</h3>
                  <p className="text-slate-400 text-sm mt-0.5">Direct phone line and email escalation for high-volume enterprise bidders.</p>
                </div>
              </div>
            </div>

            {/* Direct Contact Handles */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-wrap gap-6 text-sm text-slate-300">
              <a href="mailto:support@lelam.co" className="flex items-center gap-2 hover:text-[#38bdf8] transition-colors">
                <Mail className="w-4 h-4 text-[#007ec7]" />
                support@lelam.co
              </a>
              <a href="tel:+919876543210" className="flex items-center gap-2 hover:text-[#38bdf8] transition-colors">
                <Phone className="w-4 h-4 text-[#007ec7]" />
                +91 98765 43210
              </a>
            </div>
          </div>

          {/* Right Column: Contact Sales Form Card */}
          <div className="lg:col-span-6">
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-2xl relative text-slate-900">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
                Contact Sales Team
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                Fill out the form below and an auction advisor will reach out within 2 hours.
              </p>

              {isSubmitted ? (
                <div className="py-10 text-center space-y-4 animate-fade-in">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-900">Inquiry Received!</h4>
                  <p className="text-slate-600 text-sm max-w-sm mx-auto">
                    Thank you for reaching out. Our enterprise sales team will review your details and contact you shortly.
                  </p>
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="mt-4 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Send Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                      {errorMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="John Doe"
                        required
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#007ec7] focus:ring-2 focus:ring-[#007ec7]/20 transition-colors shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Work Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="john@company.com"
                        required
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#007ec7] focus:ring-2 focus:ring-[#007ec7]/20 transition-colors shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+91 98765 43210"
                        required
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#007ec7] focus:ring-2 focus:ring-[#007ec7]/20 transition-colors shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Company Name
                      </label>
                      <input
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        placeholder="Acme Scrap Traders"
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#007ec7] focus:ring-2 focus:ring-[#007ec7]/20 transition-colors shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Requirements / Note
                    </label>
                    <textarea
                      name="message"
                      rows={3}
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Tell us about your bidding volume or MSTC assistance needs..."
                      className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#007ec7] focus:ring-2 focus:ring-[#007ec7]/20 transition-colors resize-none shadow-2xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-6 bg-primary hover:bg-primary-700 active:bg-primary-800 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-primary/45 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <span>Sending Request...</span>
                    ) : (
                      <>
                        <span>Submit Sales Request</span>
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
