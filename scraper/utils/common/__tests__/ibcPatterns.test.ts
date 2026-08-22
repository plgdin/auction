import { describe, it, expect } from "vitest";
import {
  extractCorporateDebtorName,
  extractCorporateDebtorCin,
  extractLiquidatorRegNo,
  extractLiquidatorEmail,
  extractNcltBench,
  extractNcltCaseNo,
  extractIBCMetadata,
  IBC_REGEX,
} from "../ibcPatterns.js";

describe("IBC / IBBI Insolvency Pattern Extractors (ibcPatterns.ts)", () => {
  describe("extractCorporateDebtorName", () => {
    it("extracts company in liquidation from various text formats", () => {
      const text1 = "Corporate Debtor: ACME Infrastructure Private Limited\nReserve Price: ₹ 1,00,00,000";
      expect(extractCorporateDebtorName(text1)).toBe("ACME Infrastructure Private Limited");

      const text2 = "Company in Liquidation : Apex Steel & Alloys Ltd.\nLocation: Mumbai";
      expect(extractCorporateDebtorName(text2)).toBe("Apex Steel & Alloys Ltd.");

      const text3 = "CD Name: Bharat Heavy Fabricators LLP";
      expect(extractCorporateDebtorName(text3)).toBe("Bharat Heavy Fabricators LLP");
    });

    it("returns empty string when no corporate debtor pattern exists", () => {
      expect(extractCorporateDebtorName("Standard Bank Foreclosure Notice")).toBe("");
      expect(extractCorporateDebtorName("")).toBe("");
    });
  });

  describe("extractCorporateDebtorCin", () => {
    it("extracts 21-character Corporate Identification Numbers (CIN)", () => {
      const text1 = "CIN: L12345MH2000PLC123456 registered in Mumbai";
      expect(extractCorporateDebtorCin(text1)).toBe("L12345MH2000PLC123456");

      const text2 = "Unlisted company CIN: U74999DL2018PTC333333";
      expect(extractCorporateDebtorCin(text2)).toBe("U74999DL2018PTC333333");
    });

    it("returns empty string when no valid CIN is present", () => {
      expect(extractCorporateDebtorCin("GSTIN 27AAAAA0000A1Z5")).toBe("");
      expect(extractCorporateDebtorCin("")).toBe("");
    });
  });

  describe("extractLiquidatorRegNo", () => {
    it("extracts IBBI insolvency professional registration numbers", () => {
      const text1 = "IP Reg No: IBBI/IPA-001/IP-P00123/2017-2018/10234";
      expect(extractLiquidatorRegNo(text1)).toBe("IBBI/IPA-001/IP-P00123/2017-2018/10234");

      const text2 = "Registration: IBBI/IPA-002/IP-N00045/2019-20/10987";
      expect(extractLiquidatorRegNo(text2)).toBe("IBBI/IPA-002/IP-N00045/2019-20/10987");
    });

    it("returns empty string when no IBBI registration is found", () => {
      expect(extractLiquidatorRegNo("Advocate High Court Reg: 12345")).toBe("");
      expect(extractLiquidatorRegNo("")).toBe("");
    });
  });

  describe("extractLiquidatorEmail", () => {
    it("extracts liquidator or resolution professional email addresses cleanly", () => {
      const text1 = "Liquidator Email: liquidator.acme@insolvency.in for process inquiries";
      expect(extractLiquidatorEmail(text1)).toBe("liquidator.acme@insolvency.in");

      const text2 = "RP Mail : rp_apex@advisorygroup.com";
      expect(extractLiquidatorEmail(text2)).toBe("rp_apex@advisorygroup.com");

      const text3 = "Contact IP at ip.kumar@resolution.org.in";
      expect(extractLiquidatorEmail(text3)).toBe("ip.kumar@resolution.org.in");
    });

    it("returns empty string when no email is found", () => {
      expect(extractLiquidatorEmail("Contact Liquidator at 9876543210")).toBe("");
      expect(extractLiquidatorEmail("")).toBe("");
    });
  });

  describe("extractNcltBench", () => {
    it("extracts NCLT Bench and Court jurisdiction names", () => {
      const text1 = "Order passed by NCLT Mumbai Bench - Court II on 12/01/2026";
      expect(extractNcltBench(text1)).toBe("NCLT Mumbai Bench - Court II");

      const text2 = "Hon'ble NCLT New Delhi Bench - Court-I";
      expect(extractNcltBench(text2)).toBe("NCLT New Delhi Bench - Court-I");

      const text3 = "NCLT Kolkata Bench";
      expect(extractNcltBench(text3)).toBe("NCLT Kolkata Bench");
    });

    it("returns empty string when no NCLT bench is present", () => {
      expect(extractNcltBench("DRT-II Debt Recovery Tribunal Mumbai")).toBe("");
      expect(extractNcltBench("")).toBe("");
    });
  });

  describe("extractNcltCaseNo", () => {
    it("extracts Company Petition (CP) and Company Application (CA) numbers", () => {
      const text1 = "Case No: CP (IB) No. 1234/MB/2020";
      expect(extractNcltCaseNo(text1)).toBe("CP (IB) No. 1234/MB/2020");

      const text2 = "Petition: CP(IB)/567/ND/2021";
      expect(extractNcltCaseNo(text2)).toBe("CP(IB)/567/ND/2021");

      const text3 = "In the matter of CA No. 45/2022";
      expect(extractNcltCaseNo(text3)).toBe("CA No. 45/2022");
    });

    it("returns empty string when no petition number is present", () => {
      expect(extractNcltCaseNo("Standard SARFAESI Section 13(4) notice")).toBe("");
      expect(extractNcltCaseNo("")).toBe("");
    });
  });

  describe("extractIBCMetadata", () => {
    it("extracts all available IBC metadata from a composite text block", () => {
      const sampleNotice = `
        E-AUCTION SALE NOTICE UNDER IBC, 2016
        Corporate Debtor: Zenith Metallics Private Limited
        CIN: U27100MH2005PTC154321
        Order passed by NCLT Mumbai Bench - Court-I
        Company Petition: CP (IB) No. 890/MB/2019
        Insolvency Professional: Shri Rajesh Sharma
        IP Registration No: IBBI/IPA-001/IP-P00567/2017-2018/10999
        Liquidator Email: zenith.liquidator@resolutionpros.in
        Reserve Price: ₹ 25,00,00,000
      `;

      const metadata = extractIBCMetadata(sampleNotice);
      expect(metadata.corporateDebtorName).toBe("Zenith Metallics Private Limited");
      expect(metadata.corporateDebtorCin).toBe("U27100MH2005PTC154321");
      expect(metadata.ncltBench).toBe("NCLT Mumbai Bench - Court-I");
      expect(metadata.ncltCaseNo).toBe("CP (IB) No. 890/MB/2019");
      expect(metadata.liquidatorRegNo).toBe("IBBI/IPA-001/IP-P00567/2017-2018/10999");
      expect(metadata.liquidatorEmail).toBe("zenith.liquidator@resolutionpros.in");
    });
  });
});
