import { supabase } from '../lib/supabase';
import type { EmdTransaction, WalletTransaction } from '../types/database.types';

export const paymentService = {
  // --------------------------------------------------------
  // WALLET OPERATIONS
  // --------------------------------------------------------

  async getWalletBalance(userId: string): Promise<{ available: number; blocked: number }> {
    // 1. Calculate Total Deposits - Total Withdrawals
    const { data: walletTx, error: wError } = await supabase
      .from('wallet_transactions')
      .select('amount, transaction_type, status')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (wError) {
      console.error('Error fetching wallet transactions:', wError);
      return { available: 0, blocked: 0 };
    }

    let totalBalance = 0;
    walletTx?.forEach(tx => {
      if (tx.transaction_type === 'deposit') totalBalance += tx.amount;
      if (tx.transaction_type === 'withdrawal') totalBalance -= tx.amount;
    });

    // 2. Calculate Blocked EMD (Active Holds)
    const { data: emdTx, error: eError } = await supabase
      .from('emd_transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'held');

    if (eError) {
      console.error('Error fetching EMD holds:', eError);
      return { available: totalBalance, blocked: 0 };
    }

    let blocked = 0;
    emdTx?.forEach(tx => blocked += tx.amount);

    return {
      available: totalBalance - blocked,
      blocked: blocked
    };
  },

  async getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wallet transactions:', error);
      return [];
    }
    return data;
  },

  // --------------------------------------------------------
  // EMD OPERATIONS
  // --------------------------------------------------------

  async getEmdTransactions(userId: string): Promise<EmdTransaction[]> {
    const { data, error } = await supabase
      .from('emd_transactions')
      .select('*, auction:auctions(title, reference_number)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching EMD transactions:', error);
      return [];
    }
    return data;
  },

  async processWalletDeposit(userId: string, amount: number, paymentMethod: string): Promise<{ success: boolean; transactionId?: string }> {
    // Mock processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const txRef = `DEP-${paymentMethod.toUpperCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const { data, error } = await supabase
      .from('wallet_transactions')
      .insert([{
        user_id: userId,
        amount,
        transaction_type: 'deposit',
        status: 'completed',
        reference_id: txRef,
        description: `Deposit via ${paymentMethod}`
      }])
      .select()
      .single();

    if (error) {
      console.error('Deposit error:', error);
      return { success: false };
    }

    // Also simulate creating a payment receipt
    await supabase.from('payment_receipts').insert([{
      user_id: userId,
      amount,
      description: `Wallet Deposit via ${paymentMethod}`,
      receipt_url: `receipt-${data.id}`
    }]);

    return { success: true, transactionId: data.id };
  },

  async checkEmdStatus(userId: string, auctionId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('emd_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('auction_id', auctionId)
      .eq('status', 'held')
      .maybeSingle();

    if (error) {
      console.error('Error checking EMD status:', error);
      return false;
    }
    return !!data;
  },

  async blockAuctionEmd(userId: string, auctionId: string, amount: number): Promise<{ success: boolean; message: string }> {
    // 1. Check available balance
    const balance = await this.getWalletBalance(userId);
    if (balance.available < amount) {
      return { success: false, message: 'Insufficient wallet balance. Please add funds.' };
    }

    // 2. Check if already blocked
    const alreadyBlocked = await this.checkEmdStatus(userId, auctionId);
    if (alreadyBlocked) {
      return { success: true, message: 'EMD already blocked.' };
    }

    // 3. Block EMD
    const { error } = await supabase
      .from('emd_transactions')
      .insert([{
        user_id: userId,
        auction_id: auctionId,
        amount,
        status: 'held',
        transaction_reference: `EMD-${auctionId.substring(0, 8)}-${Date.now()}`
      }]);

    if (error) {
      console.error('Error blocking EMD:', error);
      return { success: false, message: 'Failed to block EMD.' };
    }

    return { success: true, message: 'EMD successfully blocked.' };
  }
};
