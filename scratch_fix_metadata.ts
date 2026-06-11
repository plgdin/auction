import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const regionMap: Record<string, string> = {
  LKO: 'Uttar Pradesh',
  ERO: 'West Bengal',
  CDG: 'Punjab & Haryana',
  JPR: 'Rajasthan',
  BBR: 'Odisha',
  RNC: 'Jharkhand',
  SRO: 'Tamil Nadu',
  VZG: 'Andhra Pradesh',
  BPL: 'Madhya Pradesh',
  WRO: 'Maharashtra',
  BLR: 'Karnataka',
  TVC: 'Kerala',
  RPR: 'Chhattisgarh',
  VAD: 'Gujarat',
  NRO: 'Delhi & NCR',
  GHY: 'Assam & North East',
  HYD: 'Telangana'
};

async function fixMetadata() {
  console.log('Fetching all MSTC auctions to clean metadata...');
  
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, seller_name, location');

  if (error) {
    console.error('Error fetching auctions:', error.message);
    return;
  }

  if (!records || records.length === 0) {
    console.log('No records found.');
    return;
  }

  console.log(`Processing ${records.length} records...`);

  let updatedCount = 0;

  for (const record of records) {
    const parts = record.mstc_auction_number.split('/');
    let updatedSeller = record.seller_name;
    let updatedLocation = record.location;

    // Parse Seller Name: 3rd part (index 2)
    if (parts.length > 2 && (record.seller_name === 'MSTC Seller' || !record.seller_name)) {
      const parsedSeller = parts[2].trim();
      if (parsedSeller) {
        updatedSeller = parsedSeller;
      }
    }

    // Parse Region Location: 2nd part (index 1)
    if (parts.length > 1 && (record.location === 'Pan India' || record.location === 'India' || !record.location)) {
      const region = parts[1].toUpperCase().trim();
      const parsedLocation = regionMap[region] || region;
      if (parsedLocation) {
        updatedLocation = parsedLocation;
      }
    }

    // Only update if there is a change
    if (updatedSeller !== record.seller_name || updatedLocation !== record.location) {
      const { error: updateError } = await supabase
        .from('mstc_auctions')
        .update({
          seller_name: updatedSeller,
          location: updatedLocation
        })
        .eq('id', record.id);

      if (updateError) {
        console.error(`Error updating record ${record.id}:`, updateError.message);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Successfully updated metadata for ${updatedCount} records.`);
}

fixMetadata();
