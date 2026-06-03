## Objetivo
Refletir o recorde real do Gabriel Simão: **Junho/2023 — R$ 7.440.000 em 15 vendas**, validando contra todas as abas da planilha "Cópia de Base reserva de Vendas".

## Passos

### 1. Validar leitura da planilha histórica
- A planilha histórica (`1l2vVwqtG5mJI_3PK-l7WAtasrf4vXUXReFYfFrLR68A`) hoje só é varrida em abas que começam com "Base" (filtro `s.toLowerCase().startsWith("base")` em `useGoogleSheetsData.tsx`).
- Verificar via edge function `google-sheets?action=list_sheets` se existe aba para Junho/2023 (ex.: "Base Junho 2023", "Base Jun 2023", "Junho 2023", "Cópia de Base..."). Se o nome não começar com "Base", ajustar o filtro para também aceitar nomes de mês/ano.
- Conferir se a aba de Jun/2023 está com cabeçalho/colunas no mesmo layout das demais (mesmas posições de corretor/data/valor). Se diferente, mapear colunas dessa aba específica.

### 2. Inserir o recorde manualmente em `sales_records`
Independente da leitura da planilha (para o Hall mostrar agora), gravar:
- `broker_name`: `Gabriel Simão`
- `record_month`: `2023-06`
- `record_value`: `7440000`
- `record_count`: `15`
- `notes`: `Recorde validado manualmente (Junho/2023)`

A lógica atual do `HallOfRecords` usa `Math.max(histValue, savedValue)`, então esse valor passa a ser exibido imediatamente; se a planilha for lida corretamente e bater 7.44M/15, o sistema continua coerente; se a planilha trouxer valor maior no futuro, ele sobrescreve automaticamente.

### 3. Auditoria rápida
- Após o reload, conferir no Hall que o card do Simão mostra "Junho/2023 — R$ 7.440.000 — 15 vendas".
- Conferir no console se houve algum 404/erro ao listar abas históricas; se sim, ajuste do passo 1 entra.

## Detalhes técnicos
- Arquivo a possivelmente alterar: `src/hooks/useGoogleSheetsData.tsx` (filtro de abas).
- Operação de dados via tool `supabase--insert` (UPSERT em `sales_records` por `broker_name + record_month`).
- Nenhuma mudança de schema.
