---
name: Commission rules per administrator
description: Commission % and installment rules per administrator - Magalu 2.5%/10x, Âncora 5%/16x, Canopus 4%/6x, HS 2%/à vista
type: feature
---
Commission % per administrator:
- Magalu: 2.5%, paid in 10 installments
- Âncora: 5%, paid in 16 installments
- Canopus: 4%, paid in 6 installments
- HS Consórcios: 2%, à vista (lump sum, only "dobras de contemplados")

Commission % is also stored in the budget_lines table (category "Total Comissões") as absolute values.

IMPORTANT: Commission projection (useCommissionForecast) splits into:
- Confirmed: 1st installment of current-month sales
- Recurring: installments from sales of last 16 months that fall in current month
- Pipeline: weighted Piperun open deals × ~3%
Hook fetches Gescon for the last 16 months (= max installment, Âncora) to compute recurring.
