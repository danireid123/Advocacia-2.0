# E2E Test Infra: Advocacia 2.0

## Test Philosophy
- Opaque-box, requirement-driven. Derivação direta dos requisitos do usuário em ORIGINAL_REQUEST.md.
- Metodologia sistemática de 4 camadas: Category-Partition, Análise de Valor Limite (BVA), Teste Combinatório Par a Par e Workloads do Mundo Real.
- Tolerância zero a alucinações financeiras e vazamento de documentos civis para contas bancárias.

## Feature Inventory & Test Mapping
| # | Feature | Source (requirement) | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) |
|---|---------|---------------------|:----------------:|:-----------------:|:-----------------:|
| 1 | Entrega e Exibição Garantida no Simulador | R1 | 5 | 5 | ✓ |
| 2 | Sincronização de Contato e Sessão Sandbox | R1 | 5 | 5 | ✓ |
| 3 | Modelo Customizado de Mensagem em config | R2 | 5 | 5 | ✓ |
| 4 | Aprimoramento com IA ("✨ Melhorar com IA") | R2 | 5 | 5 | ✓ |
| 5 | Blindagem Anti-Alucinação PIX (Rejeição de RG/CNH/Residência) | R3 | 5 | 5 | ✓ |
| 6 | Roteamento Automático de Documentos para Dossiê | R3 | 5 | 5 | ✓ |
| 7 | Trava Determinística contra Baixa de Parcela Indevida | R3 | 5 | 5 | ✓ |

## Test Architecture
- **Runner Principal:** Node.js CLI script: `node test_stress_anti_alucinacao_pix_dossie.js`
- **Suítes de Regressão Existentes:**
  - `node test_onboarding_e_cobranca_multimodal.js`
  - `node test_dashboard_financeiro_e_simulador.js`
  - `node test_varredura_e_simulador.js`
  - `node test_blindagem_v2_cloud_desktop.js`
  - `node test_melhorar_mensagem_ia.js`
  - `node test_deduplicacao_e_dossie.js`
- **Semântica de Saída:** Código de saída 0 para 100% de sucesso; código diferente de zero em caso de falha.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Cliente envia foto de RG fingindo ser comprovante PIX com valor correto da parcela pendente | F5, F6, F7 | Alta |
| 2 | Cliente envia Conta de Luz com código "Pague com Pix" impresso | F5, F6, F7 | Alta |
| 3 | Cliente envia CNH em JPEG real de alta resolução | F5, F6, F7 | Alta |
| 4 | Disparo de Onboarding com mensagem personalizada e aprimorada por IA no Simulador | F1, F2, F3, F4 | Média |
| 5 | Pagamento PIX autêntico de valor parcial com baixa de parcela e conciliação | F5, F7 | Média |
| 6 | Transação financeira legítima de cliente A sem afetar parcelas do cliente B | F5, F7 | Média |

## Coverage Thresholds
- Tier 1: ≥5 por funcionalidade
- Tier 2: ≥5 por funcionalidade (onde fronteiras e valores limites existem)
- Tier 3: Cobertura de pares de funcionalidades
- Tier 4: ≥5 cenários reais de aplicação
- Total mínimo de casos de teste planejados: ≥ 40 testes combinados
