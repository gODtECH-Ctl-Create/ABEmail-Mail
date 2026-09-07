# ABEmail Mail Commercial Licensing

> **Status:** Policy and commercial-licensing framework draft
>
> This document describes the intended commercial licensing model for ABEmail Mail. It is not a substitute for legal advice or a signed agreement.

## 1. Licensing model

ABEmail Mail is source-available, proprietary software. Public source visibility does not by itself grant permission to use, modify, distribute, white-label, sublicense, resell, or operate the software.

The root `LICENSE` file contains the software license terms. A customer or third party should also receive a written Commercial Agreement or Order Form defining the exact deployment rights.

## 2. Recommended licensing structure

Every external deployment should have an explicit license record containing, at minimum:

| Field | Example |
| --- | --- |
| Licensee | Organization legal name |
| Product | ABEmail Mail |
| Deployment ID | Unique installation identifier |
| Primary domain | customer.example.com |
| Environment | production / staging / evaluation |
| Deployment limit | 1 production deployment |
| Authorized seats | 25 |
| Start date | YYYY-MM-DD |
| Renewal date | YYYY-MM-DD |
| Support tier | Standard / Premium / Custom |
| Commercial model | fixed / subscription / usage / royalty |
| Approved customization | none / specified scope |
| Status | active / suspended / expired / terminated |

## 3. Default rights

Unless a Commercial Agreement says otherwise, the recommended commercial posture is:

- one organization per authorized deployment;
- no sublicensing;
- no redistribution;
- no white-labeling;
- no removal of product identity or attribution;
- no source-code modification by the licensee;
- no use as a product or service for unrelated third parties;
- no competing product built from the Software;
- no AI training or model-building use from the Software or its source;
- no transfer of the license to another organization or domain;
- no bypass of deployment, entitlement, or provenance controls.

## 4. Customization

Customization should be handled as a contract term rather than an assumption.

Possible commercial options include:

### Standard deployment

Customer receives the standard ABEmail interface and feature set with no UI redesign rights.

### Authorized customization

Specific UI, branding, workflow, or integration changes are identified in the Order Form and may be implemented by the Licensor or an approved development partner.

### White-label exception

A separate, higher-tier agreement can grant limited white-label rights. Such rights should explicitly identify which marks, screens, terminology, domains, and distribution channels may change.

## 5. Commercial pricing models

The licensing framework can support several pricing structures:

### Deployment fee

A fixed fee for one authorized organization deployment.

### Subscription

Recurring monthly or annual licensing with renewal and support terms.

### Per-seat

Pricing based on authorized mailbox or user count.

### Usage-based

Pricing based on storage, mail volume, API usage, or another measurable unit.

### Royalty

A negotiated percentage or fixed amount tied to defined revenue, deployment volume, or usage. The calculation, reporting period, audit process, and payment date must be stated in the Commercial Agreement.

### Hybrid

A combination such as implementation fee + recurring license + support + usage or royalty component.

## 6. Deployment registration

For controlled commercial distribution, create a unique Deployment ID for every authorized installation.

A deployment record can contain:

- Deployment ID
- license ID
- organization identifier
- authorized domain
- release/version
- activation date
- renewal/expiry date
- environment
- seat entitlement
- support tier
- feature entitlements
- status

Where technically appropriate, the application can send an explicit activation or health signal to a licensing service. Any such communication must be disclosed to the customer and must follow applicable privacy, security, and data-protection requirements.

## 7. Provenance and source integrity

Recommended technical controls include:

- signed releases;
- signed build artifacts;
- source provenance metadata;
- Software Bill of Materials (SBOM);
- release checksums;
- deployment identifiers;
- version and entitlement records;
- controlled distribution archives;
- reproducible build documentation where practical;
- organization-specific activation records.

These controls help establish provenance and authorized use. They should not be described as impossible to remove or bypass by someone who completely controls the source and runtime environment.

## 8. Audit and compliance

A Commercial Agreement may provide reasonable audit rights to verify:

- number of active deployments;
- authorized domains;
- licensed seats;
- license status;
- reported usage metrics where relevant;
- royalty calculations where applicable;
- continued preservation of required notices and license controls.

Any audit process should define notice, frequency, scope, confidentiality, and cost allocation.

## 9. Termination and offboarding

A commercial agreement should define what happens when a license expires or is terminated, including:

- suspension of new deployments;
- end of support;
- removal of production use where contractually required;
- return or destruction of source materials where applicable;
- retention of legally required records;
- treatment of customer data, backups, and exports;
- outstanding fees and payment obligations.

## 10. Public repository strategy

For the strongest commercial control, the production source repository should normally be private. A public GitHub repository exposes source code even when the code is proprietary, and GitHub's platform rules still allow people to view or fork public repositories. The license controls what rights are granted to use the software; repository visibility controls source exposure.

If ABEmail is distributed commercially, consider maintaining:

```text
Private source repository
        ↓
Controlled release branch/tag
        ↓
Signed build artifact
        ↓
Commercial license authorization
        ↓
Deployment activation
```

A public marketing or documentation repository can be maintained separately when appropriate.

## 11. Legacy MIT releases

The project previously contained an MIT License. The proprietary license is intended to govern versions and revisions explicitly released under the proprietary terms.

Previously distributed copies that were validly licensed under the old MIT terms should be handled as a separate legacy licensing matter. Replacing the `LICENSE` file does not by itself rewrite the legal history of copies already distributed under the prior license.

## 12. Legal review

Before accepting an external customer, publishing the proprietary license as a final commercial agreement, imposing royalties, restricting modifications, or enforcing termination/removal obligations, have qualified counsel review:

- the final license;
- the order form/commercial agreement;
- governing law and venue;
- intellectual property ownership;
- trademark and branding rights;
- data-protection obligations;
- limitation of liability and indemnities;
- royalty reporting/audit provisions;
- treatment of third-party components;
- employee/contractor and contributor intellectual-property assignments.

## 13. Recommended legal package

For a mature commercial ABEmail offering, maintain these as separate artifacts:

```text
LICENSE
        Proprietary software license terms

NOTICE.md
        Copyright, attribution, and proprietary notices

docs/COMMERCIAL-LICENSING.md
        Internal licensing and deployment policy

Commercial Agreement / Order Form
        Customer-specific commercial terms

Deployment Record
        Organization, domain, seats, deployment ID, entitlement

Release Record
        Version, checksum, signature, release provenance
```
