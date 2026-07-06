# Regras para Agentes de IA (AI Agent Rules) — SYSBUS 2.0

Este arquivo define regras comportamentais específicas e restrições obrigatórias para agentes de IA (como Antigravity, Cursor, Copilot, etc.) que estejam operando neste repositório.

---

## 🚫 RESTRIÇÃO CRÍTICA DE CONTROLE DE BRANCH (GIT)

1. **NUNCA faça Commits ou Pushes na branch `main`**:
   - A branch `main` é protegida e representa o código em produção.
   - Qualquer tentativa de realizar `git commit` ou `git push` diretamente na branch `main` é estritamente proibida.

2. **Branch de Trabalho Padrão**:
   - Todo o trabalho de desenvolvimento, correção de segurança e novas funcionalidades deve ser realizado na branch **`desenvolvimento`** ou em branches temporárias criadas a partir dela (ex: `feature/...` ou `bugfix/...`).

3. **Fluxo de Inicialização Obrigatório para a IA**:
   - Antes de começar qualquer edição de código, execute `git status` para verificar a branch atual.
   - Se estiver na branch `main`, mude imediatamente para a branch `desenvolvimento` (`git checkout desenvolvimento`) ou crie uma nova branch a partir dela.

---

## 🛠️ Procedimento de Validação Obrigatório para a IA

Antes de considerar uma tarefa concluída ou propor um merge, a IA deve:
1. **Validar com o Linter**:
   - Executar `npm run lint` para garantir que as alterações não quebrem regras estéticas ou do compilador TypeScript.
2. **Executar Simulações de Banco de Dados**:
   - Se houver alteração de banco de dados ou backend, executar as simulações locais com `node scripts/simular-votos.mjs`.
   - Limpar o banco de dados de testes em seguida com `node scripts/limpar-testes.mjs`.
