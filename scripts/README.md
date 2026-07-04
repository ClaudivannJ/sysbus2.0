# Scripts de teste — SYSBUS

Scripts utilitários para teste de carga da enquete/fila. **Rodam contra o banco de
produção do Supabase** — use só em ambiente de teste ou com dados de teste.

Pré-requisitos:
- Node instalado e dependências do projeto (`npm install` já feito).
- Arquivo `.env.migrations` na raiz do projeto com `DIRECT_URL` (string de conexão do
  Postgres do Supabase). É o mesmo arquivo usado pelas migrações (`supabase/apply.mjs`).

---

## 1. Simular 100 votos — `simular-votos.mjs`

Cria 100 alunos de teste (CPF começando com `TESTE-`) e os faz **votar
sequencialmente** na enquete de hoje da rota **Arcoverde**, como na enquete do
WhatsApp. A cada voto há broadcast → a fila sobe **ao vivo** em "Viagem ao vivo"
(secretaria) e no portal do aluno.

Distribuição: Itaiba 50 · Negras 20 · Giral 20 · Estrada 10 (total 100).

**Antes de rodar:** tem que existir uma **viagem de hoje** para Arcoverde (a rota
precisa ter o dia de hoje nos dias de operação e os horários de enquete configurados).
Se não houver viagem hoje, o script avisa e para.

```bash
# padrão: 350ms entre cada voto
node scripts/simular-votos.mjs

# mais rápido (ex.: 150ms entre votos)
node scripts/simular-votos.mjs 150
```

Dica: abra "Viagem ao vivo" (painel) ou o portal do aluno no navegador antes de rodar,
para ver a fila subindo em tempo real.

O script é **idempotente**: pode rodar várias vezes. Ele reaproveita os alunos de
teste já criados e zera os votos de teste da viagem antes de votar de novo.

---

## 2. Limpar os dados de teste — `limpar-testes.mjs`

Exclui **definitivamente** (hard delete, não é soft delete) as 100 contas de teste
criadas acima e tudo que depende delas — embarques, reservas, carteirinhas, documentos
e renovações. Use antes de colocar o sistema em produção real.

```bash
node scripts/limpar-testes.mjs
```

Remove apenas contas com CPF `TESTE-%`. É **idempotente**: se não houver nenhuma conta
de teste, apenas informa que não há nada a remover. Roda dentro de uma transação
(se algo falhar, faz rollback e nada é removido).
