# Professional quote PDF

## Goal

Replace the current plain-text quote PDF with a professional, legible,
multi-page document inspired by the supplied reference while retaining a
neutral visual identity that works for every establishment.

The public `QuotePdfGenerator.generate(quote)` contract remains unchanged. The
change does not add endpoints, alter API payloads, modify the quote domain, or
require a database migration.

## Visual direction

Use an editorial, institutional layout on an A4 white page. The palette is
limited to black, graphite, and light gray so the establishment logo remains
the primary brand element. Typography, spacing, rules, and subtle background
fills create hierarchy without decorative color.

The document contains these sections in order:

1. Institutional header with the establishment logo on the left and the
   `ORÇAMENTO` title, issue date, and expiration date on the right.
2. Establishment name, legal business name, CNPJ, and complete available
   address.
3. Side-by-side customer and vehicle summaries.
4. Services table with description, optional category and duration metadata,
   and value.
5. Financial summary with subtotal and total courtesy value.
6. Detailed payment options.
7. Separate observations and terms-and-conditions sections when populated.
8. A discreet footer with issue date, expiration date, and page numbering.

The logo uses `quote.establishment.bannerImageUrl`, is rendered at the top
without cropping, and preserves its aspect ratio. Courtesy services display a
clear `CORTESIA` badge and their original value while contributing zero to the
subtotal.

Optional category and duration appear as secondary service metadata. Missing
optional sections are omitted. A required contextual value that is absent is
shown as `Não informado` only when omitting it would make its block ambiguous.

## Content and formatting

Format currency in Brazilian reais and format dates, phone numbers, CNPJ,
CPF/CNPJ, addresses, and service durations for Brazilian readers. Issue and
expiration dates use the `America/Sao_Paulo` calendar, consistent with the
quote module's existing day-based expiration behavior.

Each payment option includes every available business detail:

- user-defined label;
- payment method;
- number of installments;
- whether the installments are interest-free;
- percentage or fixed-amount discount, when present;
- calculated final total.

The renderer accepts arbitrary numbers of services and payment options. Content
flows to additional pages as necessary. Page breaks must not split a row or
allow content to overlap the footer. The services table header repeats after a
page break.

## Architecture

Keep the existing application gateway and use case unchanged. Refactor the
PDFKit implementation into focused internal responsibilities:

- the generator coordinates logo loading and document lifecycle;
- formatting helpers produce presentation-ready values;
- a layout component owns page geometry, available-space checks, page breaks,
  table headers, and footers;
- section renderers own establishment, customer/vehicle, services, financial
  summary, payment options, observations, and terms.

These units remain infrastructure concerns and depend on the immutable quote
snapshot rather than repositories or live establishment/customer records.

## Logo loading and error handling

Load the remote logo before beginning synchronous PDF rendering. Apply a
request timeout and validate the response status, supported image media type,
and a bounded payload size before handing the buffer to PDFKit.

Logo loading is best-effort. A missing URL, timeout, unsuccessful response,
unsupported or corrupt image, or other download failure must not prevent PDF
generation. In these cases, render a neutral monogram alongside the
establishment name. A failure elsewhere in document rendering continues to
reject `generate`, preserving the current gateway semantics.

## Validation

Add automated coverage for:

- a valid PDF containing all supported sections and populated fields;
- safe omission of absent optional data;
- courtesy service values and totals;
- percentage and fixed-amount discounts;
- installment and interest information;
- successful logo loading;
- fallback rendering for unavailable or invalid logos;
- multiple pages without section, table, or footer overlap;
- Brazilian currency, document, phone, duration, and date formatting;
- issue and expiration dates at `America/Sao_Paulo` calendar boundaries.

Generate representative short and long sample PDFs during implementation.
Convert them to images and inspect logo proportions, hierarchy, contrast,
alignment, spacing, table continuity, and page breaks. Report only checks
actually run.

## Out of scope

- User-configurable PDF themes or colors.
- Editing quote data from the PDF flow.
- Persisting a separate logo asset on the quote.
- Adding digital signatures, acceptance controls, QR codes, or new financial
  calculations.
