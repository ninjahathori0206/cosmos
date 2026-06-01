# Membership buddies (dependents)

## Purpose

Primary Eyewoot Plus (or other plan) holders can link **buddies** who **inherit** plan capabilities for member-only offers at POS and in Eyewoot Go. Staff can add/remove links from Store OS and CX; customers use **Add Your Buddy** in Go.

## Channels

| Channel | Entry | Permission |
|---------|--------|------------|
| **Eyewoot Go** | Membership tab → **Add Your Buddy** | Logged-in primary only (`can_add_dependents`) |
| **Store OS** | Cart Cx card → **Your Buddies** | `pos.membership.dependents.manage` (view: also `pos.membership.sell`) |
| **CX** | Customer detail → Membership block | `cx.membership.manage` |

## Data

- Table: `customer_membership_dependents` (migration 32)
- Cap: `membership_plans.max_dependents` per plan (buddy slots)
- Relationship: catalog keys (`spouse`, `parent`, `child`, `sibling`, `other`) — `GET /api/meta/membership-dependent-relationships`

## API

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/customer/membership` | Go — includes `membership_source`, `inherited_from`, `relationship_options` |
| POST | `/api/customer/membership/add-dependent` | Go — `{ phone, relationship }` |
| GET | `/api/pos/customers/:id/membership-family` | `role`, `dependents`, `inherited_from`, `can_sell_membership` |
| POST | `/api/pos/customers/:id/membership/dependents` | Staff add buddy |
| DELETE | `/api/pos/customers/:id/membership/dependents/:dependentId` | Staff remove buddy |
| GET | `/api/cx/customers/:id/membership` | Extended with `dependents`, `slots_remaining`, `membership_role` |
| POST/DELETE | `/api/cx/customers/:id/membership/dependents` | Same as POS |

Offer eligibility uses `resolveMembershipForCustomer` (own membership wins; else primary’s plan capabilities).

## UX states

| State | Go | POS | CX |
|-------|-----|-----|-----|
| **Primary** | Plan hero + **Your Buddies** + **Add Your Buddy** (if slots) | **Your Buddies** modal; can sell membership | Grant + buddy list + **Add Your Buddy** |
| **Dependent** | **Buddy plan** banner; no add | **Plus · buddy of {name}**; **no** sell membership on cart | Read-only inherited_from |
| **No membership** | Empty state | No buddies section | No active membership |
| **Slots full** | Hide add row | Toast error on POST | Same |

## Copy (customer-facing)

| Old | New |
|-----|-----|
| Add family member | **Add Your Buddy** |
| Family members | **Your Buddies** |
| Family membership | **Buddy plan** |
| Family member added | **Buddy added** |

## Pencil frames (reference)

- `Store OS — /pos/order` — Cx card **Your Buddies** link + modal
- `Eyewoot Go — /go` — **Your Buddies** section + **Add Your Buddy** modal
- `CX — customer detail` — Buddies list

## POS rules

- Dependent Cx: member offers apply via inherited plan; **Add membership plan** hidden when `can_sell_membership === false`.
- Phone: same unique-mobile + family-name rules as register Cx.

## Verification

Primary add buddy, existing phone link, max slots, dependent offers at checkout, RBAC on POST, Go dependent view (no **Add Your Buddy**).
