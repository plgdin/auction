---
name: lelam.co
description: A calm, editorial home for secondhand pieces and their next life.
colors:
  primary: "#5d6446"
  primary-soft: "#eef0e4"
  ink: "#17150f"
  paper: "#f4f2ec"
  paper-deep: "#ebe8df"
  white: "#ffffff"
  line: "#e2ded4"
  muted: "#77746a"
  good: "#3f6b46"
  warm: "#8a6420"
  bad: "#8c3f33"
typography:
  display:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "clamp(44px, 5.2vw, 78px)"
    fontWeight: 400
    lineHeight: 0.99
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "clamp(36px, 3.8vw, 56px)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  body:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
rounded:
  sm: "7px"
  md: "12px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "22px"
  lg: "32px"
  section: "clamp(64px, 9vw, 120px)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "11px 22px"
    height: "48px"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "20px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
---

# Design System: lelam.co

## Overview

**Creative North Star: "The Cream Market Ledger"**

lelam's visual language pairs a warm, paper-like marketplace with the clarity of an editorial
ledger. Real product photography carries the emotional weight; serif headlines and restrained
olive accents give the interface its recognizable voice. White cards sit quietly on cream, divided
by fine rules rather than heavy panels.

The seller surfaces extend the same world: a fanned deck and handwritten notes on the sell landing,
then compact, scannable ledgers for daily operations. The market's warm character never comes at the
cost of task clarity.

**Key Characteristics:**
- Cream, ink, olive, and hairline borders.
- DM Serif Display headlines; DM Sans controls and body; Caveat for brief handwritten notes.
- Real product imagery, pill controls, and calm editorial spacing.

## Colors

Paper and ink establish the neutral field; muted olive is the primary accent, with restrained
semantic colors for status.

### Primary
- **Market Olive** ({colors.primary}): Main action, italic emphasis, active states, and progress.
- **Soft Olive** ({colors.primary-soft}): Quiet selected fills and supporting markers.

### Neutral
- **Ink** ({colors.ink}): Main type and high-contrast button fill.
- **Market Paper** ({colors.paper}): Warm editorial surface.
- **Deep Paper** ({colors.paper-deep}): Secondary warm surface.
- **White** ({colors.white}): Cards, fields, and clean reading surfaces.
- **Hairline** ({colors.line}): Dividers, card borders, and ledger rules.
- **Muted** ({colors.muted}): Secondary text; preserve readable contrast.
- **Good** ({colors.good}), **Warm** ({colors.warm}), **Bad** ({colors.bad}): Semantic state only.

**The One Olive Rule.** Use olive as a focused guide, not as a full-screen wash.

## Typography

**Display Font:** DM Serif Display (Georgia, serif)
**Body Font:** DM Sans (system sans-serif fallbacks)
**Label/Mono Font:** DM Sans for labels; ui-monospace for receipts and delivery slips.

**Character:** Serif display brings warmth and individuality; the sans body keeps forms and money
data direct. Caveat appears only as a brief human note, never for essential instructions.

### Hierarchy
- **Display** (400, responsive 44–78px, 0.99): Sell-page hero and primary identity moments.
- **Headline** (400, responsive 36–56px, 1.02): Section heads and major dashboard pages.
- **Title** (400–500, 18–26px): Cards, form steps, and ledger panels.
- **Body** (400, 15px, 1.5–1.75): Reading and instructions; keep paragraphs comfortably narrow.
- **Label** (500, 12.5px, tracked sparingly): Controls and secondary metadata. Seller-surface text
  must remain at least 12px.

**The Two-Voice Rule.** Serif for story and hierarchy; sans for operation. Handwriting is decorative,
never the only carrier of meaning.

## Layout

Use a centered content cap of 1240px with fluid page gutters. Editorial sections have generous
separation (`clamp(64px, 9vw, 120px)`); related data stays grouped inside compact cards. Desktop
seller surfaces use multi-column ledgers where they improve scanning. Below 980px, seller layouts
collapse to one column; mobile tabs scroll horizontally instead of shrinking labels. Keep the photo
deck layered and the listing form a distinct route from the marketing landing.

## Elevation & Depth

Depth is restrained and offset: cards use soft, directional shadows only when they need to lift
from the page; most hierarchy comes from warm tonal fields and hairline borders. Avoid decorative
zero-offset glows and heavy dashboard shadows.

## Shapes

Pills identify actions and selected filters. Cards use softly rounded corners (about 12–14px),
fields stay gently rounded (about 7px), and dashed rules are reserved for receipt-like delivery
details. Product photography is cropped cleanly and remains the primary material.

## Components

### Buttons
- **Shape:** Fully rounded pills (999px).
- **Primary:** Ink fill, white text, generous horizontal padding; seller-surface controls are at
  least 48px high.
- **Hover / Focus:** Small, restrained state changes; keep clear keyboard focus.
- **Secondary / Ghost:** White or transparent fill with a hairline outline.

### Chips
- **Style:** White fill, hairline border, compact pill silhouette.
- **State:** Selected chip switches to ink fill and white text; counts remain legible.

### Cards / Containers
- **Corner Style:** Softly rounded (12–14px).
- **Background:** White on paper; paper fill for receipts and explanatory panels.
- **Shadow Strategy:** Light, offset shadows only for lifted imagery or floating controls.
- **Border:** Hairline `line` token.
- **Internal Padding:** 18–28px desktop, 14–20px mobile.

### Inputs / Fields
- **Style:** White field, subtle neutral stroke, 7px radius; comfortable 16px text entry on seller
  forms.
- **Focus:** Darker border and restrained focus ring.
- **Error / Disabled:** Use semantic bad color and visibly reduced disabled emphasis.

### Navigation
- **Style:** Quiet segmented pill tabs; active tab uses ink fill. On narrow screens the strip scrolls
  horizontally and preserves tap targets.

### Signature seller elements
- **Photo deck:** Real listing images overlap as a small editorial fan; handwritten notes stay outside
  clipped image cards.
- **Money receipt:** Monospaced rows align price, fees, and seller proceeds like a printed tally.
- **Shipment rail:** Hairline progress track with olive progress and explicit step labels.

## Do's and Don'ts

### Do:
- **Do** keep the paper/ink/olive palette and DM Serif Display + DM Sans pairing.
- **Do** use product photography as the primary visual material.
- **Do** keep seller text at 12px or larger and controls easy to tap.
- **Do** let borders, spacing, and type hierarchy do most of the organizing.

### Don't:
- **Don't** add a new accent palette or replace the editorial type pairing without a deliberate brand change.
- **Don't** rely on tiny metadata, decorative handwriting, or color alone to communicate a task state.
- **Don't** turn the seller dashboard into a generic dense grid of dark panels.
