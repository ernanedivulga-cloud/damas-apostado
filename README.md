# Damas Apostado - Luxo (Versão pronta para deploy)

**Resumo:** Projeto demo com aposta fixa (R$5), multiplicador 1.7x para pagamento ao vencedor (crédito em carteira). Integração PixUp deixada como placeholder por segurança — coloque suas chaves como GitHub Secrets ou variáveis de ambiente no host.

## Como funciona:
- Cada jogador paga R$5 para entrar (API `/api/deposit` cria order simulada).
- Use `/api/webhook/simulate_paid` para marcar a ordem como paga (apenas para testes locais).
- Quando ambos pagarem, o jogo libera e as jogadas via WebSocket são permitidas.
- Ao terminar, cliente envia evento `game_end` com `winner` e servidor credita o vencedor com `Math.round(BET_CENTS * MULTIPLIER)` = R$5 * 1.7 = R$8.50 (simulado).
- Saldo é acumulado em `data.json` e pode ser solicitado saque via `/api/withdraw` (simulado).

## Segurança importante
- NÃO coloque chaves sensíveis diretamente no código.
- Crie Secrets no GitHub (Settings -> Secrets -> Actions) ou configure variáveis de ambiente no host (Render, Railway, Heroku).

## Deploy recomendado:
1. Backend: Render / Railway / Heroku (NODE app). Configure env vars `PIXUP_CLIENT_ID` e `PIXUP_CLIENT_SECRET`.
2. Frontend: `/public` serve a interface; o backend já serve ela. Apenas suba o projeto no host Node.
3. Configure webhook PixUp apontando para `/api/webhook` (implementar validação e lógica real).

## Trocar as chaves PixUp
1. Acesse PixUp -> API -> Regenerar credenciais (recomendado após exposição).
2. No repositório GitHub: Settings -> Secrets -> New repository secret
   - Name: PIXUP_CLIENT_ID
   - Value: <sua_client_id>
   - Add secret
   - Add PIXUP_CLIENT_SECRET do mesmo modo.
3. No host (Render/Heroku), configure as variáveis de ambiente com os mesmos nomes.

## Observação sobre payout (modelo que implementamos):
- O vencedor recebe `bet * 1.7` creditado na carteira interna.
- O restante permanece como taxa da casa (no exemplo: R$1.50 quando bet=R$5).

---
