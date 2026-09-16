import { describe, it, expect } from "vitest";
import {
  parseGemNoticeHtml,
  parseGeMDate,
  parseGeMLocation,
  normalizeGeMAuctionStatus,
  classifyGeMListing,
} from "../parsers/gem/gemParser.js";
import { gemListingSchema } from "../schemas/gemListingSchema.js";

describe("GeM Parser & Schema Suite", () => {
  describe("parseGeMDate", () => {
    it("parses full DD-MM-YYYY HH:mm:ss format with IST offset", () => {
      expect(parseGeMDate("28-10-2026 09:00:00")).toBe("2026-10-28T09:00:00+05:30");
      expect(parseGeMDate("02/11/2026 17:00:00")).toBe("2026-11-02T17:00:00+05:30");
    });

    it("parses DD-MM-YYYY HH:mm format", () => {
      expect(parseGeMDate("17-09-2026 09:00")).toBe("2026-09-17T09:00:00+05:30");
    });

    it("returns null for invalid strings", () => {
      expect(parseGeMDate(null)).toBeNull();
      expect(parseGeMDate("")).toBeNull();
      expect(parseGeMDate("Not a date")).toBeNull();
    });
  });

  describe("normalizeGeMAuctionStatus", () => {
    it("correctly identifies live/active statuses", () => {
      expect(normalizeGeMAuctionStatus("Live Auction")).toBe("live");
      expect(normalizeGeMAuctionStatus("Active")).toBe("live");
      expect(normalizeGeMAuctionStatus("In Progress")).toBe("live");
    });

    it("correctly identifies upcoming statuses", () => {
      expect(normalizeGeMAuctionStatus("Upcoming Auction")).toBe("upcoming");
      expect(normalizeGeMAuctionStatus("Scheduled")).toBe("upcoming");
    });

    it("correctly identifies closed and cancelled statuses", () => {
      expect(normalizeGeMAuctionStatus("Closed Auction")).toBe("closed");
      expect(normalizeGeMAuctionStatus("Ended")).toBe("closed");
      expect(normalizeGeMAuctionStatus("Cancelled")).toBe("cancelled");
    });

    it("returns null on unrecognizable status text", () => {
      expect(normalizeGeMAuctionStatus("Random String")).toBeNull();
    });
  });

  describe("parseGemNoticeHtml", () => {
    const sampleNoticeHtml = `
      <div class="main_containt">
        <h3 class="epf-form_title">General Detail</h3>
        <div class="form-group">
          <label class="control-label col-sm-6 position-relative word-break-word caption">Office/Zone<span class="floatright"> :</span></label>
          <div class="ref-dept col-sm-6">
            <div class="department">
              <span class="x-dept-name">Ministry of Electronics and Information Technology</span>
              <br>&nbsp;&nbsp;&nbsp;<b>-</b><span class="x-dept-name">STQC Directorate</span>
              <br>&nbsp;&nbsp;&nbsp;-<span class="x-dept-name">Electronics Test and Development Centre</span>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="control-label col-sm-6 caption">Seller/Auctioneer Name<span class="floatright"> :</span> </label>
          <div class="col-sm-6">
            <label class="control-label text-wrap">Shivam Tyagi-Auctioneer</label>
          </div>
        </div>
        <div class="form-group">
          <label class="control-label col-sm-6 caption">Reference No.<span class="floatright"> :</span> </label>
          <div class="col-sm-6">
            <label class="control-label word-break-word">ETDC/Sol/Store/Disposal/120/2023</label>
          </div>
        </div>
        <div class="form-group">
          <label class="control-label col-sm-3 position-relative caption">Category<span class="floatright"> :</span> </label>
          <div class="col-sm-9">
            <label class="control-label word-break-word">e-Waste</label>
          </div>
        </div>
        <div class="form-group">
          <label class="control-label col-sm-3 position-relative caption">Auction Brief<span class="floatright"> :</span> </label>
          <div class="col-sm-9">
            <label class="control-label text-wrap">DISPOSAL OF UNSERVICEABLE STORE ITEMS (ELECTRICAL MISCELLANEOUS AND E-WASTE)</label>
          </div>
        </div>
        <div class="form-group">
          <label class="control-label col-sm-3 position-relative caption">Auction Detail<span class="floatright"> :</span> </label>
          <div class="col-sm-9">
            <label class="control-label text-wrap">DISPOSAL OF STORE ITEMS. Contact: 9876543210 or officer@etdc.gov.in for inspection.</label>
          </div>
        </div>

        <div class="row">
          Project Location - Pin Code :
          <table>
            <tr><th>#</th><th>Pin Code</th><th>City</th><th>District</th><th>State</th></tr>
            <tr><td>1</td><td>173213</td><td>Solan</td><td>Solan</td><td>HIMACHAL PRADESH</td></tr>
          </table>
        </div>

        <div class="row">
          <label class="control-label col-sm-6 caption">Allow EMD<span class="floatright"> :</span></label>
          <div class="col-sm-6"><label class="control-label"> Yes </label></div>
          <label class="control-label col-sm-6 caption">EMD Mode<span class="floatright"> :</span></label>
          <div class="col-sm-6"><label class="control-label"> Offline </label></div>
          <label class="control-label col-sm-6 caption">EMD<span class="floatright"> :</span></label>
          <div class="col-sm-6"><label class="control-label"> 1,900.00 </label></div>
          <label class="control-label col-sm-6 caption">EMD Payment Start Date<span class="floatright"> :</span></label>
          <div class="col-sm-6"><label class="control-label"> 17/09/2026 09:00 </label></div>
          <label class="control-label col-sm-6 caption">EMD Payment End Date<span class="floatright"> :</span></label>
          <div class="col-sm-6"><label class="control-label"> 12/10/2026 17:00 </label></div>
        </div>

        <div class="row">
          <label class="control-label col-sm-6 caption">Auction Start Date & Time<span class="floatright"> :</span></label>
          <div class="col-sm-6"><label class="control-label"> 28/10/2026 09:00 </label></div>
          <label class="control-label col-sm-6 caption">Auction End Date & Time<span class="floatright"> :</span></label>
          <div class="col-sm-6"><label class="control-label"> 02/11/2026 17:00 </label></div>
          <label class="control-label col-sm-6 caption">Auto Extension<span class="floatright"> :</span></label>
          <div class="col-sm-6"><label class="control-label"> Not Applicable </label></div>
          <label class="control-label col-sm-6 caption">Bidding Template<span class="floatright"> :</span></label>
          <div class="col-sm-6"><label class="control-label"> e-Waste </label></div>
          <label class="control-label col-sm-6 caption">Bidding Access<span class="floatright"> :</span></label>
          <div class="col-sm-6"><label class="control-label"> Open </label></div>
          <label class="control-label col-sm-6 caption">Item wise Time<span class="floatright"> :</span></label>
          <div class="col-sm-6"><label class="control-label"> No </label></div>
        </div>

        <table>
          <tr><th>#</th><th>Items</th><th>Qty</th><th>Purchased Year</th><th>Brand Name</th></tr>
          <tr><td>1</td><td>Desktop CPUs</td><td>52</td><td>2017</td><td>Acer</td></tr>
          <tr><td>HP</td></tr>
          <tr><td>2</td><td>Laser Printers</td><td>14</td><td>2018</td><td>Canon</td></tr>
        </table>

        <a href="/eprocure/download-corrigendum/101">Corrigendum 1</a>
      </div>
    `;

    it("extracts all structured fields from notice HTML", () => {
      const parsed = parseGemNoticeHtml(sampleNoticeHtml);

      expect(parsed.ministry).toBe("Ministry of Electronics and Information Technology");
      expect(parsed.department).toBe("STQC Directorate");
      expect(parsed.organisation).toBe("Electronics Test and Development Centre");
      expect(parsed.seller_name).toBe("Shivam Tyagi");
      expect(parsed.seller_role).toBe("Auctioneer");
      expect(parsed.reference_no).toBe("ETDC/Sol/Store/Disposal/120/2023");
      expect(parsed.category_name).toBe("e-Waste");
      expect(parsed.pin_code).toBe("173213");
      expect(parsed.city).toBe("Solan");
      expect(parsed.district).toBe("Solan");
      expect(parsed.state).toBe("HIMACHAL PRADESH");
      expect(parsed.emd_amount).toBe(1900);
      expect(parsed.emd_mode).toBe("Offline");
      expect(parsed.emd_start_date).toBe("2026-09-17T09:00:00+05:30");
      expect(parsed.emd_end_date).toBe("2026-10-12T17:00:00+05:30");
      expect(parsed.auction_start_date).toBe("2026-10-28T09:00:00+05:30");
      expect(parsed.auction_end_date).toBe("2026-11-02T17:00:00+05:30");
      expect(parsed.auto_extension).toBe("Not Applicable");
      expect(parsed.bidding_template).toBe("e-Waste");
      expect(parsed.bidding_access).toBe("Open");
      expect(parsed.item_wise_time).toBe("No");
      expect(parsed.contact_phone).toBe("9876543210");
      expect(parsed.contact_email).toBe("officer@etdc.gov.in");

      expect(parsed.items_schedule).toBeDefined();
      expect(parsed.items_schedule?.length).toBe(2);
      expect(parsed.items_schedule?.[0]).toEqual({
        item_no: "1",
        item_name: "Desktop CPUs",
        quantity: "52",
        purchased_year: "2017",
        brand_name: "Acer; HP",
      });
      expect(parsed.items_schedule?.[1]).toEqual({
        item_no: "2",
        item_name: "Laser Printers",
        quantity: "14",
        purchased_year: "2018",
        brand_name: "Canon",
      });

      expect(parsed.corrigendum_urls).toEqual(["/eprocure/download-corrigendum/101"]);
    });

    it("validates parsed data through gemListingSchema without errors", () => {
      const parsed = parseGemNoticeHtml(sampleNoticeHtml);

      const listing = {
        gem_auction_id: "40424",
        title: parsed.auction_brief || "Auction Title",
        source_url: "https://forwardauction.gem.gov.in/eprocure/view-auction-notice/40424",
        category_name: parsed.category_name || "e-Waste",
        location: `${parsed.city}, ${parsed.state}`,
        state: parsed.state,
        city: parsed.city,
        district: parsed.district,
        pincode: parsed.pin_code,
        auction_start_date: parsed.auction_start_date,
        auction_end_date: parsed.auction_end_date,
        auction_status: "live",
        emd_amount: parsed.emd_amount,
        emd_mode: parsed.emd_mode,
        emd_start_date: parsed.emd_start_date,
        emd_end_date: parsed.emd_end_date,
        reference_no: parsed.reference_no,
        seller_name: parsed.seller_name,
        contact_phone: parsed.contact_phone,
        contact_email: parsed.contact_email,
        bidding_access: parsed.bidding_access,
        item_wise_time: parsed.item_wise_time,
        auto_extension: parsed.auto_extension,
        bidding_template: parsed.bidding_template,
        items_schedule: parsed.items_schedule,
        corrigendum_urls: parsed.corrigendum_urls,
      };

      const result = gemListingSchema.safeParse(listing);
      expect(result.success).toBe(true);
    });
  });
});
