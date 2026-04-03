**🔩 FOUNDRY**

**Product Procurement Module**

Master PRD · v1.2 · Consolidated Edition

Part of 🌌 Cosmos ERP · Eyewoot Retail OS

  -----------------------------------------------------------------------
  **Module**         **Foundry --- Product Procurement**
  ------------------ ----------------------------------------------------
  Parent System      Cosmos ERP (apps/foundry --- Turborepo)

  Version            1.2 --- Consolidated Master PRD (covers v1.0, v1.1,
                     v1.2 + sub-modules)

  Product Types      Frames · Sunglasses · Readers · Zero Power

  Source Types       Local Supplier · Direct Brand · Import · In-house /
                     Private Label

  SKU Generation     Auto: Brand Code + Collection Code + Colour Code

  Warehouse          One central HQ warehouse

  Project Lead       Talha Junani

  Date               8 March 2026 · Confidential --- Eyewoot Optical
                     Internal Use Only
  -----------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **🔩 The Foundry Procurement Pipeline**                               |
+-----------------------------------------------------------------------+
| Stage 1 --- Purchase Registration: Log the purchase --- maker,        |
| brand/home brand, source & EW collection, rate, qty, transport, GST.  |
|                                                                       |
| Stage 2 --- Bill Verification: Enter supplier bill. System            |
| auto-calculates expected total. Reconcile. Approve to proceed.        |
|                                                                       |
| Stage 3 --- Branding: Ship to in-house branding team. Receive back.   |
| Verify count. (Mandatory for Local Supplier --- non-bypassable.)      |
|                                                                       |
| Bypass: For ready-branded products (Direct Brand / Import) --- skip   |
| branding, jump directly to Digitisation.                              |
|                                                                       |
| Stage 4 --- Digitisation: Break inventory model × colour. Capture     |
| photos, videos, specs, measurements. Generate SKUs + barcodes.        |
|                                                                       |
| Stage 5 --- Warehouse Ready: Product is live. Available for store     |
| transfer, D2C sale via Eyewoot Go, or promoter hold.                  |
|                                                                       |
| Sub-modules: SKU Stock Distribution View · Vendor & Product Rate      |
| Intelligence                                                          |
+-----------------------------------------------------------------------+

**1. Module Overview**

The Foundry Procurement module is the entry gate of every physical
product into the Cosmos ecosystem. From the moment a purchase is
registered to the moment a product is warehouse-ready, every step is
tracked, verified, and linked --- creating a complete, auditable chain
from supplier invoice to digital SKU.

The module is built around a key insight: most products repeat. A brand
and collection bought once will be bought again. The system learns from
every procurement cycle --- the second time you buy a collection, every
branding instruction, every product description, every photo template,
and every historical purchase rate is recalled automatically. Work done
once. Used forever.

**2. Source Types & Identity Rules**

Foundry handles four source types. The critical distinction: for Local
Supplier, the public-facing brand identity is always an Eyewoot Home
Brand --- the real supplier is never shown publicly. For all other
source types, the brand name is the public identity.

  ------------------------------------------------------------------------------
  **Field**     **Local Supplier **Direct       **Import /        **In-house /
                (Home Brand)**   Brand**        International**   Private
                                                                  Label**
  ------------- ---------------- -------------- ----------------- --------------
  Maker         Real local       = Brand (same  Import agent /    Eyewoot
  (Supplier)    supplier ---     entity)        overseas supplier production
                internal only                                     unit

  Public Brand  Home Brand (e.g. Brand name     Brand name (e.g.  Home Brand
                EW Studio)       (e.g. Ray-Ban) Carrera)          (e.g. EW
                                                                  Studio)

  Home Brand    ✅ Required ---  --- Not        --- Not           ✅ Required
  field         fixed dropdown   applicable     applicable        --- fixed
                                                                  dropdown

  Source        ✅ Supplier\'s   --- Not        --- Not           --- Not
  Collection    name ---         applicable     applicable        applicable
                internal only                                     

  EW Collection ✅ Eyewoot\'s    = Supplier     = Supplier        ✅ Eyewoot\'s
                public name      collection     collection name   public name
                                 name                             

  Public        Home Brand + EW  Source Brand + Source Brand + EW Home Brand +
  catalogue     Collection       EW Collection  Collection        EW Collection
  shows                                                           

  Branding      ✅ Always ---    Depends on     Depends on        ✅ Always
  required      mandatory,       product        product           
                non-bypassable                                    

  Repeat        Maker + Home     Source Brand + Source Brand + EW Home Brand +
  detection key Brand + Source   EW             Collection +      EW
                Collection + EW  Collection +   Style             Collection +
                Collection +     Style                            Style
                Style                                             
  ------------------------------------------------------------------------------

**2.1 Three-Layer Identity (Local Supplier)**

Every Local Supplier purchase carries three distinct identity layers.
Each has its own audience, use case, and data field.

  ---------------------------------------------------------------
  **Layer**    **Maker        **Source            **EW
               Identity**     Collection**        Collection**
  ------------ -------------- ------------------- ---------------
  What it is   The real       Supplier\'s own     Eyewoot\'s
               supplier who   collection name --- given
               physically     as on their invoice collection name
               makes the                          --- used in our
               product                            catalogue

  Example      ABC Optics,    \"Classic TR-90     \"Botanica
               Moradabad      Series\"            Series\"

  Visible      ✅ Super       ✅ Super Admin +    ✅ All roles
  internally   Admin +        Procurement Mgr     
               Procurement    only                
               Mgr only                           

  Visible      ❌ Never       ❌ Never            ✅ POS ·
  publicly                                        Eyewoot Go ·
                                                  Promoter ·
                                                  Receipts

  DB field     maker_id FK →  source_collection   ew_collection
               suppliers      (text)              (text)
  ---------------------------------------------------------------

+-----------------------------------------------------------------------+
| **💡 Why Both Collection Fields Must Be Recorded**                    |
+-----------------------------------------------------------------------+
| Reordering: Procurement calls the supplier using THEIR collection     |
| name --- not Eyewoot\'s. \"I need 200 more of your Classic TR-90      |
| Series in black.\"                                                    |
|                                                                       |
| Invoice Matching: Supplier bills reference their collection name.     |
| Bill verification cross-references Source Collection.                 |
|                                                                       |
| Quality Disputes: Supplier communication references Source            |
| Collection.                                                           |
|                                                                       |
| Brand Integrity: EW Collection name never appears on external         |
| procurement documents sent to the supplier.                           |
+-----------------------------------------------------------------------+

**2.2 Home Brand Master List**

Home Brands are a fixed list managed exclusively in Command Unit by
Super Admin. Staff selecting Local Supplier source type sees a dropdown
--- they cannot free-type a new brand name. This ensures brand naming
consistency across all purchases and modules.

  -----------------------------------------------------------------------
  **Feature**        **Specification**
  ------------------ ----------------------------------------------------
  Create Home Brand  Super Admin enters: Brand Name (display), Brand Code
                     (3--4 chars for SKU prefix), Brand Description,
                     Brand Logo URL (for label files).

  Fixed Selection    Local Supplier source type shows dropdown of active
                     Home Brands only. No free-text entry. Prevents typos
                     and rogue brand names.

  Brand Code in SKU  Home Brand Code is the first segment of the SKU.
                     e.g. EWS-BOTAN-TRNBLU for EW Studio.

  Multiple Brands    Eyewoot can operate any number of Home Brands. Each
                     is independent --- separate SKU namespace, separate
                     catalogue section.

  Deactivate Brand   Super Admin deactivates. Existing SKUs retain their
                     brand identity. No new purchases can use a
                     deactivated brand.
  -----------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **🔒 The Golden Rule --- Supplier Confidentiality**                   |
+-----------------------------------------------------------------------+
| The real supplier\'s name NEVER appears in the public-facing          |
| catalogue, on POS receipts, in Eyewoot Go, or in the Promoter app.    |
|                                                                       |
| Internally, the Maker is recorded on every purchase for reordering,   |
| cost tracking, and quality accountability.                            |
|                                                                       |
| Only Super Admin and Procurement Manager can see the Maker and Source |
| Collection fields.                                                    |
|                                                                       |
| The SKU code uses Home Brand code --- not the supplier code. e.g.     |
| EWS-BOTAN-TRNBLU.                                                     |
+-----------------------------------------------------------------------+

**3. Repeat Product Intelligence**

This is the feature that separates Foundry from a basic inventory tool.
Every product belongs to a unique combination of identifiers. The first
time this combination enters the system, the team does the full work.
Every subsequent time, the system detects the repeat and offers instant
recall.

**3.1 How Repeat Detection Works**

-   **Staff enters:** Maker, Source Type, Home Brand (if applicable),
    Source Collection (if Local Supplier), EW Collection, Style/Model.

-   **System performs exact match query** on product_master using the
    source-type-specific repeat key.

-   **If match found:** system shows REPEAT PRODUCT banner with full
    history summary.

-   **Staff selects:** Reuse All, Reuse Some, or Start Fresh.

-   **If Start Fresh:** previous data archived, new cycle begins ---
    previous history still viewable.

  ------------------------------------------------------------------------
  **Source Type** **Repeat Detection Key**   **Why**
  --------------- -------------------------- -----------------------------
  Local Supplier  Maker ID + Home Brand ID + Maker included so the same
  (Home Brand)    Source Collection + EW     collection name from two
                  Collection + Style/Model   different suppliers creates
                                             two separate product
                                             histories.

  Direct Brand    Source Brand + EW          Brand is the identity. No
                  Collection + Style/Model   supplier ambiguity.

  Import /        Source Brand + EW          Same as Direct Brand.
  International   Collection + Style/Model   

  In-house /      Home Brand ID + EW         Fully internal production. No
  Private Label   Collection + Style/Model   external supplier collection
                                             to track.
  ------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **💡 What the System Auto-Recalls on a Repeat Product**               |
+-----------------------------------------------------------------------+
| Branding Instructions: Vendor details, brand name to apply, label     |
| specs, packaging notes from all previous branding cycles.             |
|                                                                       |
| eCommerce Description Template: The approved product description ---  |
| staff can reuse as-is or edit for the new batch.                      |
|                                                                       |
| Product Photos & Videos: Previously uploaded media thumbnails shown.  |
| Option to reuse or reshoot for new batch.                             |
|                                                                       |
| SKU Structure: Auto-fills the SKU prefix (Brand Code + Collection     |
| Code). Only new colour/variant suffix needed.                         |
|                                                                       |
| Previous Purchase Rates: Full history of every purchase rate paid --- |
| shown as a comparison table for price negotiation.                    |
|                                                                       |
| Full Procurement History: Every past purchase date, qty, rate,        |
| supplier, and status.                                                 |
|                                                                       |
| ⏱ Time saved: First-time digitisation \~45--60 min/colour. Repeat     |
| with full recall: \~5--10 min/colour.                                 |
|                                                                       |
| 10-colour batch: First time \~8 hours. Repeat \~1 hour.               |
+-----------------------------------------------------------------------+

**4. The Procurement Pipeline --- Stage by Stage**

+-----+----------------------------------------------------------------+
| **  | **📋 Purchase Registration**                                   |
| 1** |                                                                |
|     | *Log the purchase · Detect repeat · Calculate bill amount ·    |
|     | Lock the record*                                               |
+-----+----------------------------------------------------------------+

A purchase begins when Eyewoot decides to buy a batch of frames. The
Procurement Manager opens Foundry and registers the purchase. The system
immediately checks if this product combination has been purchased
before.

**Purchase Registration Form**

  -------------------------------------------------------------------------
  **Field**          **Type / Format** **Notes**
  ------------------ ----------------- ------------------------------------
  Source Type        Dropdown ---      LOCAL_SUPPLIER · DIRECT_BRAND ·
                     first field       IMPORT · INHOUSE_PRIVATE_LABEL.
                                       Drives form adaptation.

  Maker (Supplier)   Lookup / Create   The manufacturing or supply entity.
                     New               Internal only for Local Supplier.
                                       Always recorded.

  Home Brand         Dropdown ---      Shown for LOCAL_SUPPLIER and
                     fixed list        INHOUSE_PRIVATE_LABEL only. Cannot
                                       free-type.

  Source Collection  Free text ---     Local Supplier only. The supplier\'s
                     internal          own name for this product line, as
                                       on their invoice. Never shown
                                       publicly.

  EW Collection Name Free text /       Eyewoot\'s public collection name.
                     Recalled          Free-text if new combination.
                                       Pre-filled and locked if repeat
                                       detected.

  Style / Model Name Text + Lookup     Triggers repeat detection on entry.
                                       Auto-suggests known models.

  Product Type       Dropdown          Frames · Sunglasses · Readers · Zero
                                       Power.

  Purchase Rate (per Numeric --- INR   Cost per piece before GST and
  unit)                                transport.

  Quantity           Integer           Total units in this purchase batch.

  Transportation     Numeric --- INR   Total freight cost for this
  Cost               (optional)        shipment. Allocated per unit
                                       internally.

  GST %              Dropdown          Single rate per bill. e.g. 12%, 18%.
                                       Applied on purchase rate × qty.

  Expected Bill      Auto-calculated   = (Rate × Qty) + Transport Cost +
  Amount             (read-only)       GST Amount.

  Colour Variants    Add rows          One row per colour in this purchase.
                                       Each colour gets its own qty and
                                       generates its own SKU.

  Purchase Date      Date picker       Date of purchase / PO issuance.

  PO Reference       Text (optional)   Supplier\'s purchase order number
                                       for cross-reference.

  Notes              Text area         Any special instructions, terms, or
                                       remarks for this purchase.
  -------------------------------------------------------------------------

**GST & Bill Amount Calculation**

  -----------------------------------------------------------------------
  **Component**               **Formula**
  --------------------------- -------------------------------------------
  Base Purchase Value         Purchase Rate per Unit × Total Quantity

  Transportation Cost         Entered as total freight cost (allocated
                              per unit internally)

  Taxable Value               Base Purchase Value + Transportation Cost

  GST Amount                  Taxable Value × GST %

  Expected Bill Total         Taxable Value + GST Amount

  Cost Per Unit (landed)      (Base Value + Transport) ÷ Total Qty (excl.
                              GST for margin calc)
  -----------------------------------------------------------------------

**Mismatch Guard --- EW Collection Name**

+-----------------------------------------------------------------------+
| **⚠️ Mismatch Guard**                                                 |
+-----------------------------------------------------------------------+
| Scenario: Same Maker + Home Brand + Source Collection + Style already |
| exists with EW Collection = \"Botanica Series\". Staff types \"Nature |
| Line\" for the same product.                                          |
|                                                                       |
| System detects: Source Collection match found but EW Collection       |
| differs from previous entry.                                          |
|                                                                       |
| System shows warning: \"This Source Collection was previously sold as |
| EW Collection: Botanica Series. Are you sure you want to use a        |
| different EW Collection name?\"                                       |
|                                                                       |
| Options: \[ Use Previous EW Collection: Botanica Series \] or \[      |
| Confirm as New EW Collection --- creates separate product_master      |
| entry \].                                                             |
|                                                                       |
| Purpose: Prevents accidental brand fragmentation where the same       |
| product gets two different Eyewoot names.                             |
+-----------------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **🧾 Bill Verification**                                       |
| 2** |                                                                |
|     | *Enter actual bill · Reconcile with expected · Approve or flag |
|     | discrepancy*                                                   |
+-----+----------------------------------------------------------------+

Once the physical supplier bill is received, the Procurement Manager
enters the actual bill amount. The system compares it against the
Expected Bill Amount from Stage 1. Only a verified and matched bill
unlocks the next stage.

  --------------------------------------------------------------------------
  **Field**             **Specification**
  --------------------- ----------------------------------------------------
  Actual Bill Amount    Staff enters the total amount as shown on the
                        supplier\'s physical bill/invoice.

  Bill Number           Supplier\'s invoice number --- mandatory for GST
                        records and audit trail.

  Bill Date             Date printed on the supplier invoice. May differ
                        from Purchase Date.

  Bill Photo / PDF      Mandatory --- staff photographs or scans the
  Upload                physical bill and uploads to Supabase Storage.

  Auto-Reconciliation   System instantly shows: Expected = ₹X · Actual = ₹Y
                        · Difference = ₹Z (highlighted red if non-zero).

  Discrepancy Threshold Configurable in Command Unit (default ±₹50). Within
                        threshold = auto-approved. Beyond = manual review.

  Discrepancy           If beyond threshold: Procurement Manager adds a
  Resolution            note. Super Admin reviews and approves.

  Bill Status           MATCHED → auto-proceeds to Stage 3. DISCREPANCY
                        FLAGGED → held for Super Admin approval.
  --------------------------------------------------------------------------

  -----------------------------------------------------------------------
  **✅ MATCHED**          **⚠️ DISCREPANCY        **❌ REJECTED**
                          FLAGGED**               
  ----------------------- ----------------------- -----------------------
  Expected = Actual       Difference \>           Supplier bill disputed.
  (within ±₹50 threshold) threshold. Note         Purchase on hold.
                          required.               

  → Auto-proceeds to      → Super Admin approval  → Re-negotiation with
  Branding                needed                  supplier
  -----------------------------------------------------------------------

+-----+----------------------------------------------------------------+
| **  | **🏷️ Branding (+ Bypass Logic)**                               |
| 3** |                                                                |
|     | *Ship to in-house team · Receive back · Verify count --- OR    |
|     | bypass for ready products*                                     |
+-----+----------------------------------------------------------------+

After bill verification, products proceed to the in-house branding team.
The system generates a Branding Dispatch Order --- a structured
instruction sheet. Products are physically sent, branded, and returned
for verification.

**Branding Dispatch**

  -----------------------------------------------------------------------
  **Field**          **Specification**
  ------------------ ----------------------------------------------------
  Branding Dispatch  Auto-generated document: Purchase ID, Brand Name to
  Order              apply (Home Brand for Local Supplier), Collection
                     Name, Style/Model, Qty per colour, Special
                     instructions. Supplier name does NOT appear on
                     dispatch order.

  Dispatch Date      Date products physically leave the warehouse for the
                     branding unit.

  Branding           Pre-filled from Master Catalogue if this product has
  Instructions       been branded before. Editable.

  Label              Brand name, font style, placement (temple/front),
  Specification      logo files. Stored in Supabase Storage.

  Expected Return    Estimated date products return from branding.
  Date               Triggers reminder notification if passed.

  Quantity           Per colour. System validates: sum of colour
  Dispatched         quantities = total purchase quantity.
  -----------------------------------------------------------------------

**Branding Receipt & Verification**

-   Branding team returns products to warehouse.

-   Warehouse staff opens the purchase record → taps \"Receive from
    Branding\".

-   Enters actual received quantity per colour variant.

-   System compares: dispatched qty vs received qty. Any shortfall is
    flagged as BRANDING DISCREPANCY.

-   Discrepancy note mandatory if qty mismatch. Branding supervisor
    reviews.

-   On verification approval → status updates to BRANDING COMPLETE →
    proceeds to Digitisation.

**Branding Bypass**

+-----------------------------------------------------------------------+
| **⚡ Branding Bypass --- For Ready-Branded Products Only**            |
+-----------------------------------------------------------------------+
| Trigger: On Purchase Registration, if branding_required = false for   |
| this product → Bypass is pre-selected.                                |
|                                                                       |
| Manual Override: Procurement Manager can select \"Bypass Branding\"   |
| for any non-Local-Supplier purchase.                                  |
|                                                                       |
| Bypass Reason: Mandatory dropdown --- Pre-branded by supplier /       |
| Import with branding applied / Private label (pre-printed) / Other.   |
|                                                                       |
| Effect: Purchase jumps from Stage 2 (Bill Verified) directly to Stage |
| 4 (Digitisation). No branding dispatch created.                       |
|                                                                       |
| Audit: Bypass event logged with reason, user, and timestamp. Cannot   |
| be undone once digitisation begins.                                   |
|                                                                       |
| 🚫 BLOCKED for Local Supplier source type: The bypass toggle is       |
| hidden in the UI AND blocked at the API layer.                        |
|                                                                       |
| Reason: Local supplier frames are always unbranded --- Home Brand     |
| label must always be applied by in-house team.                        |
+-----------------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **📸 Digitisation**                                            |
| 4** |                                                                |
|     | *Break inventory model × colour · Capture digital assets ·     |
|     | Generate SKUs · Publish to catalogue*                          |
+-----+----------------------------------------------------------------+

Digitisation is where physical products become digital products. Every
model-colour combination gets its own SKU, its own photos, its own
description, and its own barcode. This stage feeds the Foundry
catalogue, the Eyewoot Go consumer app, and every POS terminal
simultaneously.

**SKU Auto-Generation Formula**

+-----------------------------------------------------------------------+
| **🔢 SKU Format: \[BRAND_CODE\]-\[COLLECTION_CODE\]-\[COLOUR_CODE\]** |
+-----------------------------------------------------------------------+
| Example: EWS-BOTAN-TRNBLU = EW Studio · Botanica Series · Transparent |
| Blue                                                                  |
|                                                                       |
| Brand Code: Home Brand Code for Local Supplier (e.g. EWS for EW       |
| Studio). First 2--4 uppercase letters of brand name for others (e.g.  |
| RB for Ray-Ban).                                                      |
|                                                                       |
| Collection Code: First 5 letters of EW Collection name, no spaces     |
| (e.g. BOTAN for Botanica Series).                                     |
|                                                                       |
| Colour Code: Staff selects from standardised colour library OR        |
| creates new (max 6 chars, e.g. TRNBLU, BLKGLD).                       |
|                                                                       |
| Uniqueness check: System validates SKU does not already exist.        |
| Auto-increments suffix if duplicate (e.g. EWS-BOTAN-TRNBLU-02).       |
|                                                                       |
| Barcode: CODE-128 barcode auto-generated from SKU. Printable PDF tag  |
| available for download.                                               |
+-----------------------------------------------------------------------+

**Digitisation Form --- Per SKU (Model × Colour)**

  -------------------------------------------------------------------------
  **Section**      **Field**        **Specification**
  ---------------- ---------------- ---------------------------------------
  SKU & Identity   Auto-generated   Brand Code + Collection Code + Colour
                   SKU              Code. Editable before save.

  SKU & Identity   Barcode          CODE-128 auto-generated from SKU.
                                    Printable PDF tag.

  SKU & Identity   Product Type     Frames / Sunglasses / Readers / Zero
                                    Power.

  SKU & Identity   Quantity         Pulled from purchase colour split.
                                    Editable if count differs.

  Frame            Lens Width       mm --- width of one lens.
  Measurements                      

  Frame            Bridge Width     mm --- distance between lenses.
  Measurements                      

  Frame            Temple Length    mm --- arm length.
  Measurements                      

  Frame            Frame Width      mm --- full front width.
  Measurements     (total)          

  Frame            Frame Height     mm --- lens height.
  Measurements                      

  Frame            Weight           Grams.
  Measurements                      

  Specifications   Frame Material   Metal / Acetate / TR-90 / Titanium /
                                    Wood / Mixed.

  Specifications   Lens Material    Polycarbonate / CR-39 / Trivex / Glass.

  Specifications   Gender           Men / Women / Unisex / Kids.

  Specifications   Frame Shape      Round / Square / Aviator / Cat-eye /
                                    Wayfarer / Geometric / Other.

  Specifications   Colour Name      Human-readable colour name for customer
                   (display)        display. e.g. Matte Black & Gold.

  eCommerce        Product Title    SEO-optimised product name for Eyewoot
  Content                           Go listing.

  eCommerce        Short            1--2 sentence hook. Max 160 characters.
  Content          Description      

  eCommerce        Full Description Rich text. Features, benefits,
  Content                           materials, styling tips. Min 100 words.

  eCommerce        Keywords / Tags  Comma-separated tags for search and
  Content                           filtering.

  Media Assets     Product Photos   Min 3, max 20 photos. Studio shots.
                                    Uploaded to Supabase Storage.

  Media Assets     360° / Lifestyle Optional. MP4. Max 100MB. Linked to
                   Video            SKU.

  Media Assets     Photo angles     Front · Side · Three-quarter · Temple
                   required         close-up · On-face (if available).

  Pricing          Sale Price (MRP) Staff enters the retail sale price for
                                    this SKU.

  Pricing          Cost Price       Auto-filled: (Base Value + Transport) ÷
                   (landed)         Qty.

  Pricing          Gross Margin %   Auto-calculated: ((Sale Price -- Cost
                                    Price) / Sale Price) × 100. Read-only.
  -------------------------------------------------------------------------

**Repeat Product --- Digitisation Recall Behaviour**

  -------------------------------------------------------------------------
  **Section**      **Recall Behaviour**           **Staff Action**
  ---------------- ------------------------------ -------------------------
  SKU Structure    Brand Code + Collection Code   Confirm or edit colour
                   auto-filled. Only Colour Code  code.
                   needed for new colours.        

  Frame            All dimensions pre-filled from Confirm if unchanged.
  Measurements     last digitisation.             Edit if product specs
                                                  differ.

  Specifications   Material, shape, gender        Confirm or edit.
                   pre-filled.                    

  eCommerce        Full description template      Edit for new batch or
  Content          pre-loaded from last cycle.    approve as-is.

  Product Photos   Thumbnails of previous photos  Select \"Reuse Photos\"
                   shown with option to reuse.    or upload new studio
                                                  shots.

  Pricing          Previous sale price shown as   Set new sale price.
                   reference. Cost price          System shows margin
                   auto-fills from current        impact.
                   purchase rate.                 
  -------------------------------------------------------------------------

+-----+----------------------------------------------------------------+
| **  | **🏭 Warehouse & Outward**                                     |
| 5** |                                                                |
|     | *Product is live · Available for store transfer, D2C sale, or  |
|     | promoter hold*                                                 |
+-----+----------------------------------------------------------------+

Once all SKUs in a purchase batch are digitised and approved, the entire
batch is marked WAREHOUSE READY. Stock is live in Foundry inventory ---
visible on the HQ Admin dashboard, available for transfer, D2C orders,
or promoter-driven sales.

  -----------------------------------------------------------------------
  **Route**        **Trigger**         **Process**
  ---------------- ------------------- ----------------------------------
  🏪 Transfer to   Store Manager or    HQ selects SKUs + qty → dispatches
  Franchise Store  Super Admin raises  → Store Manager receives and
                   Transfer Request    confirms in Foundry mobile app →
                                       stock auto-adjusts both ends.

  📱 Eyewoot Go    Customer places     Order routed to Foundry →
  D2C              order on Eyewoot Go warehouse staff picks and packs →
                   app                 dispatch logged → customer
                                       tracking updated → stock deducted
                                       on dispatch.

  🤝 Promoter      Super Admin or      Stock flagged as PROMOTER_RESERVED
  Warehouse Hold   Promoter Manager    with promoter_id. Cannot be
                   reserves stock      transferred or sold online until
                                       released.
  -----------------------------------------------------------------------

**5. SKU Stock Distribution View**

The SKU Stock Distribution View answers the critical operational
question: \"How many units of SKU X exist right now, and exactly where
is each unit?\" Because the same SKU may be simultaneously in multiple
locations, this sub-module gives every authorised user a single,
real-time, role-scoped view.

**5.1 The 6 Stock Location Types**

  -----------------------------------------------------------------------------
  **Location    **Status Key**      **Definition**
  Type**                            
  ------------- ------------------- -------------------------------------------
  🏭 HQ         WAREHOUSE           Physically at the central HQ warehouse.
  Warehouse                         Default location after digitisation.
                                    Available for transfer, D2C dispatch, or
                                    promoter reservation.

  🏪 Franchise  AT_STORE            Transferred to and confirmed received at a
  Store                             franchise-owned store. Available for
                                    in-store POS sale.

  🏪 Owned      AT_STORE            Transferred to an Eyewoot company-owned
  Store                             store. Same logic as franchise but
                                    different ownership --- relevant for P&L
                                    separation.

  🚚 In Transit IN_TRANSIT          Transfer dispatched from warehouse but not
                                    yet confirmed at destination store. Counted
                                    separately until confirmed receipt.

  🤝 Promoter   PROMOTER_RESERVED   Physically at warehouse but ring-fenced for
  Reserved                          a specific promoter. Cannot be transferred
                                    or sold online until released.

  📦 Online     ONLINE_RESERVED     A D2C order on Eyewoot Go. Unit reserved at
  Reserved                          warehouse pending packing and dispatch.
  -----------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **📐 Stock Accounting Formula per SKU**                               |
+-----------------------------------------------------------------------+
| Total Units Digitised = WAREHOUSE + AT_STORE (all) + IN_TRANSIT +     |
| PROMOTER_RESERVED + ONLINE_RESERVED + SOLD + DAMAGED                  |
|                                                                       |
| Available to Sell / Transfer = WAREHOUSE (excludes reserved,          |
| in-transit, at-store)                                                 |
|                                                                       |
| Committed = PROMOTER_RESERVED + ONLINE_RESERVED (allocated but not    |
| yet sold)                                                             |
|                                                                       |
| Rule: A unit can ONLY be in one location state at any time. Status    |
| transitions are atomic and logged.                                    |
+-----------------------------------------------------------------------+

**5.2 Role-Based Visibility Matrix**

  ------------------------------------------------------------------------------------------
  **Role**       **HQ          **Franchise   **Owned   **In        **Promoter   **Online
                 Warehouse**   Store**       Store**   Transit**   Reserved**   Reserved**
  -------------- ------------- ------------- --------- ----------- ------------ ------------
  Super Admin    ✅ All        ✅ All        ✅ All    ✅ All      ✅ All       ✅ All

  Store Manager  ✅ All        ✅ Own only   ✅ Own    ✅ All      ---          ---
                 (read-only)                 only                               

  Procurement    ✅ All        ---           ---       ✅ All      ---          ---
  Mgr                                                                           

  Franchise      ---           ✅ Own only   ---       ---         ---          ---
  Owner                                                                         
  ------------------------------------------------------------------------------------------

**5.3 Stock Movement Types**

  --------------------------------------------------------------------------
  **movement_type**     **From → To**         **Trigger**
  --------------------- --------------------- ------------------------------
  INWARD_DIGITISATION   None → WAREHOUSE      Digitisation complete in
                                              Foundry Procurement.

  TRANSFER_DISPATCH     WAREHOUSE →           Transfer order dispatched from
                        IN_TRANSIT            warehouse.

  TRANSFER_RECEIVED     IN_TRANSIT → AT_STORE Destination store confirms
                                              receipt.

  TRANSFER_CANCELLED    IN_TRANSIT →          Transfer cancelled
                        WAREHOUSE             mid-transit. Units return.

  PROMOTER_RESERVE      WAREHOUSE →           Super Admin reserves for a
                        PROMOTER_RESERVED     promoter.

  PROMOTER_SOLD         PROMOTER_RESERVED →   Promoter confirms sale.
                        SOLD                  

  ONLINE_RESERVE        WAREHOUSE →           Customer places D2C order on
                        ONLINE_RESERVED       Eyewoot Go.

  ONLINE_DISPATCH       ONLINE_RESERVED →     Order packed and dispatched.
                        IN_TRANSIT            

  ONLINE_DELIVERED      IN_TRANSIT → SOLD     D2C delivery confirmed.

  ONLINE_CANCELLED      ONLINE_RESERVED →     Order cancelled before
                        WAREHOUSE             dispatch.

  POS_SALE              AT_STORE → SOLD       Sale completed at store POS.

  STOCK_ADJUSTMENT      Any → WAREHOUSE /     Manual correction by Super
                        DAMAGED               Admin with reason.
  --------------------------------------------------------------------------

**5.4 Low Stock Alerts**

  -----------------------------------------------------------------------
  **Alert Type**     **Specification**
  ------------------ ----------------------------------------------------
  Reorder Threshold  Set per SKU in Foundry catalogue (default: 5 units
                     at warehouse). Alert triggers when WAREHOUSE qty
                     drops below threshold.

  Alert Channels     HQ Admin dashboard (Command Unit) · Push
                     notification to Procurement Manager · Red badge on
                     SKU in Foundry catalogue list.

  Store-level Alert  When AT_STORE qty drops below
                     store_reorder_threshold (set per store per SKU by
                     Super Admin), Store Manager receives push
                     notification.

  Slow Mover Alert   If an AT_STORE SKU has 0 sales in configurable days
                     (default: 30 days), flagged as slow mover. Suggests
                     transfer back or promotion.

  Network Zero Alert If WAREHOUSE + IN_TRANSIT = 0 for any SKU but
                     AT_STORE still has units, Super Admin notified: \"No
                     replenishment stock available.\"

  Threshold          All thresholds managed in Command Unit → Foundry
  Configuration      Settings. Per SKU, per location. Not hardcoded.
  -----------------------------------------------------------------------

**5.5 Extensibility --- Adding New Location Types**

New store formats (kiosk, pop-up, regional warehouse) can be added as a
configuration action in Command Unit --- no code change required. New
location type gets a visibility_config row defining which roles can see
it, at what scope.

+-----------------------------------------------------------------------+
| **🔮 Future Location Types Already Anticipated**                      |
+-----------------------------------------------------------------------+
| REGIONAL_WAREHOUSE: Second warehouse when Eyewoot expands to Mumbai / |
| Delhi.                                                                |
|                                                                       |
| KIOSK: Mall kiosk with limited SKU range. Same AT_STORE logic,        |
| different store_format tag.                                           |
|                                                                       |
| POP_UP: Temporary event store. Stock transferred for event duration,  |
| returned after.                                                       |
|                                                                       |
| EXPORT: Bulk international sale. New movement type EXPORT_DISPATCH.   |
|                                                                       |
| B2B_RESERVED: Corporate gifting or bulk B2B orders. Same pattern as   |
| PROMOTER_RESERVED.                                                    |
|                                                                       |
| All of the above: Zero code changes. One Command Unit config row.     |
| Live immediately.                                                     |
+-----------------------------------------------------------------------+

**6. Vendor & Product Rate Intelligence**

Rate Intelligence tracks which vendor supplies which product, at what
rate, across all purchases --- with lowest and highest rate surfaced
automatically. During new purchase registration, the system shows rate
comparison in context so staff can negotiate immediately.

**6.1 The Two Views**

  --------------------------------------------------------------------------
  **View**          **Question Answered**      **Key Data Shown**
  ----------------- -------------------------- -----------------------------
  Product-Centric   For this product --- who   Global lowest rate (any
                    has ever supplied it, at   vendor) · Global highest rate
                    what rates, and who is     · Last purchased rate ·
                    cheapest?                  Per-vendor rate history with
                                               trend.

  Vendor-Centric    For this vendor --- which  Total products supplied ·
                    products do they supply    Total purchases · Per-product
                    us, at what rate range for lowest / highest / last rate
                    each?                      · Source Collection name for
                                               reordering.
  --------------------------------------------------------------------------

**6.2 Rate Intelligence During Purchase Registration**

+-----------------------------------------------------------------------+
| **💰 Rate Intelligence Context --- Shown Inline on Purchase Form**    |
+-----------------------------------------------------------------------+
| Lowest rate ever for this product (any vendor): ₹X --- You are ₹Y     |
| above best rate.                                                      |
|                                                                       |
| Highest rate ever for this product (any vendor): ₹Z.                  |
|                                                                       |
| Last time you bought from this vendor: ₹W (Date) --- Same rate / ₹N   |
| higher / ₹N lower than today.                                         |
|                                                                       |
| This vendor\'s lowest rate ever for this product: ₹V.                 |
|                                                                       |
| Suggested Action (non-blocking nudge): \"This vendor previously       |
| quoted ₹V. Consider negotiating before confirming.\"                  |
|                                                                       |
| Design principle: Rate intelligence is ADVISORY only. It never blocks |
| a purchase from being registered.                                     |
|                                                                       |
| The Procurement Manager always has the final decision.                |
+-----------------------------------------------------------------------+

**6.3 Rate Intelligence Signals**

  -----------------------------------------------------------------------
  **Signal**            **How It Helps**
  --------------------- -------------------------------------------------
  Lowest Rate Ever      Best price ever paid from ANY vendor. The floor.
  (network-wide)        If current quote is above this, there is room to
                        negotiate.

  Highest Rate Ever     The ceiling. Useful to sanity-check a quote that
  (network-wide)        seems too high.

  This Vendor\'s Lowest Best price this specific vendor has ever given.
  Rate                  Strongest negotiation lever --- \"You gave us ₹X
                        last March.\"

  This Vendor\'s Last   What was paid last time. If rate is creeping up
  Rate                  purchase by purchase, the trend is visible.

  Rate vs Previous      Delta: ₹185 today vs ₹180 last time = ₹5
  (this vendor)         increase. Flags a rate rise the manager might
                        have missed.

  Trend (UP / DOWN /    Per-vendor trend computed automatically from
  STABLE)               purchase history. STABLE signals a reliable
                        vendor for planning.

  Staleness Indicator   If last purchase was \> 6 months ago, system
                        flags the data as potentially stale --- market
                        rates may have shifted.
  -----------------------------------------------------------------------

**6.4 Vendor Master**

  ------------------------------------------------------------------------------
  **Field**                 **Specification**
  ------------------------- ----------------------------------------------------
  vendor_name               Full business name of the supplier. e.g. \"ABC
                            Optics Pvt. Ltd., Moradabad\".

  vendor_code               Short code auto-generated or manually set. e.g.
                            \"ABCO-MBD\".

  city / state              Location. Used for logistics planning and GST
                            (inter-state vs intra-state).

  gstin                     Vendor\'s GST Identification Number. Required for
                            ITC (Input Tax Credit) claim.

  contact_person            Primary contact name and phone at the vendor.

  payment_terms             Standard payment terms. e.g. \"Net 30\",
                            \"Advance\", \"50% advance 50% on delivery\".

  source_types_supplied     Which source types this vendor handles: Local
                            Supplier / Direct Brand / Import. Multi-select.

  home_brands_supplied      For Local Supplier vendors: which Eyewoot Home
                            Brands they supply products for. Informational.

  vendor_status             active · inactive · blacklisted.
                            Inactive/blacklisted vendors cannot be selected on
                            new purchases.

  total_products_supplied   Computed. Count of unique product_master entries
                            this vendor has been linked to.

  total_purchases           Computed. Count of all purchase records from this
                            vendor.
  ------------------------------------------------------------------------------

**7. Data Architecture**

**7.1 Core Prisma Models**

  -------------------------------------------------------------------------------------
  **Model**                    **Key Fields**              **Purpose**
  ---------------------------- --------------------------- ----------------------------
  product_master               id, maker_id, source_type,  The unique product record.
                               source_brand,               Core of repeat detection.
                               home_brand_id,              source_collection (internal)
                               source_collection,          and ew_collection (public)
                               ew_collection, style_model, are the two collection
                               product_type,               fields introduced in v1.2.
                               branding_required,          
                               catalogue_status            

  home_brands                  id, brand_name, brand_code, Fixed list of Eyewoot Home
                               brand_description,          Brands. Managed by Super
                               brand_logo_url, is_active,  Admin in Command Unit.
                               created_by                  

  suppliers                    id, vendor_name,            Vendor / supplier master.
                               vendor_code, city, state,   Referenced by product_master
                               gstin, contact_person,      and all purchase records.
                               payment_terms,              
                               vendor_status               

  purchases                    id, product_master_id,      One row per purchase batch.
                               purchase_date,              
                               purchase_rate, quantity,    
                               transport_cost, gst_pct,    
                               expected_bill_amt,          
                               actual_bill_amt,            
                               bill_status, po_reference   

  purchase_colours             id, purchase_id,            Colour split within a
                               colour_name, colour_code,   purchase. One row per
                               quantity                    colour.

  branding_jobs                id, purchase_id,            Tracks branding dispatch and
                               dispatch_date,              receipt.
                               expected_return_date,       
                               instructions (jsonb),       
                               status, bypass_reason       

  branding_job_colours         id, branding_job_id,        Per-colour branding count
                               colour_code,                verification.
                               qty_dispatched,             
                               qty_received,               
                               discrepancy_note            

  skus                         id, product_master_id,      One SKU per colour variant.
                               purchase_colour_id,         Auto-generated code.
                               sku_code, barcode,          
                               quantity, cost_price,       
                               sale_price, status          

  sku_digitisation             id, sku_id, lens_width,     All digitisation fields per
                               bridge_width,               SKU.
                               temple_length,              
                               frame_height, weight,       
                               material, shape, gender,    
                               colour_display_name, title, 
                               short_desc, full_desc,      
                               tags, is_published          

  sku_media                    id, sku_id, media_type      Photos and videos linked to
                               (photo/video), file_url,    SKU.
                               angle_label, is_primary,    
                               created_at                  

  stock_balances               id, sku_id, location_type,  Running balance per SKU per
                               location_id, location_name, location. Source of truth
                               qty, last_updated           for stock view.

  stock_movements              id, sku_id,                 Full audit log of every unit
                               from_location_type,         movement. Never deleted.
                               from_location_id,           
                               to_location_type,           
                               to_location_id, qty,        
                               movement_type,              
                               reference_id, created_by,   
                               created_at                  

  location_visibility_config   id, location_type,          Command Unit config table.
                               display_name, display_icon, Controls which roles see
                               visible_to_roles\[\],       which location types. Read
                               scope, is_active,           at runtime --- extensible
                               created_by                  without code changes.

  vendor_product_rates         id, product_master_id,      Materialised rate
                               vendor_id, total_purchases, intelligence per
                               lowest_rate, highest_rate,  vendor+product. Auto-updated
                               last_rate, previous_rate,   on every purchase save.
                               rate_trend, rate_delta,     
                               updated_at                  

  product_rate_summary         product_master_id (unique), Network-wide rate aggregates
                               network_lowest_rate,        per product. Powers the top
                               network_lowest_vendor_id,   strip on product-centric
                               network_highest_rate,       rate view.
                               total_vendor_count,         
                               last_purchased_rate,        
                               last_purchased_vendor_id,   
                               updated_at                  
  -------------------------------------------------------------------------------------

**7.2 Pipeline Status State Machine**

  ---------------------------------------------------------------------------
  **Status**                  **Stage**     **Trigger**
  --------------------------- ------------- ---------------------------------
  PENDING_BILL_VERIFICATION   Stage 1 → 2   Purchase Registration saved.

  BILL_VERIFIED               Stage 2 → 3   Actual bill entered and matched
                                            within threshold.

  BILL_DISCREPANCY            Stage 2       Bill amount beyond threshold.
                              (hold)        Awaiting Super Admin approval.

  DISPATCHED_TO_BRANDING      Stage 3       Branding Dispatch Order created
                                            and confirmed.

  BRANDING_COMPLETE           Stage 3 → 4   All colours received back from
                                            branding and verified.

  BRANDING_BYPASSED           Stage 2 → 4   Bypass selected with reason. Bill
                                            verified, no branding job
                                            created. Not available for
                                            LOCAL_SUPPLIER.

  DIGITISATION_IN_PROGRESS    Stage 4       At least one SKU digitised but
                                            not all completed.

  WAREHOUSE_READY             Stage 4 → 5   All SKUs digitised, approved, and
                                            published to catalogue.

  PARTIALLY_OUTWARD           Stage 5       Some SKUs transferred/sold, some
                                            still in warehouse.

  FULLY_OUTWARD               Stage 5       All units transferred or sold.
                              complete      Purchase batch closed.
  ---------------------------------------------------------------------------

**8. Roles & Permissions**

  ---------------------------------------------------------------------------------------
  **Action**          **Procurement   **Warehouse   **Content   **Store     **Super
                      Mgr**           Staff**       Team**      Manager**   Admin**
  ------------------- --------------- ------------- ----------- ----------- -------------
  Register Purchase   ✅ Full         View only     View only   ---         ✅ Full

  Bill Verification   ✅ Full         View only     ---         ---         ✅ Full +
                                                                            Approve
                                                                            discrepancy

  Branding Dispatch   ✅ Full         ✅ Receive &  ---         ---         ✅ Full
                                      verify                                

  Branding Bypass     ✅ With reason  ---           ---         ---         ✅ Full
                      (non-Local                                            
                      Supplier only)                                        

  Digitisation ---    View            View          ✅ Full     ---         ✅ Full
  Specs                                                                     

  Digitisation ---    View            View          ✅ Full     ---         ✅ Full
  Photos/Video                                                              

  SKU Publish to      View            View          ✅ Full     ---         ✅ Full
  Catalogue                                                                 

  Stock Transfers     View            ✅ Full       ---         ✅ Request  ✅ Full
  (outward)                                                     only        

  Home Brand Master   ---             ---           ---         ---         ✅ Only role
  Edit                                                                      

  Master Catalogue    View            ---           View        ---         ✅ Only role
  Edit                                                                      

  View Procurement    ✅ Full         ✅ Full       ✅ Full     Own store   ✅ Full
  History                                                       only        

  Approve Bill        ---             ---           ---         ---         ✅ Only role
  Discrepancy                                                               

  Rate Intelligence   ✅ Full         ---           ---         Own store   ✅ Full
  Views                                                         stock only  

  Vendor Master ---   ✅ Read only    ---           ---         ---         ✅ Full CRUD
  View                                                                      

  Vendor Master ---   ---             ---           ---         ---         ✅ Full CRUD
  Create/Edit                                                               

  SKU Stock View      ✅ Warehouse +  ✅ Own        ---         ✅ Own      ✅ All
                      In-Transit      location                  store +     locations
                                                                Warehouse   
                                                                (read)      
  ---------------------------------------------------------------------------------------

**9. Catalogue & Public Display Rules**

Every Cosmos module that displays product information uses the
display_brand computed field and ew_collection --- never the raw
source_brand, source_collection, or maker fields. This is enforced in
the NestJS FoundryModule\'s ProductService.

  -----------------------------------------------------------------------
  **Module /         **What Is Displayed**       **Change from v1.1**
  Context**                                      
  ------------------ --------------------------- ------------------------
  Foundry ---        Maker (real supplier) +     Now shows both
  Procurement View   Home Brand + Source         collection fields
  (internal)         Collection + EW Collection. clearly labelled.
                     Full internal context.      

  Foundry --- Bill   Source Collection shown     New --- helps match
  Verification       next to supplier invoice    invoice items.
                     for cross-referencing line  
                     items.                      

  Foundry --- SKU    Home Brand + EW             No change.
  Catalogue          Collection + Style. Maker   
                     and Source Collection never 
                     shown.                      

  POS --- Product    EW Collection name. Staff   No change.
  Search & Cart      searches by EW Collection.  

  POS --- Receipt    Home Brand + EW             No change.
  (customer copy)    Collection + MRP. Supplier  
                     never mentioned.            

  Eyewoot Go ---     Home Brand + EW             No change.
  Consumer Catalogue Collection + product        
                     description. Supplier       
                     completely invisible.       

  Promoter App       Home Brand + EW Collection. No change.
                     Promoter shares Eyewoot\'s  
                     brand --- never the         
                     supplier.                   

  Command Unit ---   Full detail: Maker + Home   Enhanced audit trail.
  Audit Logs         Brand + Source Collection + 
                     EW Collection + SKU.        
  -----------------------------------------------------------------------

**10. Build Roadmap**

  ----------------------------------------------------------------------------------
  **Sprint**   **Focus**      **Deliverables**                        **Est.
                                                                      Duration**
  ------------ -------------- --------------------------------------- --------------
  S1           Foundation     product_master table (with              1 week
                              source_collection + ew_collection       
                              fields) · home_brands table · suppliers 
                              table · purchase table ·                
                              purchase_colours table · Repeat         
                              detection query · Master Catalogue CRUD 

  S2           Purchase       Purchase form UI with dynamic           1 week
               Registration   source-type adaptation · Home Brand     
                              dropdown · Source Collection / EW       
                              Collection dual fields · GST calculator 
                              · Colour variants row builder · Repeat  
                              detection screen · Mismatch guard ·     
                              Bill amount auto-calc                   

  S3           Bill           Bill entry form · Reconciliation engine 1 week
               Verification   · Discrepancy threshold logic · Bill    
                              photo upload · Approval flow            

  S4           Branding       Branding Dispatch Order generator (Home 1--2 weeks
               Module         Brand on dispatch, supplier hidden) ·   
                              Dispatch form · Receive & verify UI ·   
                              Quantity mismatch handling · Bypass     
                              flow (blocked for Local Supplier at     
                              UI + API layer)                         

  S5           Digitisation   SKU auto-generation (Home Brand Code    2 weeks
                              for private label) · Full digitisation  
                              form · Media upload (Supabase Storage)  
                              · Barcode generation · Repeat recall    
                              pre-fill                                

  S6           Warehouse &    Stock movement engine · Transfer        1 week
               Outward        request flow · D2C order routing ·      
                              Promoter reserve logic · Warehouse      
                              dashboard                               

  S7           SKU Stock      Stock balances table · stock_movements  1 week
               Distribution   table · location_visibility_config      
               View           table · Role-scoped query · Stock view  
                              UI (web + mobile) · Low stock alerts ·  
                              Extensibility config in Command Unit    

  S8           Rate           vendor_product_rates table ·            1 week
               Intelligence   product_rate_summary table ·            
                              Auto-update trigger on purchase save ·  
                              Product-centric view · Vendor-centric   
                              view · Inline rate panel on purchase    
                              form                                    

  S9           Intelligence   Full procurement history views · Price  1 week
               Layer          comparison across purchases · Repeat    
                              product analytics · Slow mover alerts · 
                              Export (CSV)                            
  ----------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **📅 Total Estimated Build Time --- Foundry Procurement +             |
| Sub-Modules**                                                         |
+-----------------------------------------------------------------------+
| S1--S9: \~10--11 weeks from first commit to full warehouse-ready      |
| products with rate intelligence and stock distribution view.          |
|                                                                       |
| Parallel work: S5 (Digitisation) content team work can run alongside  |
| S4 (Branding) for repeat products.                                    |
|                                                                       |
| Dependencies: Command Unit (P1) must be complete before Foundry ---   |
| stores and user roles must exist.                                     |
|                                                                       |
| Unblocks: POS can only show live inventory AFTER S6 is complete.      |
| Eyewoot Go product listing needs S5 published SKUs.                   |
+-----------------------------------------------------------------------+

🔩 Foundry · Product Procurement Module · Master PRD v1.2 · Part of 🌌
Cosmos ERP

Project Lead: Talha Junani · Confidential --- Eyewoot Optical Internal
Use Only
