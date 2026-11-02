# Third-party rights and data provenance

The root MIT LICENSE covers original ChannelScout AI code and original documentation only. It does **not** relicense third-party software, the generated HTML entity mapping, website quotations, company data, trademarks or product names. Existing upstream rights and notices continue to apply. No brand endorsement or redistribution permission is implied.

## Software

| Direct runtime component | Version | Declared license | Upstream |
| --- | --- | --- | --- |
| Next.js | 16.4.3 | MIT | https://github.com/vercel/next.js |
| React | 19.3.1 | MIT | https://github.com/facebook/react |
| React DOM | 19.3.1 | MIT | https://github.com/facebook/react |
| Lucide React icons | 0.468.0 | ISC | https://github.com/lucide-icons/lucide |

Unmodified installed direct-component notices are retained in `third-party/licenses/`. Icons rendered by Lucide are third-party material, not a Pudu logo. Package authors retain their copyright.

`third-party/dependency-licenses.json` records the 396 packages installed on macOS arm64, including development dependencies, version, declared license, repository and hashes of available root notice files. All 396 declare a license. The distribution is MIT 338, Apache-2.0 23, ISC 17, BSD-2-Clause 7, MPL-2.0 3, BSD-3-Clause 2, and one each of 0BSD, CC-BY-4.0, CC0-1.0, BlueOak-1.0.0, Python-2.0 and LGPL-3.0-or-later. These are declarations checked against installed artifacts, not a certification of all upstream authorship or binary composition.

Pay particular attention to `lightningcss`, its platform binary and `axe-core` (MPL-2.0), `@img/sharp-libvips-darwin-arm64` (LGPL-3.0-or-later), and `caniuse-lite` data (CC-BY-4.0). They are not MIT. This repository ships no node_modules, native binaries or built application. They are obtained from their upstream packages during installation. If distributing dependencies, a container, executable, application bundle or modified third-party files, separately review applicable notice, attribution, source and relinking obligations. Do not reuse this source-only review as binary-distribution approval.

Next.js also contains bundled components. The inventory records 131 compiled component manifests: 15 omit a license field; 13 of those include a LICENSE file, while `babel-packages` and `constants-browserify` have neither a local license field nor root notice. These remain upstream provenance gaps, not newly granted MIT rights. Do not strip installed upstream notices or assume the root Next.js MIT label resolves every bundled component. Other platforms and bundled native sublibraries are not exhaustively inventoried here.

**Repository distribution check:** none of those compiled component files, node_modules packages, native binaries, images or fonts are in `PUBLIC-FILES.txt` or the Git index. The inventory contains original audit metadata, not their bundled source code. The source repository references dependencies through the frozen pnpm lock and installs them from the npm package registry. The two upstream notice gaps therefore do not identify an unlicensed bundled file being redistributed in this repository; they remain relevant to any later binary/bundle/container distribution. This is not a finding that all upstream artifacts have been legally cleared.

## Generated HTML entities

`lib/research/html-entities.json` is a generated semicolon-terminated subset of Python standard-library `html.entities.html5`; it is **excluded from the project's MIT grant**. The values were checked against that standard-library table without modifying values. Transformation: retain names ending with `;`, strip that suffix from keys, serialize JSON. No Python interpreter is distributed.

Copyright © 2001 Python Software Foundation; All Rights Reserved. The full upstream Python 3.12 license/history text is retained at `third-party/licenses/Python-3.12-LICENSE.txt`, sourced from https://github.com/python/cpython/blob/v3.12.0/LICENSE . See the [official Python license](https://docs.python.org/3/license.html). The underlying character-reference standard is documented by [WHATWG](https://html.spec.whatwg.org/entities.json).

## Public company research and brands

`data/companies.json`, `data/sources.json`, historical short evidence excerpts in demo fixtures, and related test excerpts contain third-party references. Original analytical wording can be original work; embedded source expression and third-party data rights are not transferred by this project. The project does not offer these records as an MIT-licensed commercial dataset. Source URLs, dates and evidence statuses remain in the records, including failed/indexed sources.

| Research subject | Public source entry point | Redistribution permission |
| --- | --- | --- |
| Proasin | https://proasin.cl/ | No explicit grant obtained |
| Comercial Sauber | https://sauber.cl/ | No explicit grant obtained |
| General Trade | https://generaltrade.cl/ | No explicit grant obtained |
| Acquatecnia | https://acquatecnia.cl/ | No explicit grant obtained |
| Dimacofi | https://www.dimacofi.cl/pudu-mt1/ | No explicit grant obtained |
| VIC Robotics | https://www.vicrobotics.com/about | No explicit grant obtained |
| Hoppe | https://www.hoppechile.com/keenon-chile | No explicit grant obtained |

These entry pages were accessible during the release-preparation check; access is not a reuse license, and this check does not reverify or update the historical 15 source records. No explicit open-data/website reuse grant was established. Full website terms and jurisdiction-specific quotation rights have not been cleared. Keep excerpts limited and attributed; obtain permission before broader reuse, and review or remove any disputed excerpt. Public availability is not proof of unrestricted redistribution.

The public records contain short original Chinese factual summaries and source links, not website HTML dumps or copied product descriptions. The five archived demo text fields are 92–158 characters each (11–22 whitespace-delimited words), limited to factual product/service/relationship statements and carrying source URL/archive date; they are not presented as original MIT text or fresh verification. Their compact form is a content-minimization finding, not a universal legal safe-harbor based on word count. Do not expand them into marketing copy, brochures or a republished commercial dataset. Failed/indexed records and unknowns retain their original status; factual summaries do not establish purchase intent or brand authorization.

Pudu Robotics, PUDU CC1 Pro, PUDU MT1 and other company/product names belong to their respective rights holders. No product photos, brand logo image files, brochures, website dumps, customer lists, contracts or real sales communications are included. The project name and schematic CSS illustration are presentation elements, not authorization marks or authoritative maps. No affiliation, employment, manufacturer authorization, dealer appointment or real business results are claimed. Company self-description of a dealer relationship is not independent manufacturer confirmation.

Demo review, outreach, sent/replied states and follow-up activities are explicitly simulated and isolated. Mock inference and business suggestions are not company facts. Real DeepSeek API behavior has not undergone systematic live evaluation. Nothing in this notice authorizes contacting a company or publishing user-created private records.
