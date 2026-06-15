// Dashboard Service for managing personal dashboard features
// All data is persistent and keyed by user ID in localStorage

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface ReminderSetting {
  auctionId: string;
  daysPrior: number; // e.g. 1, 2, 3 days
  enabled: boolean;
  timeValue?: number; // e.g. 15, 30, 1, 2
  timeUnit?: 'minutes' | 'hours' | 'days'; // e.g. 'minutes', 'hours', 'days'
  remindersCount?: number; // 1, 2, 3 times
}

export interface InventoryItem {
  id: string;
  description: string;
  qty: string;
  unit: string;
  checked: boolean;
  status: 'ok' | 'reported';
  issue?: {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    reportedAt: string;
  };
}

export interface AuctionInventory {
  auctionId: string;
  auctionTitle: string;
  referenceNumber: string;
  items: InventoryItem[];
  verifiedAt?: string;
  isLocked?: boolean;
}

const DEFAULT_VENDORS: Vendor[] = [
  { id: 'v1', name: 'Metro Scrap Traders', email: 'contact@metroscrap.com', phone: '+91 98765 43210' },
  { id: 'v2', name: 'Alpha Logistics & Movers', email: 'logistics@alphamovers.in', phone: '+91 91234 56789' },
  { id: 'v3', name: 'Apex Metal Recyclers', email: 'info@apexmetal.co.in', phone: '+91 88888 77777' }
];

export const dashboardService = {
  // --- VENDORS MANAGEMENT ---
  getVendors(userId: string): Vendor[] {
    const key = `usr_vendors_${userId}`;
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify(DEFAULT_VENDORS));
      return DEFAULT_VENDORS;
    }
    return JSON.parse(data);
  },

  saveVendors(userId: string, vendors: Vendor[]): void {
    const key = `usr_vendors_${userId}`;
    localStorage.setItem(key, JSON.stringify(vendors));
  },

  addVendor(userId: string, vendor: Omit<Vendor, 'id'>): Vendor {
    const vendors = this.getVendors(userId);
    const newVendor = { ...vendor, id: `v_${Date.now()}` };
    vendors.push(newVendor);
    this.saveVendors(userId, vendors);
    return newVendor;
  },

  updateVendor(userId: string, updated: Vendor): void {
    const vendors = this.getVendors(userId);
    const idx = vendors.findIndex(v => v.id === updated.id);
    if (idx !== -1) {
      vendors[idx] = updated;
      this.saveVendors(userId, vendors);
    }
  },

  deleteVendor(userId: string, vendorId: string): void {
    const vendors = this.getVendors(userId);
    const filtered = vendors.filter(v => v.id !== vendorId);
    this.saveVendors(userId, filtered);
  },

  // --- INTERESTED AUCTIONS & REMINDERS ---
  getInterestedAuctions(userId: string): string[] {
    const key = `usr_interested_${userId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  toggleInterestedAuction(userId: string, auctionId: string): boolean {
    const interested = this.getInterestedAuctions(userId);
    const index = interested.indexOf(auctionId);
    let active = false;
    if (index === -1) {
      interested.push(auctionId);
      active = true;
    } else {
      interested.splice(index, 1);
    }
    const key = `usr_interested_${userId}`;
    localStorage.setItem(key, JSON.stringify(interested));
    return active;
  },

  getReminderSettings(userId: string): ReminderSetting[] {
    const key = `usr_reminders_${userId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  saveReminderSettings(userId: string, settings: ReminderSetting[]): void {
    const key = `usr_reminders_${userId}`;
    localStorage.setItem(key, JSON.stringify(settings));
  },

  updateReminderDays(userId: string, auctionId: string, daysPrior: number, enabled: boolean): void {
    const settings = this.getReminderSettings(userId);
    const idx = settings.findIndex(s => s.auctionId === auctionId);
    const updated = {
      auctionId,
      daysPrior,
      enabled,
      timeValue: daysPrior,
      timeUnit: 'days' as const,
      remindersCount: 1
    };
    if (idx !== -1) {
      settings[idx] = { ...settings[idx], ...updated };
    } else {
      settings.push(updated);
    }
    this.saveReminderSettings(userId, settings);
  },

  updateReminderSettings(
    userId: string,
    auctionId: string,
    timeValue: number,
    timeUnit: 'minutes' | 'hours' | 'days',
    remindersCount: number,
    enabled: boolean
  ): void {
    const settings = this.getReminderSettings(userId);
    const idx = settings.findIndex(s => s.auctionId === auctionId);
    const updated = {
      auctionId,
      daysPrior: timeUnit === 'days' ? timeValue : 1,
      enabled,
      timeValue,
      timeUnit,
      remindersCount
    };
    if (idx !== -1) {
      settings[idx] = updated;
    } else {
      settings.push(updated);
    }
    this.saveReminderSettings(userId, settings);
  },

  // --- INVENTORY MANAGEMENT & REPORTING ---
  getAuctionInventory(userId: string, auctionId: string): AuctionInventory | null {
    const key = `usr_inv_${userId}_${auctionId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },

  initializeInventory(userId: string, auctionId: string, auctionTitle: string, referenceNumber: string, lotItems: any[]): AuctionInventory {
    const existing = this.getAuctionInventory(userId, auctionId);
    if (existing) return existing;

    const items: InventoryItem[] = lotItems && lotItems.length > 0
      ? lotItems.map((item, idx) => ({
          id: `item_${idx}_${Date.now()}`,
          description: item.description || `Lot item #${item.sr || idx + 1}`,
          qty: String(item.qty || '1'),
          unit: item.unit || 'LOT',
          checked: false,
          status: 'ok'
        }))
      : [
          { id: 'item_1', description: 'Industrial Metal Scrap (Heavy Melting)', qty: '12.5', unit: 'MT', checked: false, status: 'ok' },
          { id: 'item_2', description: 'Used Copper Wires & Cables', qty: '450', unit: 'KG', checked: false, status: 'ok' },
          { id: 'item_3', description: 'Aluminum Castings & Engine Blocks', qty: '5.2', unit: 'MT', checked: false, status: 'ok' }
        ];

    const inventory: AuctionInventory = {
      auctionId,
      auctionTitle,
      referenceNumber,
      items
    };

    this.saveAuctionInventory(userId, auctionId, inventory);
    return inventory;
  },

  saveAuctionInventory(userId: string, auctionId: string, inventory: AuctionInventory): void {
    const key = `usr_inv_${userId}_${auctionId}`;
    localStorage.setItem(key, JSON.stringify(inventory));
  },

  toggleInventoryItemCheck(userId: string, auctionId: string, itemId: string): AuctionInventory | null {
    const inventory = this.getAuctionInventory(userId, auctionId);
    if (!inventory) return null;

    const idx = inventory.items.findIndex(item => item.id === itemId);
    if (idx !== -1) {
      inventory.items[idx].checked = !inventory.items[idx].checked;
      
      // Auto-resolve issue check if checked as verified
      if (inventory.items[idx].checked && inventory.items[idx].status === 'reported') {
        inventory.items[idx].status = 'ok';
        delete inventory.items[idx].issue;
      }
      
      this.saveAuctionInventory(userId, auctionId, inventory);
    }
    return inventory;
  },

  reportInventoryIssue(
    userId: string,
    auctionId: string,
    itemId: string,
    issueType: string,
    description: string,
    severity: 'low' | 'medium' | 'high'
  ): AuctionInventory | null {
    const inventory = this.getAuctionInventory(userId, auctionId);
    if (!inventory) return null;

    const idx = inventory.items.findIndex(item => item.id === itemId);
    if (idx !== -1) {
      inventory.items[idx].status = 'reported';
      inventory.items[idx].checked = false; // Uncheck since there is an issue
      inventory.items[idx].issue = {
        type: issueType,
        description,
        severity,
        reportedAt: new Date().toISOString()
      };
      this.saveAuctionInventory(userId, auctionId, inventory);
    }
    return inventory;
  },

  resolveInventoryIssue(userId: string, auctionId: string, itemId: string): AuctionInventory | null {
    const inventory = this.getAuctionInventory(userId, auctionId);
    if (!inventory) return null;

    const idx = inventory.items.findIndex(item => item.id === itemId);
    if (idx !== -1) {
      inventory.items[idx].status = 'ok';
      delete inventory.items[idx].issue;
      this.saveAuctionInventory(userId, auctionId, inventory);
    }
    return inventory;
  },

  lockInventory(userId: string, auctionId: string): AuctionInventory | null {
    const inventory = this.getAuctionInventory(userId, auctionId);
    if (!inventory) return null;
    inventory.isLocked = true;
    inventory.verifiedAt = new Date().toISOString();
    this.saveAuctionInventory(userId, auctionId, inventory);
    return inventory;
  }
};
