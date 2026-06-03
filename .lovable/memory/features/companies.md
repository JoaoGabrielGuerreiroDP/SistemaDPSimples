---
name: Companies feature
description: Companies table (admin-manageable) groups departments. Dashboard shows company cards before OKRs.
type: feature
---
- Table: public.companies (name, icon, sort_order)
- departments.company_id references companies.id
- Dashboard Index shows company cards; clicking drills into that company's OKRs
- 7 default companies: DP Soluções, DP Prime, DP Consórcios, Banco de Contempladas, DP Contempladas, DP Educação, Hub DP
