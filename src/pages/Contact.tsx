import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Phone, MapPin, Send, ChevronDown, Bug, HelpCircle, CreditCard, ShieldAlert, PackageSearch, MessageSquare } from 'lucide-react';
import { publicService } from '../services/publicService';
import clsx from 'clsx';

const ISSUE_TYPES = [
  { value: '', label: 'Select an issue type', icon: MessageSquare },
  { value: 'bug_report', label: 'Bug Report / Technical Issue', icon: Bug },
  { value: 'bidding_help', label: 'Bidding & Auction Help', icon: HelpCircle },
  { value: 'payment_issue', label: 'Payment / EMD Issue', icon: CreditCard },
  { value: 'account_issue', label: 'Account & Access Issue', icon: ShieldAlert },
  { value: 'catalog_issue', label: 'Catalog / Listing Issue', icon: PackageSearch },
  { value: 'general_inquiry', label: 'General Inquiry', icon: MessageSquare },
];

type IssueOption = typeof ISSUE_TYPES[number];

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  issueType: z.string().min(1, 'Please select an issue type'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IssueOption>(ISSUE_TYPES[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { issueType: '' },
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleIssueSelect = (issue: IssueOption) => {
    setSelectedIssue(issue);
    setValue('issueType', issue.value, { shouldValidate: true });
    setIsDropdownOpen(false);
  };

  const onSubmit = async (data: ContactFormValues) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const issueLabel = ISSUE_TYPES.find(t => t.value === data.issueType)?.label || data.issueType;
      const isSuccess = await publicService.submitContactMessage({
        name: data.name,
        email: data.email,
        subject: `[${issueLabel}] ${data.subject}`,
        message: data.message,
      });

      if (isSuccess) {
        setSuccess(true);
        reset();
        setSelectedIssue(ISSUE_TYPES[0]);
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
            Our dedicated support team is here to assist you with registration, bidding, and technical inquiries.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Contact Info */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-start mb-6">
                <MapPin className="w-8 h-8 text-primary shrink-0 mr-4 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Office</h3>
                  <p className="text-slate-600 leading-relaxed">
                    No: 2, 20th Cross Lakshimpuram,<br />
                    Halasuru, Bangalore 560008
                  </p>
                </div>
              </div>
              <div className="flex items-start mb-6">
                <Phone className="w-8 h-8 text-primary shrink-0 mr-4 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Phone</h3>
                  <p className="text-slate-600 leading-relaxed">
                    +91 94477 53889<br />
                    Mon-Sat, 9:00 AM - 6:00 PM IST
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Mail className="w-8 h-8 text-primary shrink-0 mr-4 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Email</h3>
                  <p className="text-slate-600 leading-relaxed">
                    <a href="mailto:Support@lelam.co" className="hover:text-primary transition-colors">Support@lelam.co</a><br />
                    <a href="mailto:Business@lelam.co" className="hover:text-primary transition-colors">Business@lelam.co</a>
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
                        placeholder="Your full name"
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

                  {/* Issue Type Dropdown */}
                  <div ref={dropdownRef} className="relative">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Issue Type</label>
                    <input type="hidden" {...register('issueType')} />
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={clsx(
                        "w-full px-4 py-3 border rounded-xl shadow-sm text-left flex items-center justify-between transition-all duration-200",
                        isDropdownOpen
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-slate-300 hover:border-slate-400",
                        selectedIssue.value ? "text-slate-900" : "text-slate-400"
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <selectedIssue.icon className="w-4 h-4 text-slate-400" />
                        {selectedIssue.label}
                      </span>
                      <ChevronDown className={clsx(
                        "w-5 h-5 text-slate-400 transition-transform duration-300 ease-out",
                        isDropdownOpen && "rotate-180"
                      )} />
                    </button>

                    {/* Animated Dropdown Panel */}
                    <div className={clsx(
                      "absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden transition-all duration-300 ease-out origin-top",
                      isDropdownOpen
                        ? "opacity-100 scale-y-100 translate-y-0"
                        : "opacity-0 scale-y-95 -translate-y-1 pointer-events-none"
                    )}>
                      {ISSUE_TYPES.filter(t => t.value !== '').map((issue, i) => {
                        const Icon = issue.icon;
                        const isSelected = selectedIssue.value === issue.value;
                        return (
                          <button
                            key={issue.value}
                            type="button"
                            onClick={() => handleIssueSelect(issue)}
                            className={clsx(
                              "w-full px-4 py-3 flex items-center gap-3 text-left text-sm transition-colors duration-150",
                              isSelected
                                ? "bg-primary/5 text-primary font-semibold"
                                : "text-slate-700 hover:bg-slate-50",
                              i < ISSUE_TYPES.length - 2 && "border-b border-slate-100"
                            )}
                            style={{ transitionDelay: isDropdownOpen ? `${i * 30}ms` : '0ms' }}
                          >
                            <Icon className={clsx("w-4 h-4", isSelected ? "text-primary" : "text-slate-400")} />
                            {issue.label}
                          </button>
                        );
                      })}
                    </div>
                    {errors.issueType && <p className="mt-1 text-sm text-destructive">{errors.issueType.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                    <input
                      {...register('subject')}
                      type="text"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
                      placeholder="Brief description of your issue"
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
