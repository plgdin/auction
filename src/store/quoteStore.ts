import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface QuoteItem {
  id: string;
  description: string;
  qty: number;
  unit: string;
  price: number;
  taxRate: number; // e.g. 18 for 18% GST
}

export interface QuoteAttachment {
  name: string;
  size: string;
  type: string;
  dataUrl: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  date: string;
  validUntil: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  clientAddress: string;
  senderName: string;
  senderCompany: string;
  senderEmail: string;
  senderAddress: string;
  senderLogoUrl?: string; // logo image data url
  logoWidth?: number; // width in pixels
  logoHeight?: number; // height in pixels
  logoTopOffset?: number; // top offset in pixels
  logoLeftOffset?: number; // left offset in pixels
  logoPosition?: 'left' | 'center' | 'right';
  documentTitle?: string; // defaults to "Quotation", can be empty
  items: QuoteItem[];
  gstEnabled: boolean;
  gstType: 'CGST_SGST' | 'IGST';
  colorTheme: string; // Tailwind primary color or Hex e.g. '#2563eb'
  footerText: string;
  attachments: QuoteAttachment[];
}

interface QuoteStore {
  quotes: Quote[];
  activeQuote: Quote;
  addItemToActiveQuote: (item: Omit<QuoteItem, 'id'>) => void;
  removeItemFromActiveQuote: (itemId: string) => void;
  updateActiveQuoteItem: (itemId: string, updates: Partial<QuoteItem>) => void;
  updateActiveQuoteMetadata: (updates: Partial<Omit<Quote, 'items' | 'attachments'>>) => void;
  addAttachmentToActiveQuote: (attachment: QuoteAttachment) => void;
  removeAttachmentFromActiveQuote: (index: number) => void;
  saveActiveQuote: () => void;
  loadQuote: (quoteId: string) => void;
  deleteQuote: (quoteId: string) => void;
  createNewQuote: () => void;
}

const initialQuote = (): Quote => ({
  id: Math.random().toString(36).substring(2, 11),
  quoteNumber: `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
  date: new Date().toISOString().split('T')[0],
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  clientName: '',
  clientCompany: '',
  clientEmail: '',
  clientAddress: '',
  senderName: 'Sales Department',
  senderCompany: 'My Enterprise Corp',
  senderEmail: 'sales@myenterprise.com',
  senderAddress: '123 Business Boulevard, Sector 5, India',
  senderLogoUrl: '',
  logoWidth: 150,
  logoHeight: 80,
  logoTopOffset: 16,
  logoLeftOffset: 0,
  logoPosition: 'left',
  documentTitle: 'Quotation',
  items: [],
  gstEnabled: true,
  gstType: 'CGST_SGST',
  colorTheme: '#0284c7', // Sky-600 defaults
  footerText: 'Thank you for your business. Terms: 100% advance or as agreed in purchase agreement.',
  attachments: [],
});

export const useQuoteStore = create<QuoteStore>()(
  persist(
    (set, get) => ({
      quotes: [],
      activeQuote: initialQuote(),

      addItemToActiveQuote: (item) => {
        const newItem: QuoteItem = {
          ...item,
          id: Math.random().toString(36).substring(2, 11),
        };
        set((state) => ({
          activeQuote: {
            ...state.activeQuote,
            items: [...state.activeQuote.items, newItem],
          },
        }));
      },

      removeItemFromActiveQuote: (itemId) => {
        set((state) => ({
          activeQuote: {
            ...state.activeQuote,
            items: state.activeQuote.items.filter((it) => it.id !== itemId),
          },
        }));
      },

      updateActiveQuoteItem: (itemId, updates) => {
        set((state) => ({
          activeQuote: {
            ...state.activeQuote,
            items: state.activeQuote.items.map((it) =>
              it.id === itemId ? { ...it, ...updates } : it
            ),
          },
        }));
      },

      updateActiveQuoteMetadata: (updates) => {
        set((state) => ({
          activeQuote: {
            ...state.activeQuote,
            ...updates,
          },
        }));
      },

      addAttachmentToActiveQuote: (attachment) => {
        set((state) => ({
          activeQuote: {
            ...state.activeQuote,
            attachments: [...state.activeQuote.attachments, attachment],
          },
        }));
      },

      removeAttachmentFromActiveQuote: (index) => {
        set((state) => ({
          activeQuote: {
            ...state.activeQuote,
            attachments: state.activeQuote.attachments.filter((_, idx) => idx !== index),
          },
        }));
      },

      saveActiveQuote: () => {
        const { activeQuote, quotes } = get();
        const existingIdx = quotes.findIndex((q) => q.id === activeQuote.id);
        let updatedQuotes = [...quotes];
        if (existingIdx >= 0) {
          updatedQuotes[existingIdx] = activeQuote;
        } else {
          updatedQuotes.push(activeQuote);
        }
        set({
          quotes: updatedQuotes,
        });
      },

      loadQuote: (quoteId) => {
        const { quotes } = get();
        const found = quotes.find((q) => q.id === quoteId);
        if (found) {
          set({ activeQuote: JSON.parse(JSON.stringify(found)) });
        }
      },

      deleteQuote: (quoteId) => {
        set((state) => ({
          quotes: state.quotes.filter((q) => q.id !== quoteId),
        }));
      },

      createNewQuote: () => {
        set({ activeQuote: initialQuote() });
      },
    }),
    {
      name: 'quote-storage',
    }
  )
);
