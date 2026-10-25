---
version: alpha
name: ByteStore Violet Studio
description: One visual system for the computer store, native Android shop and desktop administration apps.
colors:
  primary: "#6332CC"
  background: "#F5F3FA"
  surface: "#FFFFFF"
  text: "#241D35"
  muted: "#71647F"
  success: "#18654F"
  danger: "#AB2C49"
  lightBackground: "#18141F"
  lightPrimary: "#BF9AFF"
typography:
  display:
    fontFamily: "Manrope, Inter, sans-serif"
    fontWeight: 700
  body:
    fontFamily: "Inter, Segoe UI, Arial, sans-serif"
    fontSize: "15px"
    lineHeight: 1.6
  utility:
    fontFamily: "Inter, Segoe UI, Arial, sans-serif"
rounded:
  DEFAULT: "12px"
  card: "22px"
  badge: "7px"
spacing:
  unit: "4px"
  pageMax: "1320px"
  controlHeight: "44px"
components:
  button:
    rounded: "12px"
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
  card:
    rounded: "22px"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
  input:
    rounded: "12px"
    textColor: "{colors.text}"
  caption:
    textColor: "{colors.muted}"
  statusSuccess:
    textColor: "{colors.success}"
  statusDanger:
    textColor: "{colors.danger}"
  lightCard:
    backgroundColor: "{colors.lightBackground}"
  lightButton:
    backgroundColor: "{colors.lightPrimary}"
---

# ByteStore design system

## Overview

The reference is a computer workbench: legible component labels, precise module edges and a saturated violet signal on warm white work surfaces. Customers find parts and assemble a PC; staff manage the same catalogue and orders. Russian UI, Kazakhstan market, KZT currency, Asia/Almaty are established by the user and README; there is no Japan-market scope.

The website home is a brand/storefront surface; catalogue, account, checkout and all admin screens are product surfaces. Android remains a shopping app with search, categories and grouped profile navigation, following the user's DNS examples. Never move website marketing headings into the native app.

The signature is a **socket edge**: a violet selection plane marks an active navigation item or focused module. Everywhere else, quiet tonal planes replace neon glow and floating cards. The risk is restraint in a hardware shop: strong geometric display type and data alignment carry the identity instead of gaming gradients.

Rejected directions: warm editorial/serif layouts; acid-green terminal aesthetics; indiscriminate glass and cyan/violet gradients; decorative numbered steps; identical information density across phone and administration tables.

Runtime values are owned by `design/tokens.json`; this file records the accepted visual decision. `design/generate.py` deterministically emits `css/brand-tokens.css`, Android `BrandTokens.java` and color resources, Windows `app/theme.json`, macOS `Sources/BrandTheme.swift`, and copies the canonical fonts from `css/fonts` into Android assets. `python3 design/generate.py --check` rejects drift. `css/brand-system.css` and Android `Ui.java` own component recipes. No independent palette copies are permitted.

## Colors

Warm white, graphite text and saturated violet actions are the default across platforms. Violet indicates primary actions, selection and focus; green, amber and red retain success/warning/danger meaning. Optional web/Android dark theme uses plum graphite surfaces and lavender accents. Complete semantic palette values are in the runtime source. Category icons remain differentiated by shape and text, never by color alone.

## Typography

Manrope is used with restraint for headings, prices and key data. Inter owns body text, controls and dense tables. Both bundled families support Cyrillic. Existing monospace fallback remains for literal code/SKUs only. Numbers use tabular figures where comparison matters. No uppercase paragraph copy, cramped tracking or oversized mobile marketing headlines.

## Layout

Preserve existing navigation, filters, routing, ordering, forms, responsive breakpoints and app-native conventions. The shared rhythm follows the established 4px system. Web container is at most 1320px; mobile controls stay comfortably touchable. Desktop administration has tighter rows than shopper cards. Forms retain natural scrolling and tables retain their existing overflow owner. Preserve the proven 320–1440px responsive fixes.

## Elevation & Depth

Use tonal surface separation and restrained borders. Shadows belong to dialogs, tooltips and transient overlays, not every card. Remove static glows and radial decoration from functional screens. Keep focus rings visible; never use clipping to hide overflow.

## Shapes

Controls: 12px radius; product/card/panel surfaces: 22px; badges: 7px. Dense administration panels use 18px and table frames 12px. Slot-edge emphasis belongs to active/focused elements only. Existing status dots, avatar circles, QR codes and chart geometry are semantic exceptions.

## Components

Shared web recipes cover buttons, fields, cards, tables, navigation, modal/drawer surfaces and feedback. Android adapts the same colors/type/shapes in native `Ui`; no WebView is introduced. Both desktop packages bundle the identical web styles and fonts.

Buttons retain labels, click targets, busy/disabled semantics and action outcomes. Primary actions are flat violet with contrasting text. Danger actions remain visually separate and preserve their confirmations. Hover changes border/tone rather than moving controls. Focus is a visible violet ring; native pressed state uses platform ripple. Read-only/disabled/pending content is not mistaken for a primary action.

Fields use stable padding, surface fills and focus borders. Existing native selects, dates and Android dialogs remain OS-owned controls; do not rewrite their behavior for visual uniformity. Existing web modal/drawer/tooltip owners remain authoritative. Overlay order, focus handling and dismissal are unchanged.

The global owned-scrollbar baseline applies automatically to scroll regions, with system-operable forced colors. Reduced motion removes decorative transitions; existing meaningful progress indicators remain.

Existing chip/CPU line icon shapes and approved launcher icons are retained. Only palette treatment is shared. System title bars, menus, pickers and permission dialogs remain platform-native. Chart category/status colors remain semantically distinguishable.

## Do's and Don'ts

- Do derive values from the canonical source and regenerate every adapter.
- Do keep the Android shopping structure and the desktop administration density.
- Do test light/dark, long Russian labels, overlays and touch/keyboard focus.
- Don't change purchasing, stock checks, accounts, API calls, payment simulation, permissions, save/delete or navigation behavior during this visual-only task.
- Don't invent ratings, promotions, stock, legal copy, or success states to decorate a design.

## Revised direction after user review

The user rejected a subtle navy recolor. Violet Studio is a visible change: light workspace, violet controls, rounded white merchandise cards with inset image wells, larger editorial headings, numbered native configurator modules and a distinct admin selection plane. Manrope/Inter and the approved logos remain. Android keeps native shopping navigation; manual assembly is now the default. This supersedes earlier Circuit Blue taste decisions.

## Native Android administration

ByteStore Admin is a separate staff product surface. It follows the same Violet Studio palette, Inter/Manrope type and light/dark/system themes. Four stable navigation targets (overview, products, orders, more) replace desktop sidebar density. Stock and order states lead each operational card; edits use labeled native fields with separate safe/destructive actions. The approved copper staff icon distinguishes the launcher from the shopper chip logo. `design/generate.py` generates staff palette/font adapters and the package-local copy of the canonical native `Ui.java`; there is no runtime link to the customer app.
