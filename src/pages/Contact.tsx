import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { publicService } from '../services/publicService';

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormValues) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const isSuccess = await publicService.submitContactMessage({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
      });

      if (isSuccess) {
        setSuccess(true);
        reset();
      } else {
        setErrorMsg('Failed to send message. Please try again later.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Contact Us</h1>
          <p className="mt-4 text-xl text-slate-600 max-w-2xl mx-auto">
            Our dedicated enterprise support team is here to assist you with registration, bidding, and technical inquiries.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Contact Info */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-start mb-6">
                <MapPin className="w-8 h-8 text-primary shrink-0 mr-4 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Corporate Headquarters</h3>
                  <p className="text-slate-600 leading-relaxed">
                    123 Enterprise Tower, Sector 4<br />
                    Business District, NY 10001
                  </p>
                </div>
              </div>
              <div className="flex items-start mb-6">
                <Phone className="w-8 h-8 text-primary shrink-0 mr-4 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Phone Support</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Toll-Free: +1 (800) 123-4567<br />
                    Mon-Fri, 9:00 AM - 6:00 PM EST
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Mail className="w-8 h-8 text-primary shrink-0 mr-4 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Email</h3>
                  <p className="text-slate-600 leading-relaxed">
                    support@lelam.com<br />
                    bidding@lelam.com
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200">
              {success ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Send className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Message Sent!</h3>
                  <p className="text-slate-600">Thank you for reaching out. Our team will get back to you within 24 hours.</p>
                  <button 
                    onClick={() => setSuccess(false)}
                    className="mt-8 text-primary font-medium hover:text-primary-700"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {errorMsg && (
                    <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded text-sm">
                      {errorMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Your Name</label>
                      <input
                        {...register('name')}
                        type="text"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
                        placeholder="John Doe"
                      />
                      {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                      <input
                        {...register('email')}
                        type="email"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
                        placeholder="john@example.com"
                      />
                      {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                    <input
                      {...register('subject')}
                      type="text"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
                      placeholder="How can we help?"
                    />
                    {errors.subject && <p className="mt-1 text-sm text-destructive">{errors.subject.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Message</label>
                    <textarea
                      {...register('message')}
                      rows={5}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm resize-none"
                      placeholder="Please provide details about your inquiry..."
                    ></textarea>
                    {errors.message && <p className="mt-1 text-sm text-destructive">{errors.message.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 border border-transparent text-base font-medium rounded-xl shadow-sm text-white bg-primary hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? 'Sending...' : (
                      <>
                        Send Message <Send className="ml-2 w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
